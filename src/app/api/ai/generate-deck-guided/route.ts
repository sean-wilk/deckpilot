import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { getStreamingClient } from '@/lib/ai/providers'
import { encoder, formatSSE } from '@/lib/ai/sse-utils'
import { validateCardBatch } from '@/lib/ai/card-validation'
import { getSpicyPrompt } from '@/lib/ai/deck-prompts'
import { collectAiResponse } from '@/lib/ai/ai-client'

export const maxDuration = 300

// ─── Types ──────────────────────────────────────────────────────────────────

interface CategoryPlan {
  name: string
  count: number
  description: string
}

interface GenerationPlan {
  planned_lands: number
  categories: CategoryPlan[]
  reasoning: string
}

interface ParsedCard {
  name: string
  category: string
  reasoning: string
}

// ─── Default category distribution ──────────────────────────────────────────

const DEFAULT_CATEGORIES: CategoryPlan[] = [
  { name: 'Ramp', count: 10, description: 'Mana acceleration' },
  { name: 'Card Draw', count: 8, description: 'Card advantage and hand refill' },
  { name: 'Removal', count: 8, description: 'Targeted removal spells' },
  { name: 'Board Wipe', count: 3, description: 'Mass removal effects' },
  { name: 'Win Condition', count: 4, description: 'Primary win conditions' },
  { name: 'Protection', count: 4, description: 'Protecting key pieces' },
  { name: 'Synergy', count: 15, description: 'Commander synergy pieces' },
  { name: 'Utility', count: 5, description: 'Flexible utility cards' },
  { name: 'Creature', count: 6, description: 'Creatures for board presence' },
]

function scaleCategories(
  categories: CategoryPlan[],
  targetNonLands: number
): CategoryPlan[] {
  // Ensure no zero-count categories from AI
  const safeCats = categories.map(c => ({ ...c, count: Math.max(1, c.count) }))
  const currentTotal = safeCats.reduce((sum, c) => sum + c.count, 0)
  if (currentTotal === targetNonLands) return safeCats

  const ratio = targetNonLands / currentTotal
  const scaled = safeCats.map(c => ({
    ...c,
    count: Math.max(1, Math.round(c.count * ratio)),
  }))

  const scaledTotal = scaled.reduce((sum, c) => sum + c.count, 0)
  const diff = targetNonLands - scaledTotal
  if (diff !== 0) {
    const largest = scaled.reduce((max, c, i) => c.count > scaled[max].count ? i : max, 0)
    scaled[largest].count += diff
  }

  return scaled
}

// ─── JSON line parser ───────────────────────────────────────────────────────

