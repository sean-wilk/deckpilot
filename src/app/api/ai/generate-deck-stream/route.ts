import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getStreamingClient } from '@/lib/ai/providers'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 300

// ─── Mini Zod schemas for SSE event validation ──────────────────────────────

const CardEventSchema = z.object({
  index: z.number(),
  name: z.string().min(1),
  category: z.string(),
  reasoning: z.string(),
  phase: z.number().optional(),
})

const BracketReasoningSchema = z.object({
  bracket: z.number(),
  reasoning: z.string(),
  planned_lands: z.number().optional(),
})

const StrategySummarySchema = z.object({
  summary: z.string(),
  estimated_bracket: z.number(),
  total_cards: z.number(),
})

// ─── StreamParser ───────────────────────────────────────────────────────────

type ParseState = 'INIT' | 'BRACKET_REASONING' | 'CARDS' | 'BETWEEN_CARDS_LANDS' | 'LANDS' | 'STRATEGY_SUMMARY' | 'DONE'

class StreamParser {
  private state: ParseState = 'INIT'
  private buffer = ''
  private nonLandCount = 0
  private landCount = 0
  private maxNonLands = 65  // default, updated from bracket reasoning
  private maxLands = 40     // default, updated from bracket reasoning

  /** Set limits based on the AI's planned land count from bracket reasoning */
  setLandPlan(plannedLands: number) {
    // Clamp to sane range (34-42)
    this.maxLands = Math.max(34, Math.min(42, plannedLands))
    this.maxNonLands = 99 - this.maxLands
  }

  processChunk(chunk: string): Array<{ type: string; data: Record<string, unknown> }> {
    this.buffer += chunk
    const events: Array<{ type: string; data: Record<string, unknown> }> = []

    while (true) {
      if (this.state === 'INIT' && this.buffer.includes('===BRACKET_REASONING===')) {
        this.buffer = this.buffer.split('===BRACKET_REASONING===')[1]
        this.state = 'BRACKET_REASONING'
        continue
      }

      if (this.state === 'BRACKET_REASONING' && this.buffer.includes('===END_BRACKET_REASONING===')) {
        const content = this.buffer.split('===END_BRACKET_REASONING===')[0]
        this.buffer = this.buffer.split('===END_BRACKET_REASONING===')[1]
        const json = this.extractJSON(content)
        if (json) {
          const parsed = BracketReasoningSchema.safeParse(json)
          if (parsed.success) {
            events.push({ type: 'bracket_reasoning', data: parsed.data as unknown as Record<string, unknown> })
            // Use the AI's planned land count to set hard limits
            if (parsed.data.planned_lands) {
              this.setLandPlan(parsed.data.planned_lands)
            }
          }
        }
        this.state = 'CARDS'
        continue
      }

      if (this.state === 'CARDS' && this.buffer.includes('===CARDS===')) {
        this.buffer = this.buffer.split('===CARDS===')[1]
        events.push({ type: 'phase_start', data: { phase: 1, maxCards: this.maxNonLands } })
        continue
      }

      if (this.state === 'CARDS' && this.buffer.includes('===END_CARDS===')) {
        const remaining = this.buffer.split('===END_CARDS===')[0]
        this.buffer = this.buffer.split('===END_CARDS===')[1]
        if (this.nonLandCount < this.maxNonLands) {
          const lastCard = this.extractAndValidateCard(remaining, 1)
          if (lastCard) {
            this.nonLandCount++
            events.push({ type: 'card', data: lastCard })
          }
        }
        this.state = 'BETWEEN_CARDS_LANDS'
        continue
      }

      if (this.state === 'CARDS') {
        // If we've hit the non-land limit, skip ahead to ===END_CARDS=== marker
        if (this.nonLandCount >= this.maxNonLands) {
          if (this.buffer.includes('===END_CARDS===')) {
            this.buffer = this.buffer.split('===END_CARDS===')[1]
            this.state = 'BETWEEN_CARDS_LANDS'
            continue
          }
          // Discard buffer content while waiting for marker (keep last 100 chars for partial marker detection)
          if (this.buffer.length > 100) {
            this.buffer = this.buffer.slice(-100)
          }
          break
        }
        const newlineIdx = this.buffer.indexOf('\n')
        if (newlineIdx === -1) break
        const line = this.buffer.substring(0, newlineIdx).trim()
        this.buffer = this.buffer.substring(newlineIdx + 1)
        if (line.length === 0) continue
        const card = this.extractAndValidateCard(line, 1)
        if (card) {
          this.nonLandCount++
          events.push({ type: 'card', data: card })
        }
        continue
      }

      if (this.state === 'BETWEEN_CARDS_LANDS' && this.buffer.includes('===LANDS===')) {
        this.buffer = this.buffer.split('===LANDS===')[1]
        this.state = 'LANDS'
        events.push({ type: 'phase_start', data: { phase: 2, maxCards: this.maxLands } })
        continue
      }

      if (this.state === 'BETWEEN_CARDS_LANDS') {
        break
      }

      if (this.state === 'LANDS' && this.buffer.includes('===END_LANDS===')) {
        const remaining = this.buffer.split('===END_LANDS===')[0]
        this.buffer = this.buffer.split('===END_LANDS===')[1]
        if (this.landCount < this.maxLands) {
          const lastCard = this.extractAndValidateCard(remaining, 2)
          if (lastCard) {
            this.landCount++
            events.push({ type: 'card', data: lastCard })
          }
        }
        this.state = 'STRATEGY_SUMMARY'
        continue
      }

      if (this.state === 'LANDS') {
        // If we've hit the land limit, skip ahead to ===END_LANDS=== marker
        if (this.landCount >= this.maxLands) {
          if (this.buffer.includes('===END_LANDS===')) {
            this.buffer = this.buffer.split('===END_LANDS===')[1]
            this.state = 'STRATEGY_SUMMARY'
            continue
          }
          if (this.buffer.length > 100) {
            this.buffer = this.buffer.slice(-100)
          }
          break
        }
        const newlineIdx = this.buffer.indexOf('\n')
        if (newlineIdx === -1) break
        const line = this.buffer.substring(0, newlineIdx).trim()
        this.buffer = this.buffer.substring(newlineIdx + 1)
        if (line.length === 0) continue
        const card = this.extractAndValidateCard(line, 2)
        if (card) {
          this.landCount++
          events.push({ type: 'card', data: card })
        }
        continue
      }

      if (this.state === 'STRATEGY_SUMMARY' && this.buffer.includes('===END_STRATEGY_SUMMARY===')) {
        let content = this.buffer
        if (content.includes('===STRATEGY_SUMMARY===')) {
          content = content.split('===STRATEGY_SUMMARY===').pop() ?? ''
        }
        content = content.split('===END_STRATEGY_SUMMARY===')[0]
        const json = this.extractJSON(content)
        if (json) {
          const parsed = StrategySummarySchema.safeParse(json)
          if (parsed.success) {
            events.push({ type: 'strategy_summary', data: parsed.data as unknown as Record<string, unknown> })
          }
        }
        events.push({ type: 'done', data: {} })
        this.state = 'DONE'
        break
      }

      break
    }

    return events
  }

