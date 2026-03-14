'use client'

import { useState, useRef, useTransition, useCallback, useEffect } from 'react'
import { CardImage } from '@/components/cards/card-image'
import { cn } from '@/lib/utils'
import { addCardToDeck } from '@/app/(dashboard)/decks/actions'
import type { CardData } from '@/types/card'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AddCardBarProps {
  deckId: string
  className?: string
}

// ─── Result row ───────────────────────────────────────────────────────────────

interface ResultRowProps {
  card: CardData
  onAdd: (card: CardData) => void
  adding: boolean
}

function ResultRow({ card, onAdd, adding }: ResultRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 cursor-pointer',
        'transition-colors duration-100',
        'hover:bg-accent',
        adding && 'opacity-50 pointer-events-none',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onAdd(card)}
      role="option"
      aria-selected={false}
    >
      {/* Mini card preview */}
      <div className="shrink-0 relative" style={{ width: 36, height: 50 }}>
        <CardImage
          name={card.name}
          imageUris={card.image_uris}
          cardFaces={card.card_faces}
          size="small"
          className={cn(
            'transition-transform duration-200 rounded-sm overflow-hidden !w-full !h-full',
            hovered && 'scale-110',
          )}
        />
      </div>

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{card.name}</div>
        <div className="text-xs text-muted-foreground truncate">{card.type_line}</div>
      </div>

      {/* CMC + rarity */}
      <div className="flex items-center gap-2 shrink-0">
        {card.mana_cost && (
          <span className="text-xs text-muted-foreground font-mono">{card.mana_cost}</span>
        )}
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
          card.rarity === 'mythic'   && 'bg-orange-100 text-orange-700',
          card.rarity === 'rare'     && 'bg-amber-100 text-amber-700',
          card.rarity === 'uncommon' && 'bg-slate-100 text-slate-600',
          card.rarity === 'common'   && 'bg-zinc-100 text-zinc-500',
        )}>
          {card.rarity?.charAt(0).toUpperCase()}
        </span>
        {card.prices?.usd && (
          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
            ${card.prices.usd}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── AddCardBar ───────────────────────────────────────────────────────────────

export function AddCardBar({ deckId, className }: AddCardBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CardData[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim() || q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data?.cards ?? data ?? [])
          setOpen(true)
        }
      } catch {
        // silently ignore network errors
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  useEffect(() => {
    search(query)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleAdd(card: CardData) {
    setAddingId(card.id)
    startTransition(async () => {
      try {
        await addCardToDeck(deckId, card.id)
        setQuery('')
        setResults([])
        setOpen(false)
      } finally {
        setAddingId(null)
      }
    })
  }

  return (
    <div ref={containerRef} className={cn('relative w-full max-w-xl', className)}>
      {/* Search input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {loading ? (
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search for a card to add..."
          className={cn(
            'w-full pl-9 pr-4 py-2 text-sm rounded-lg',
            'bg-background border border-input',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'transition-all duration-150',
          )}
          aria-label="Search cards"
          aria-autocomplete="list"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-1 z-50',
            'bg-popover border border-border rounded-lg shadow-xl',
            'max-h-80 overflow-y-auto',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
          role="listbox"
          aria-label="Card search results"
        >
          {results.slice(0, 12).map((card) => (
            <ResultRow
              key={card.id}
              card={card}
              onAdd={handleAdd}
              adding={addingId === card.id}
            />
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl px-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">No cards found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
