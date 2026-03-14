'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Search, X, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CardImageUris, CardFace } from '@/types/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchCard {
  id: string
  name: string
  typeLine: string
  imageUris?: CardImageUris | null
  cardFaces?: CardFace[] | null
  manaCost?: string | null
  colorIdentity: string[]
}

export interface CommanderSearchProps {
  label?: string
  placeholder?: string
  onChange: (card: SearchCard | null) => void
  defaultValue?: SearchCard | null
  name?: string
  required?: boolean
}

// ─── Color identity pip helpers ───────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
  W: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  U: 'bg-blue-500 border-blue-600 text-white',
  B: 'bg-gray-800 border-gray-600 text-gray-100',
  R: 'bg-red-500 border-red-600 text-white',
  G: 'bg-green-600 border-green-700 text-white',
  C: 'bg-gray-400 border-gray-500 text-white',
}

const COLOR_LABELS: Record<string, string> = {
  W: 'W', U: 'U', B: 'B', R: 'R', G: 'G', C: 'C',
}

function ColorPip({ color }: { color: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-full border text-[9px] font-bold leading-none',
        COLOR_CLASSES[color] ?? 'bg-gray-200 border-gray-300 text-gray-700'
      )}
      aria-label={color}
    >
      {COLOR_LABELS[color] ?? color}
    </span>
  )
}

// ─── Small card art thumbnail ─────────────────────────────────────────────────

function CardThumb({ card, size = 36 }: { card: SearchCard; size?: number }) {
  const face = card.cardFaces?.[0]
  const uris = card.imageUris ?? face?.image_uris
  const src = uris?.art_crop ?? uris?.small ?? null

  if (!src) {
    return (
      <div
        className="shrink-0 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
      >
        {card.name[0]}
      </div>
    )
  }

  return (
    <div
      className="shrink-0 rounded overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={card.name}
        width={size}
        height={size}
        className="object-cover w-full h-full"
      />
    </div>
  )
}

// ─── Selected commander preview ───────────────────────────────────────────────

function CommanderPreview({
  card,
  onClear,
}: {
  card: SearchCard
  onClear: () => void
}) {
  const face = card.cardFaces?.[0]
  const uris = card.imageUris ?? face?.image_uris
  const artSrc = uris?.art_crop ?? uris?.normal ?? null

  return (
    <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
      {artSrc && (
        <div className="relative h-24 w-full overflow-hidden">
          <Image
            src={artSrc}
            alt={card.name}
            fill
            className="object-cover object-[center_25%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/20 to-transparent" />
        </div>
      )}
      <div className="px-3 py-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{card.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.typeLine}</p>
          {card.colorIdentity.length > 0 && (
            <div className="flex gap-0.5 mt-1.5">
              {card.colorIdentity.map((c) => (
                <ColorPip key={c} color={c} />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear commander selection"
          className="shrink-0 mt-0.5 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── CommanderSearch ──────────────────────────────────────────────────────────

export function CommanderSearch({
  label = 'Commander',
  placeholder = 'Search for a commander…',
  onChange,
  defaultValue = null,
  name = 'commanderId',
  required = false,
}: CommanderSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchCard[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<SearchCard | null>(defaultValue)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}&limit=20`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.cards ?? [])
      setIsOpen(true)
      setActiveIndex(-1)
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Click outside to close
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleSelect(card: SearchCard) {
    setSelected(card)
    setQuery('')
    setResults([])
    setIsOpen(false)
    onChange(card)
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    onChange(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${name}-input`}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Hidden input carries the selected ID for form submission */}
      <input type="hidden" name={name} value={selected?.id ?? ''} />

      {selected ? (
        <CommanderPreview card={selected} onClear={handleClear} />
      ) : (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              id={`${name}-input`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              placeholder={placeholder}
              autoComplete="off"
              className="pl-9 pr-9"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
              </div>
            )}
            {!isLoading && query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setIsOpen(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Commander search results"
                className="max-h-64 overflow-y-auto py-1"
              >
                {results.map((card, i) => (
                  <li
                    key={card.id}
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => handleSelect(card)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                      i === activeIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    <CardThumb card={card} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground leading-tight truncate mt-0.5">
                        {card.typeLine}
                      </p>
                    </div>
                    {card.colorIdentity.length > 0 && (
                      <div className="flex gap-0.5 shrink-0">
                        {card.colorIdentity.slice(0, 5).map((c) => (
                          <ColorPip key={c} color={c} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOpen && !isLoading && results.length === 0 && query.length >= 2 && (
            <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-xl px-4 py-3">
              <p className="text-sm text-muted-foreground">No commanders found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