  private extractJSON(text: string): Record<string, unknown> | null {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      return match ? JSON.parse(match[0]) : null
    } catch {
      return null
    }
  }

  private extractAndValidateCard(line: string, phase?: number): Record<string, unknown> | null {
    const json = this.extractJSONLine(line)
    if (!json) return null
    if (phase !== undefined) json.phase = phase
    const parsed = CardEventSchema.safeParse(json)
    return parsed.success ? (parsed.data as unknown as Record<string, unknown>) : null
  }

  private extractJSONLine(line: string): Record<string, unknown> | null {
    try {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) return null
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }
}

// ─── Spiciness helper ────────────────────────────────────────────────────────

function getSpicyPrompt(spiciness: number): string {
  if (spiciness <= 15) return 'Build a meta-optimal, competitive deck using the most powerful and efficient staples available.'
  if (spiciness <= 35) return 'Build a tuned deck that is strong and consistent but not necessarily top-tier competitive.'
  if (spiciness <= 65) return 'Build a balanced deck mixing strong cards with interesting and fun choices.'
  if (spiciness <= 85) return 'Build a spicy deck favoring creative, unexpected, and underplayed card choices over raw power.'
  return 'Build a jank deck prioritizing wild, weird, and hilarious card choices. Embrace chaos and fun over winning.'
}

// ─── SSE helpers ────────────────────────────────────────────────────────────

const encoder = new TextEncoder()

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
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
    const { commanderId, description, targetBracket, budgetLimitCents, spiciness = 30 } = body

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

    // 6. Build prompts
    const SYSTEM_PROMPT = `You are a Magic: The Gathering deck builder. Generate a 99-card Commander deck (the commander is the 100th card and is NOT included in your output).

Commander: ${commanderName}
Commander Colors: ${colorIdentity.join(', ')}
Target Bracket: ${bracket}
Strategy: ${description ?? 'Build the strongest synergistic deck for this commander.'}
${budgetLimitCents ? `Budget Limit: $${(budgetLimitCents / 100).toFixed(2)}` : ''}

${getSpicyPrompt(spiciness)}

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

    const userPrompt = 'Generate the deck now.'

    // 7. Build SSE streaming response
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
          const parser = new StreamParser()

          if (streamingClient.provider === 'anthropic') {
            const anthropicClient = streamingClient.client as Anthropic
            const messageStream = anthropicClient.messages.stream({
              model: streamingClient.model,
              max_tokens: streamingClient.maxTokens,
              messages: [{ role: 'user', content: userPrompt }],
              system: SYSTEM_PROMPT,
            })

            for await (const event of messageStream) {
              if (request.signal.aborted) break
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const parsed = parser.processChunk(event.delta.text)
                for (const evt of parsed) {
                  controller.enqueue(encoder.encode(formatSSE(evt.type, evt.data)))
                }
              }
            }
          } else {
            // OpenAI provider
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const openaiClient = streamingClient.client as any
            const completion = await openaiClient.chat.completions.create({
              model: streamingClient.model,
              max_tokens: streamingClient.maxTokens,
              stream: true,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
            })

            for await (const chunk of completion) {
              if (request.signal.aborted) break
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                const parsed = parser.processChunk(content)
                for (const evt of parsed) {
                  controller.enqueue(encoder.encode(formatSSE(evt.type, evt.data)))
                }
              }
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generation failed'
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
    console.error('Generate deck stream error:', error)
    return new Response(
      JSON.stringify({ error: 'Generate deck stream failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
