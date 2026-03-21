import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { getStreamingClient } from '@/lib/ai/providers'
import { StreamParser } from '@/lib/ai/stream-parser'
import { encoder, formatSSE } from '@/lib/ai/sse-utils'
import { validateCardBatch } from '@/lib/ai/card-validation'

export const maxDuration = 300

// ─── Spiciness helper ────────────────────────────────────────────────────────

function getSpicyPrompt(spiciness: number): string {
  if (spiciness <= 15) return 'Build a meta-optimal, competitive deck using the most powerful and efficient staples available.'
  if (spiciness <= 35) return 'Build a tuned deck that is strong and consistent but not necessarily top-tier competitive.'
  if (spiciness <= 65) return 'Build a balanced deck mixing strong cards with interesting and fun choices.'
  if (spiciness <= 85) return 'Build a spicy deck favoring creative, unexpected, and underplayed card choices over raw power.'
  return 'Build a jank deck prioritizing wild, weird, and hilarious card choices. Embrace chaos and fun over winning.'
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

    // 2. Check abort before heavy work
    if (request.signal.aborted) {
      return new Response('Request aborted', { status: 499 })
    }

    // 3. Parse & validate body
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

    // 4. Look up commander name + color identity from DB
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

    // 5. Get streaming client
    const streamingClient = await getStreamingClient()

    // 6. Build system prompt (same as fast mode)
    const safeDescription = (description ?? '')
      .slice(0, 500)
      .replace(/===|```/g, '')

    const SYSTEM_PROMPT = `You are a Magic: The Gathering deck builder. Generate a 99-card Commander deck (the commander is the 100th card and is NOT included in your output).

Commander: ${commanderName}
Commander Colors: ${colorIdentity.join(', ')}
Target Bracket: ${bracket}
Strategy: ${safeDescription || 'Build the strongest synergistic deck for this commander.'}
${validBudget !== undefined ? `Budget Limit: $${(validBudget / 100).toFixed(2)}` : ''}

${getSpicyPrompt(validSpiciness)}

DECK BUILDING APPROACH:
1. In the BRACKET_REASONING section, declare your planned_lands count (a number between 34-40). This sets your deck structure: non-lands = 99 - planned_lands, lands = planned_lands.
2. Generate EXACTLY (99 - planned_lands) non-land cards in the CARDS section. Not one more, not one less. Count carefully.
3. Generate EXACTLY planned_lands land cards in the LANDS section. Not one more, not one less.
4. Total MUST be exactly 99. The system will REJECT any cards beyond the limits you set.

For example: if planned_lands is 37, generate exactly 62 non-land cards, then exactly 37 lands.

The CARDS section contains ALL non-land cards. The LANDS section contains ALL lands.

OUTPUT FORMAT — follow this EXACTLY:

===BRACKET_REASONING===
{"bracket": <number>, "planned_lands": <number between 34-40>, "reasoning": "<one paragraph explaining bracket calibration, your planned land count, and why>"}
===END_BRACKET_REASONING===

===CARDS===
{"index": 0, "name": "<exact card name>", "category": "<category>", "reasoning": "<brief reason>"}
{"index": 1, "name": "<exact card name>", "category": "<category>", "reasoning": "<brief reason>"}
...all non-land cards, one JSON object per line...
===END_CARDS===

===LANDS===
{"index": <continues from cards>, "name": "<exact land name>", "category": "land", "reasoning": "<brief reason>"}
...all land cards, one JSON object per line...
===END_LANDS===

===STRATEGY_SUMMARY===
{"summary": "<2-3 paragraph strategy overview including land count rationale>", "estimated_bracket": <number>, "total_cards": 99}
===END_STRATEGY_SUMMARY===

RULES:
- Output ONLY the format above, no other text
- Each card is a single JSON object on its own line (JSON Lines format)
- CARDS section: EXACTLY (99 - planned_lands) non-land cards. COUNT THEM. Stop when you reach the limit.
- LANDS section: EXACTLY planned_lands land cards. COUNT THEM. Stop when you reach the limit.
- CARDS + LANDS must total EXACTLY 99 cards — the system enforces this and will discard extras
- Categories for non-lands: ramp, card_draw, removal, board_wipe, win_condition, protection, synergy, utility, creature
- All land cards use category "land"
- Index numbering is continuous across both sections (0, 1, 2, ... 98)
- Card names must be exact official MTG card names
- All cards must be legal in Commander format
- CRITICAL COLOR IDENTITY RULE: This commander's color identity is ONLY: ${colorIdentity.join(', ')}${(() => { const allColors = ['W', 'U', 'B', 'R', 'G']; const forbidden = allColors.filter(c => !colorIdentity.includes(c)); return forbidden.length > 0 ? `. The following colors are FORBIDDEN — do NOT include ANY card that has ${forbidden.join(', ')} in its color identity (including mana costs, text box mana symbols, and color indicators): ${forbidden.map(c => ({ W: 'White (W)', U: 'Blue (U)', B: 'Black (B)', R: 'Red (R)', G: 'Green (G)' }[c])).join(', ')}` : ' (5-color — all colors allowed)'; })()}
- This applies to ALL cards including lands. Triomes, shocklands, and filter lands with forbidden colors are NOT allowed.
- Basic lands and truly colorless cards (no colored mana symbols anywhere) are always allowed
- When in doubt about a card's color identity, do NOT include it
- For double-faced cards (DFCs), ALWAYS use the FRONT face name only. For example, use "Esika, God of the Tree" not "The Prismatic Bridge"
- Do NOT include the commander (${commanderName}) in your output — it is already accounted for`

    // 7. Build SSE streaming response with multi-pass quality pipeline
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
          // === PHASE 1: Generate internally ===
          controller.enqueue(encoder.encode(formatSSE('phase', { phase: 'generating', message: 'Planning your deck...' })))

          let collectedText = ''

          if (streamingClient.provider === 'anthropic') {
            const anthropicClient = streamingClient.client as Anthropic
            const messageStream = anthropicClient.messages.stream({
              model: streamingClient.model,
              max_tokens: streamingClient.maxTokens,
              messages: [{ role: 'user', content: 'Generate the deck now.' }],
              system: SYSTEM_PROMPT,
            })
            for await (const event of messageStream) {
              if (request.signal.aborted) break
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                collectedText += event.delta.text
              }
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const openaiClient = streamingClient.client as any
            const completion = await openaiClient.chat.completions.create({
              model: streamingClient.model,
              max_tokens: streamingClient.maxTokens,
              stream: true,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: 'Generate the deck now.' },
              ],
            })
            for await (const chunk of completion) {
              if (request.signal.aborted) break
              const content = chunk.choices[0]?.delta?.content
              if (content) collectedText += content
            }
          }

          // === PARSE PASS 1 ===
          const parser = new StreamParser()
          const allEvents = parser.processChunk(collectedText)

          // Extract bracket reasoning, cards, strategy summary
          let bracketReasoning: Record<string, unknown> | null = null
          let strategySummary: Record<string, unknown> | null = null
          const cardEvents: Array<{ name: string; category: string; reasoning: string }> = []

          for (const evt of allEvents) {
            if (evt.type === 'bracket_reasoning') bracketReasoning = evt.data
            if (evt.type === 'card') {
              cardEvents.push({
                name: (evt.data as { name: string }).name,
                category: (evt.data as { category: string }).category,
                reasoning: (evt.data as { reasoning: string }).reasoning,
              })
            }
            if (evt.type === 'strategy_summary') strategySummary = evt.data
          }

          // === PHASE 2: Validate ===
          controller.enqueue(encoder.encode(formatSSE('phase', { phase: 'validating', message: 'Validating card selections...' })))

          const cardNames = cardEvents.map(c => c.name)
          const validationResults = await validateCardBatch(cardNames, colorIdentity)

          const validCards: typeof cardEvents = []
          const invalidCards: Array<{ name: string; category: string; reason: string }> = []

          for (const card of cardEvents) {
            const result = validationResults.get(card.name)
            if (result?.valid) {
              validCards.push(card)
            } else {
              invalidCards.push({
                name: card.name,
                category: card.category,
                reason: result?.reason ?? 'unknown',
              })
            }
          }

          // === PHASE 3: Fix invalid cards (if any) ===
          let fixedCards: typeof cardEvents = []

          if (invalidCards.length > 0) {
            controller.enqueue(encoder.encode(formatSSE('phase', {
              phase: 'fixing',
              message: `Replacing ${invalidCards.length} invalid cards...`,
              invalidCount: invalidCards.length,
            })))

            // Build fix-up prompt
            const fixPrompt = `You are a Magic: The Gathering deck builder. Some cards in a Commander deck were invalid and need replacement.

Commander: ${commanderName}
Commander Colors: ${colorIdentity.join(', ')}
Target Bracket: ${bracket}

The following cards were invalid and need 1:1 replacements. Each replacement must:
- Be within the commander's color identity (${colorIdentity.join(', ')} ONLY)
- Be a real, existing MTG card with the exact official name
- Fill the same role (category) as the card it replaces
- Be legal in Commander format

Invalid cards to replace:
${invalidCards.map(c => `- ${c.name} (${c.category}) — reason: ${c.reason}`).join('\n')}

Output ONLY replacement cards, one JSON object per line. No other text, no markers, no explanations outside the JSON:
{"name": "<exact card name>", "category": "<category>", "reasoning": "<why this replaces the invalid card>"}
`

            let fixCollectedText = ''

            if (streamingClient.provider === 'anthropic') {
              const anthropicClient = streamingClient.client as Anthropic
              const fixStream = anthropicClient.messages.stream({
                model: streamingClient.model,
                max_tokens: 4096,
                messages: [{ role: 'user', content: fixPrompt }],
              })
              for await (const event of fixStream) {
                if (request.signal.aborted) break
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  fixCollectedText += event.delta.text
                }
              }
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const openaiClient = streamingClient.client as any
              const fixCompletion = await openaiClient.chat.completions.create({
                model: streamingClient.model,
                max_tokens: 4096,
                stream: true,
                messages: [
                  { role: 'user', content: fixPrompt },
                ],
              })
              for await (const chunk of fixCompletion) {
                if (request.signal.aborted) break
                const content = chunk.choices[0]?.delta?.content
                if (content) fixCollectedText += content
              }
            }

            // Parse fix-up response (simple JSON lines, no StreamParser)
            const fixLines = fixCollectedText.split('\n').filter(l => l.trim().startsWith('{'))
            for (const line of fixLines) {
              try {
                const parsed = JSON.parse(line.trim())
                if (parsed.name && parsed.category) {
                  fixedCards.push({
                    name: parsed.name,
                    category: parsed.category,
                    reasoning: parsed.reasoning ?? '',
                  })
                }
              } catch { /* skip unparseable lines */ }
            }

            // Re-validate fixed cards
            if (fixedCards.length > 0) {
              // Build set of valid card IDs from Pass 1
              const validCardIds = new Set<string>()
              for (const card of validCards) {
                const result = validationResults.get(card.name)
                if (result?.cardId) validCardIds.add(result.cardId)
              }

              const fixValidation = await validateCardBatch(
                fixedCards.map(c => c.name),
                colorIdentity,
                validCardIds  // prevents duplicates against Pass 1 valid cards
              )
              fixedCards = fixedCards.filter(c => {
                const result = fixValidation.get(c.name)
                return result?.valid
              })
            }
          }

          // === MINIMUM THRESHOLD CHECK ===
          const totalValid = validCards.length + fixedCards.length
          if (totalValid < 80) {
            controller.enqueue(encoder.encode(formatSSE('error', {
              message: `Generation produced too few valid cards (${totalValid}/99). Try again.`,
            })))
            clearInterval(heartbeatInterval)
            controller.close()
            return
          }

          // === PHASE 4: Stream final validated list ===
          controller.enqueue(encoder.encode(formatSSE('phase', { phase: 'streaming', message: 'Finalizing deck...' })))

          // Send bracket reasoning
          if (bracketReasoning) {
            controller.enqueue(encoder.encode(formatSSE('bracket_reasoning', bracketReasoning)))
          }

          // Send all valid cards (original + fixed)
          const allCards = [...validCards, ...fixedCards]
          for (let i = 0; i < allCards.length; i++) {
            controller.enqueue(encoder.encode(formatSSE('card', {
              index: i,
              name: allCards[i].name,
              category: allCards[i].category,
              reasoning: allCards[i].reasoning,
              validated: true,
            })))
          }

          // Send strategy summary
          if (strategySummary) {
            controller.enqueue(encoder.encode(formatSSE('strategy_summary', strategySummary)))
          }

          // Send quality report
          controller.enqueue(encoder.encode(formatSSE('quality_report', {
            originalInvalid: invalidCards.length,
            fixed: fixedCards.length,
            dropped: invalidCards.length - fixedCards.length,
            totalCards: allCards.length,
          })))

          // Done
          controller.enqueue(encoder.encode(formatSSE('done', {})))

        } catch (err) {
          const message = err instanceof Error ? err.message : 'Quality generation failed'
          controller.enqueue(encoder.encode(formatSSE('error', { message })))
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
    console.error('Quality generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Quality generation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
