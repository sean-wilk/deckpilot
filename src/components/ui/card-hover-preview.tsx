'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// Module-level cache to avoid re-fetching the same card
const imageCache = new Map<string, string | null>()
const largeImageCache = new Map<string, string | null>()

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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [largeImageUrl, setLargeImageUrl] = useState<string | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCardImage = useCallback(async (name: string) => {
    if (imageCache.has(name)) {
      return imageCache.get(name) ?? null
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&exact=true&limit=1`)
      if (!res.ok) {
        imageCache.set(name, null)
        largeImageCache.set(name, null)
        return null
      }
      const data = await res.json() as {
        cards: Array<{
          image_uris?: { small?: string; normal?: string; large?: string }
          imageUris?: { small?: string; normal?: string; large?: string }
          card_faces?: Array<{ image_uris?: { small?: string; normal?: string; large?: string } }>
          cardFaces?: Array<{ image_uris?: { small?: string; normal?: string; large?: string } }>
        }>
      }
      const card = data.cards?.[0]
      if (!card) {
        imageCache.set(name, null)
        largeImageCache.set(name, null)
        return null
      }

      // Handle both camelCase (Drizzle ORM) and snake_case (raw SQL) response shapes
      const imgs = card.image_uris ?? card.imageUris
      const faces = card.card_faces ?? card.cardFaces

      const smallUri =
        imgs?.small ??
        imgs?.normal ??
        faces?.[0]?.image_uris?.small ??
        faces?.[0]?.image_uris?.normal ??
        null

      const largeUri =
        imgs?.normal ??
        imgs?.large ??
        faces?.[0]?.image_uris?.normal ??
        faces?.[0]?.image_uris?.large ??
        null

      imageCache.set(name, smallUri)
      largeImageCache.set(name, largeUri)
      return smallUri
    } catch {
      imageCache.set(name, null)
      largeImageCache.set(name, null)
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

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Check large image cache first
    if (largeImageCache.has(cardName)) {
      setLargeImageUrl(largeImageCache.get(cardName) ?? null)
      setLightboxOpen(true)
      return
    }

    // Fetch if needed (fetchCardImage also populates largeImageCache)
    await fetchCardImage(cardName)
    const url = largeImageCache.get(cardName) ?? null
    setLargeImageUrl(url)
    setLightboxOpen(true)
  }, [cardName, fetchCardImage])

  // ESC key closes lightbox
  useEffect(() => {
    if (!lightboxOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen])

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
            <span className="text-2xs text-muted-foreground px-2 text-center leading-tight">
              {cardName}
            </span>
          </div>
        )}
      </div>
    </div>
  ) : null

  const lightbox = lightboxOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setLightboxOpen(false)}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {largeImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={largeImageUrl}
            alt={cardName}
            className="rounded-xl shadow-2xl max-h-[80vh] w-auto"
          />
        ) : (
          <div className="w-64 h-96 bg-muted rounded-xl flex items-center justify-center">
            <span className="text-sm text-muted-foreground">{cardName}</span>
          </div>
        )}
        <button
          onClick={() => setLightboxOpen(false)}
          className="absolute -top-3 -right-3 size-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
        <p className="text-center text-sm text-white/80 mt-3 font-medium">{cardName}</p>
      </div>
    </div>
  ) : null

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="cursor-pointer"
      >
        {children}
      </span>
      {typeof document !== 'undefined' && popover
        ? createPortal(popover, document.body)
        : null}
      {typeof document !== 'undefined' && lightbox
        ? createPortal(lightbox, document.body)
        : null}
    </>
  )
}