function parseJsonLines(text: string): ParsedCard[] {
  const results: ParsedCard[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.name && parsed.category) {
        results.push({
          name: parsed.name,
          category: parsed.category,
          reasoning: parsed.reasoning ?? '',
        })
      }
    } catch { /* skip unparseable lines */ }
  }
  return results
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    if (request.signal.aborted) {
      return new Response('Request aborted', { status: 499 })
    }

    // 2. Parse & validate body
    const body = await request.json()
    const { commanderId, description, targetBracket, budgetLimitCents, spiciness } = body
    const validSpiciness = Math.max(0, Math.min(100, Number(spiciness) || 30))
    const validBudget = budgetLimitCents !== undefined && Number.isFinite(Number(budgetLimitCents)) && Number(budgetLimitCents) >= 0
      ? Number(budgetLimitCents)
      : undefined

    if (!commanderId || typeof commanderId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'commanderId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const bracket = Number(targetBracket)
    if (!bracket || bracket < 1 || bracket > 5) {
      return new Response(
        JSON.stringify({ error: 'targetBracket must be between 1 and 5' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. Look up commander
    const commanderRows = await db
      .select({ name: cards.name, colorIdentity: cards.colorIdentity })
      .from(cards)
      .where(eq(cards.id, commanderId))
      .limit(1)

    if (!commanderRows[0]) {
      return new Response(
        JSON.stringify({ error: 'Commander not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const commanderName = commanderRows[0].name
    const colorIdentity = commanderRows[0].colorIdentity

    // 4. Get streaming client
    const streamingClient = await getStreamingClient()

    const safeDescription = (description ?? '')
      .slice(0, 500)
      .replace(/===|```/g, '')
    const spicyPrompt = getSpicyPrompt(validSpiciness)

    const allColors = ['W', 'U', 'B', 'R', 'G']
    const forbidden = allColors.filter(c => !colorIdentity.includes(c))
    const colorRuleSnippet = forbidden.length > 0
      ? `Color identity is ONLY: ${colorIdentity.join(', ')}. FORBIDDEN colors: ${forbidden.map(c => ({ W: 'White (W)', U: 'Blue (U)', B: 'Black (B)', R: 'Red (R)', G: 'Green (G)' }[c])).join(', ')}. Do NOT include ANY card with forbidden colors in its color identity.`
      : `Color identity: ${colorIdentity.join(', ')} (5-color — all colors allowed).`

    // 5. Build SSE ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeatInterval)
          }
        }, 15_000)

        try {
          // ═══════════════════════════════════════════════════════════════
          // PHASE 1: PLANNING
          // ═══════════════════════════════════════════════════════════════
          controller.enqueue(encoder.encode(formatSSE('phase', {
            phase: 'planning',
            message: 'Analyzing commander and planning deck structure...',
          })))

          const planSystemPrompt = `You are a Magic: The Gathering deck building strategist. Analyze the commander and create a category distribution plan for a 99-card Commander deck. Output ONLY JSON in this format: {"planned_lands": <34-40>, "categories": [{"name": "<category>", "count": <number>, "description": "<why this category matters for this commander>"}], "reasoning": "<overall strategy explanation>"}. Categories must have counts summing to exactly 99 minus planned_lands. Use categories specific to this commander's strategy, not generic ones.`

          const planUserPrompt = `Commander: ${commanderName}
Colors: ${colorIdentity.join(', ')}
Target Bracket: ${bracket}
Strategy: ${safeDescription || 'Build the strongest synergistic deck for this commander.'}
Spiciness: ${validSpiciness}/100
${spicyPrompt}
${validBudget !== undefined ? `Budget Limit: $${(validBudget / 100).toFixed(2)}` : ''}`

          let plan: GenerationPlan
          try {
            const planText = await collectAiResponse(
              streamingClient,
              planSystemPrompt,
              planUserPrompt,
              2048,
              request.signal
            )

            // Extract JSON from response (handle markdown fences)
            const jsonMatch = planText.match(/\{[\s\S]*\}/)
            if (!jsonMatch) throw new Error('No JSON found in plan response')

            const parsed = JSON.parse(jsonMatch[0])

            // Validate plan structure
            const plannedLands = Number(parsed.planned_lands)
            if (!plannedLands || plannedLands < 34 || plannedLands > 40) {
              throw new Error(`Invalid planned_lands: ${parsed.planned_lands}`)
            }

            const cats = parsed.categories as CategoryPlan[]
            if (!Array.isArray(cats) || cats.length === 0) {
              throw new Error('No categories in plan')
            }

            const catTotal = cats.reduce((sum: number, c: CategoryPlan) => sum + c.count, 0)
            const expectedNonLands = 99 - plannedLands

            // If categories don't sum correctly, scale them
            if (catTotal !== expectedNonLands) {
              console.log(`[guided] Plan categories sum ${catTotal}, expected ${expectedNonLands}. Scaling.`)
              plan = {
                planned_lands: plannedLands,
                categories: scaleCategories(cats, expectedNonLands),
                reasoning: parsed.reasoning ?? '',
              }
            } else {
              plan = {
                planned_lands: plannedLands,
                categories: cats,
                reasoning: parsed.reasoning ?? '',
              }
            }
          } catch (planErr) {
            console.warn('[guided] Plan generation failed, using defaults:', planErr)
            const defaultLands = 36
            plan = {
              planned_lands: defaultLands,
              categories: scaleCategories(DEFAULT_CATEGORIES, 99 - defaultLands),
              reasoning: 'Using default category distribution (plan generation failed).',
            }
          }

          controller.enqueue(encoder.encode(formatSSE('generation_plan', plan)))
          controller.enqueue(encoder.encode(formatSSE('bracket_reasoning', {
            bracket,
            planned_lands: plan.planned_lands,
            reasoning: plan.reasoning,
          })))

          const targetNonLands = 99 - plan.planned_lands

          // Track all accepted cards
          const deckCards: Array<{ name: string; category: string; reasoning: string }> = []
          const seenCardIds = new Set<string>()
          let globalIndex = 0
          let totalFixedByRetry = 0
          let totalDropped = 0
          const categoryResults: Array<{ name: string; requested: number; actual: number }> = []

          // ═══════════════════════════════════════════════════════════════
          // PHASE 2: CATEGORY-BY-CATEGORY GENERATION
          // ═══════════════════════════════════════════════════════════════
          for (let i = 0; i < plan.categories.length; i++) {
            if (request.signal.aborted) break

            const cat = plan.categories[i]
            controller.enqueue(encoder.encode(formatSSE('phase', {
              phase: 'generating_category',
              category: cat.name,
              current: i + 1,
              total: plan.categories.length,
              message: `Generating ${cat.name} (${i + 1}/${plan.categories.length})...`,
            })))

            const existingCardNames = deckCards.map(c => c.name)

            const catSystemPrompt = `You are an MTG deck builder. Generate exactly ${cat.count} cards for the "${cat.name}" role in a ${commanderName} Commander deck. ${colorRuleSnippet} Target bracket: ${bracket}. ${spicyPrompt} Cards already in deck (DO NOT suggest these): ${existingCardNames.join(', ') || 'none yet'}. Output ONLY JSON lines, one per card: {"name": "<exact card name>", "category": "${cat.name}", "reasoning": "<brief reason>"}. Output nothing else — no markdown, no explanations, no numbering, no code fences.`

            const catUserPrompt = `Generate exactly ${cat.count} cards for the "${cat.name}" category. ${cat.description}. Commander: ${commanderName}. ${validBudget !== undefined ? `Budget limit: $${(validBudget / 100).toFixed(2)} total deck.` : ''}`

            let neededCount = cat.count
            let catAccepted = 0
            const MAX_RETRIES = 2

            for (let attempt = 0; attempt <= MAX_RETRIES && neededCount > 0; attempt++) {
              if (request.signal.aborted) break

              const retrySystemPrompt = attempt === 0
                ? catSystemPrompt
                : `You are an MTG deck builder. Generate exactly ${neededCount} replacement cards for the "${cat.name}" role in a ${commanderName} Commander deck. ${colorRuleSnippet} Target bracket: ${bracket}. ${spicyPrompt} Cards already in deck (DO NOT suggest these): ${deckCards.map(c => c.name).join(', ')}. Output ONLY JSON lines, one per card: {"name": "<exact card name>", "category": "${cat.name}", "reasoning": "<brief reason>"}. Output nothing else.`

              const retryUserPrompt = attempt === 0
                ? catUserPrompt
                : `Generate exactly ${neededCount} MORE cards for "${cat.name}". Previous suggestions had invalid cards. Do not repeat any card already listed.`

              const responseText = await collectAiResponse(
                streamingClient,
                retrySystemPrompt,
                retryUserPrompt,
                2048,
                request.signal
              )

              const parsedCards = parseJsonLines(responseText)
              if (parsedCards.length === 0) {
                console.warn(`[guided] No cards parsed for ${cat.name} attempt ${attempt}`)
                continue
              }

              // Validate batch
              const names = parsedCards.map(c => c.name)
              const validationResults = await validateCardBatch(names, colorIdentity, seenCardIds)

              let batchValid = 0
              let batchInvalid = 0

              for (const card of parsedCards) {
                const result = validationResults.get(card.name)
                if (result?.valid) {
                  const finalName = result.correctedName ?? card.name
                  if (result.cardId) seenCardIds.add(result.cardId)

                  deckCards.push({
                    name: finalName,
                    category: cat.name,
                    reasoning: card.reasoning,
                  })

                  controller.enqueue(encoder.encode(formatSSE('card', {
                    index: globalIndex,
                    name: finalName,
                    category: cat.name,
                    reasoning: card.reasoning,
                    validated: true,
                  })))
                  globalIndex++
                  batchValid++
                  catAccepted++

                  if (catAccepted >= cat.count) break
                } else {
                  batchInvalid++
                  console.log(`[guided] Invalid card in ${cat.name}: ${card.name} (${result?.reason ?? 'unknown'})`)
                }
              }

              if (attempt > 0) totalFixedByRetry += batchValid
              neededCount = cat.count - catAccepted

              console.log(`[guided] ${cat.name} attempt ${attempt}: ${batchValid} valid, ${batchInvalid} invalid, ${neededCount} still needed`)
            }

            totalDropped += neededCount
            categoryResults.push({
              name: cat.name,
              requested: cat.count,
              actual: catAccepted,
            })
          }

          // ═══════════════════════════════════════════════════════════════
          // PHASE 3: GAP-FILLING
          // ═══════════════════════════════════════════════════════════════
          const nonLandCount = deckCards.length
          const gap = targetNonLands - nonLandCount

          if (gap > 0 && !request.signal.aborted) {
            controller.enqueue(encoder.encode(formatSSE('phase', {
              phase: 'gap_filling',
              message: `Filling ${gap} remaining non-land slots...`,
              needed: gap,
            })))

            const gapSystemPrompt = `You are an MTG deck builder. Generate exactly ${gap} additional cards for a ${commanderName} Commander deck. ${colorRuleSnippet} Target bracket: ${bracket}. ${spicyPrompt} Cards already in deck (DO NOT suggest these): ${deckCards.map(c => c.name).join(', ')}. Output ONLY JSON lines, one per card: {"name": "<exact card name>", "category": "<category>", "reasoning": "<brief reason>"}. Output nothing else.`

            const gapUserPrompt = `Generate exactly ${gap} cards to fill remaining slots. Choose a mix of utility, synergy, and support cards that complement the existing deck. Commander: ${commanderName}.`

            for (let attempt = 0; attempt <= 1 && (targetNonLands - deckCards.length) > 0; attempt++) {
              if (request.signal.aborted) break

              const currentGap = targetNonLands - deckCards.length
              const responseText = await collectAiResponse(
                streamingClient,
                attempt === 0
                  ? gapSystemPrompt
                  : `You are an MTG deck builder. Generate exactly ${currentGap} cards for a ${commanderName} Commander deck. ${colorRuleSnippet} Cards already in deck: ${deckCards.map(c => c.name).join(', ')}. Output ONLY JSON lines.`,
                attempt === 0
                  ? gapUserPrompt
                  : `Generate ${currentGap} more unique cards not already in the deck.`,
                2048,
                request.signal
              )

              const parsedCards = parseJsonLines(responseText)
              const names = parsedCards.map(c => c.name)

              if (names.length > 0) {
                const validationResults = await validateCardBatch(names, colorIdentity, seenCardIds)

                for (const card of parsedCards) {
                  if (deckCards.length >= targetNonLands) break

                  const result = validationResults.get(card.name)
                  if (result?.valid) {
                    const finalName = result.correctedName ?? card.name
                    if (result.cardId) seenCardIds.add(result.cardId)

                    deckCards.push({
                      name: finalName,
                      category: card.category,
                      reasoning: card.reasoning,
                    })

                    controller.enqueue(encoder.encode(formatSSE('card', {
                      index: globalIndex,
                      name: finalName,
                      category: card.category,
                      reasoning: card.reasoning,
                      validated: true,
                    })))
                    globalIndex++
                    if (attempt > 0) totalFixedByRetry++
                  }
                }
              }
            }
          }

          // ═══════════════════════════════════════════════════════════════
          // PHASE 4: LANDS
          // ═══════════════════════════════════════════════════════════════
          if (!request.signal.aborted) {
            controller.enqueue(encoder.encode(formatSSE('phase', {
              phase: 'lands',
              message: `Generating ${plan.planned_lands} lands...`,
            })))

            const landSystemPrompt = `You are an MTG deck builder. Generate exactly ${plan.planned_lands} land cards for a ${commanderName} Commander deck. ${colorRuleSnippet} Target bracket: ${bracket}. Include a mix of basic lands, dual lands, utility lands, and mana-fixing lands appropriate for the color identity and bracket level. Output ONLY JSON lines, one per card: {"name": "<exact land name>", "category": "land", "reasoning": "<brief reason>"}. Output nothing else — no markdown, no explanations, no numbering, no code fences.`

            const landUserPrompt = `Generate exactly ${plan.planned_lands} lands for a ${colorIdentity.join('/')} Commander deck. Commander: ${commanderName}. ${validBudget !== undefined ? `Budget limit: $${(validBudget / 100).toFixed(2)} total deck.` : ''}`

            const landCards: ParsedCard[] = []
            let landsNeeded = plan.planned_lands

            for (let attempt = 0; attempt <= 2 && landsNeeded > 0; attempt++) {
              if (request.signal.aborted) break

              const responseText = await collectAiResponse(
                streamingClient,
                attempt === 0
                  ? landSystemPrompt
                  : `You are an MTG deck builder. Generate exactly ${landsNeeded} land cards for a ${commanderName} Commander deck. ${colorRuleSnippet} Lands already chosen: ${landCards.map(c => c.name).join(', ')}. Output ONLY JSON lines: {"name": "<exact land name>", "category": "land", "reasoning": "<brief reason>"}.`,
                attempt === 0
                  ? landUserPrompt
                  : `Generate ${landsNeeded} more unique land cards not already listed.`,
                2048,
                request.signal
              )

              const parsedLands = parseJsonLines(responseText)
              const names = parsedLands.map(c => c.name)

              if (names.length > 0) {
                const validationResults = await validateCardBatch(names, colorIdentity, seenCardIds)

                for (const card of parsedLands) {
                  if (landCards.length >= plan.planned_lands) break

                  const result = validationResults.get(card.name)
                  if (result?.valid) {
                    const finalName = result.correctedName ?? card.name
                    // Only add non-basic land IDs to seen set (basics can repeat)
                    if (result.cardId) seenCardIds.add(result.cardId)

                    landCards.push({
                      name: finalName,
                      category: 'land',
                      reasoning: card.reasoning,
                    })

                    controller.enqueue(encoder.encode(formatSSE('card', {
                      index: globalIndex,
                      name: finalName,
                      category: 'land',
                      reasoning: card.reasoning,
                      validated: true,
                    })))
                    globalIndex++
                    if (attempt > 0) totalFixedByRetry++
                  }
                }

                landsNeeded = plan.planned_lands - landCards.length
              }
            }

            // ═════════════════════════════════════════════════════════════
            // PHASE 5: FINAL ASSEMBLY
            // ═════════════════════════════════════════════════════════════
            const totalCards = deckCards.length + landCards.length

            // Minimum threshold check
            if (totalCards < 80) {
              controller.enqueue(encoder.encode(formatSSE('error', {
                message: `Generation produced too few valid cards (${totalCards}/99). Try again.`,
              })))
              clearInterval(heartbeatInterval)
              controller.close()
              return
            }

            // Quality report
            const qualityReport = {
              totalCards,
              originalInvalid: totalFixedByRetry + totalDropped,
              fixed: totalFixedByRetry,
              dropped: totalDropped + (plan.planned_lands - landCards.length),
              nonLands: deckCards.length,
              lands: landCards.length,
              targetNonLands,
              targetLands: plan.planned_lands,
              categories: categoryResults,
            }

            controller.enqueue(encoder.encode(formatSSE('quality_report', qualityReport)))

            // Strategy summary
            controller.enqueue(encoder.encode(formatSSE('strategy_summary', {
              summary: `Guided generation for ${commanderName} (${colorIdentity.join('/')}) produced ${totalCards} validated cards across ${plan.categories.length} categories. ${plan.reasoning}`,
              estimated_bracket: bracket,
              total_cards: totalCards,
            })))

            controller.enqueue(encoder.encode(formatSSE('done', {})))
          }

        } catch (err) {
          console.error('[guided] Generation error:', err)
          controller.enqueue(encoder.encode(formatSSE('error', {
            message: 'Guided generation failed. Please try again.',
          })))
        } finally {
          clearInterval(heartbeatInterval)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[guided] Route error:', error)
    return new Response(
      JSON.stringify({ error: 'Guided generation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
