import { z } from 'zod'

// ─── Mini Zod schemas for SSE event validation ──────────────────────────────

export const CardEventSchema = z.object({
  index: z.number(),
  name: z.string().min(1),
  category: z.string(),
  reasoning: z.string(),
  phase: z.number().optional(),
})

export const BracketReasoningSchema = z.object({
  bracket: z.number(),
  reasoning: z.string(),
  planned_lands: z.number().optional(),
})

export const StrategySummarySchema = z.object({
  summary: z.string(),
  estimated_bracket: z.number(),
  total_cards: z.number(),
})

// ─── StreamParser ───────────────────────────────────────────────────────────

export type ParseState = 'INIT' | 'BRACKET_REASONING' | 'CARDS' | 'BETWEEN_CARDS_LANDS' | 'LANDS' | 'STRATEGY_SUMMARY' | 'DONE'

export class StreamParser {
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
