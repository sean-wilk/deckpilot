'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { updatePreferredPrinting } from '@/app/(dashboard)/decks/actions'

interface Printing {
  scryfallId: string
  name: string
  setCode: string
  setName: string
  imageUris: Record<string, string> | null
  prices: Record<string, string | null> | null
  releasedAt: string
}

interface PrintingSelectorProps {
  cardId: string
  deckCardId?: string
  onSelect?: (printing: Printing) => void
}

export function PrintingSelector({ cardId, deckCardId, onSelect }: PrintingSelectorProps) {
  const [printings, setPrintings] = useState<Printing[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    fetch(`/api/cards/${cardId}/printings`)
      .then(res => res.json())
      .then(data => {
        // API returns array directly (not wrapped in { printings: [] })
        const list: Printing[] = Array.isArray(data) ? data : (data.printings ?? [])
        setPrintings(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [cardId])

  function handleSelect(printing: Printing, idx: number) {
    setSelectedIdx(idx)
    onSelect?.(printing)
    if (deckCardId && printing.imageUris) {
      updatePreferredPrinting(deckCardId, printing.imageUris).catch(console.error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span className="animate-pulse">Loading printings…</span>
      </div>
    )
  }

  if (printings.length === 0) return null

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
        Printings
      </p>
      {/* Horizontal scrollable row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {printings.map((printing, idx) => {
          const price = printing.prices?.usd ?? null
          const isSelected = idx === selectedIdx

          return (
            <button
              key={printing.scryfallId}
              type="button"
              onClick={() => handleSelect(printing, idx)}
              title={`${printing.setName} (${printing.releasedAt.slice(0, 4)})`}
              className={cn(
                'flex flex-col items-center gap-1',
                'flex-shrink-0 w-16',
                'rounded-lg border px-1.5 py-2',
                'text-center transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                isSelected
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:bg-white/10 hover:text-white',
              )}
            >
              {/* Set code badge */}
              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                {printing.setCode}
              </span>

              {/* Year */}
              <span className="text-[9px] text-white/40 leading-none">
                {printing.releasedAt.slice(0, 4)}
              </span>

              {/* Price */}
              {price != null ? (
                <span
                  className={cn(
                    'text-[10px] font-semibold leading-none',
                    isSelected ? 'text-emerald-400' : 'text-white/50',
                  )}
                >
                  ${price}
                </span>
              ) : (
                <span className="text-[9px] text-white/25 leading-none">—</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
