'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// Module-level cache to avoid re-fetching the same card
const imageCache = new Map<string, string | null>()

interface CardHoverPreviewProps {
  cardName: string
  children: React.ReactNode
}

interface PopoverPosition {
  top: number
  left: number
}

export function CardHoverPreview({ cardName, children }: CardHoverPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCardImage = useCallback(async (name: string) => {
    if (imageCache.has(name)) {
      return imageCache.get(name) ?? null
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&limit=1`)
      if (!res.ok) {
        imageCache.set(name, null)
        return null
      }
      const data = await res.json() as {
        cards: Array<{
          image_uris?: { small?: string; normal?: string }
          card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>
        }>
      }
      const card = data.cards?.[0]
      if (!card) {
        imageCache.set(name, null)
        return null
      }

      // Handle double-faced cards
      const uri =
        card.image_uris?.small ??
        card.image_uris?.normal ??
        card.card_faces?.[0]?.image_uris?.small ??
        card.card_faces?.[0]?.image_uris?.normal ??
        null

      imageCache.set(name, uri)
      return uri
    } catch {
      imageCache.set(name, null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return { top: 0, left: 0 }
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverWidth = 146
    const popoverHeight = 204
    const gap = 8

    let top = rect.top - popoverHeight - gap
    let left = rect.left + rect.width / 2 - popoverWidth / 2

    // Flip below if not enough space above
    if (top < 8) {
      top = rect.bottom + gap
    }

    // Clamp horizontally within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8))

    return { top, left }
  }, [])

  const handleMouseEnter = useCallback(async () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    setPosition(computePosition())
    setVisible(true)

    const url = await fetchCardImage(cardName)
    setImageUrl(url)

    // Recompute position after image loads (same dimensions, but just in case)
    setPosition(computePosition())
  }, [cardName, fetchCardImage, computePosition])

  const handleMouseLeave = useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      setImageUrl(null)
      setLoading(false)
    }, 80)
  }, [])

  const popover = visible ? (
    <div
      className="pointer-events-none fixed z-50"
      style={{ top: position.top, left: position.left }}
    >
      <div
        className={cn(
          'rounded-lg overflow-hidden shadow-2xl ring-1 ring-black/20',
          'transition-opacity duration-150',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: 146, height: 204 }}
      >
        {loading && !imageUrl ? (
          <div className="w-full h-full bg-muted animate-pulse rounded-lg" />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={cardName}
            width={146}
            height={204}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center rounded-lg">
            <span className="text-[10px] text-muted-foreground px-2 text-center leading-tight">
              {cardName}
            </span>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && popover
        ? createPortal(popover, document.body)
        : null}
    </>
  )
}
