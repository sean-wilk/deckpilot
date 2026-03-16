'use client'

import { CardHoverPreview } from '@/components/ui/card-hover-preview'
import { cn } from '@/lib/utils'

interface AnalysisTextWithCardsProps {
  text: string
  cardNames: string[] // list of known card names in the deck
  className?: string
}

/**
 * Parses analysis text and wraps any card name matches in CardHoverPreview.
 * Uses a case-insensitive split approach — no complex regex.
 */
export function AnalysisTextWithCards({
  text,
  cardNames,
  className,
}: AnalysisTextWithCardsProps) {
  if (!text) return null
  if (!cardNames.length) {
    return <span className={className}>{text}</span>
  }

  // Sort by length descending so longer names match before shorter substrings
  const sortedNames = [...cardNames].sort((a, b) => b.length - a.length)

  // Build segments: array of { text, cardName? }
  type Segment = { text: string; cardName?: string }
  const segments: Segment[] = [{ text }]

  for (const cardName of sortedNames) {
    const lower = cardName.toLowerCase()
    const next: Segment[] = []

    for (const seg of segments) {
      // Only split plain text segments (not already-matched card segments)
      if (seg.cardName !== undefined) {
        next.push(seg)
        continue
      }

      const lowerSeg = seg.text.toLowerCase()
      let remaining = seg.text
      let lowerRemaining = lowerSeg
      let offset = 0

      while (true) {
        const idx = lowerRemaining.indexOf(lower, offset)
        if (idx === -1) {
          // No more matches — push the rest as plain text
          if (remaining.length > 0) {
            next.push({ text: remaining })
          }
          break
        }

        // Push text before the match
        if (idx > 0) {
          next.push({ text: remaining.slice(0, idx) })
        }

        // Push the matched card segment (preserve original casing from source text)
        const matched = remaining.slice(idx, idx + cardName.length)
        next.push({ text: matched, cardName })

        // Advance past the match
        remaining = remaining.slice(idx + cardName.length)
        lowerRemaining = lowerRemaining.slice(idx + cardName.length)
        offset = 0
      }
    }

    segments.length = 0
    segments.push(...next)
  }

  return (
    <span className={cn(className)}>
      {segments.map((seg, i) =>
        seg.cardName !== undefined ? (
          <CardHoverPreview key={i} cardName={seg.cardName}>
            <span className="underline decoration-dotted cursor-help text-foreground">
              {seg.text}
            </span>
          </CardHoverPreview>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}
