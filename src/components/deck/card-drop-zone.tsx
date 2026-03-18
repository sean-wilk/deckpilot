'use client'

import { useState, useRef, useTransition, useCallback, DragEvent, ChangeEvent } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { addCardToDeck } from '@/app/(dashboard)/decks/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardDropZoneProps {
  deckId: string
  onCardAdded?: () => void
}

interface IdentifiedCard {
  id: string
  name: string
  imageUrl: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resizeImage(file: File, maxDim = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Resize failed'))),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── CardDropZone ─────────────────────────────────────────────────────────────

export function CardDropZone({ deckId, onCardAdded }: CardDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [identifying, setIdentifying] = useState(false)
  const [identified, setIdentified] = useState<IdentifiedCard | null>(null)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Only PNG, JPEG, and WebP images are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be under 10 MB.')
      return
    }

    setIdentifying(true)
    setIdentified(null)

    try {
      const resized = await resizeImage(file)
      const formData = new FormData()
      formData.append('image', resized, 'card.jpg')

      const res = await fetch('/api/ai/identify-card', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? 'Failed to identify card.')
        return
      }

      const data = await res.json()

      if (!data?.cardId) {
        toast.error(data?.reason ?? 'Card not found in the database.')
        return
      }

      setIdentified({
        id: data.cardId,
        name: data.cardName ?? 'Unknown Card',
        imageUrl: data.imageUri ?? null,
      })
    } catch (err) {
      toast.error('Something went wrong identifying the card.')
      console.error('[CardDropZone] identify error', err)
    } finally {
      setIdentifying(false)
    }
  }, [])

  // ─── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  // ─── Confirm add ────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!identified) return
    startTransition(async () => {
      try {
        const result = await addCardToDeck(deckId, identified.id)
        if (result && 'error' in result) {
          toast.error(result.error)
          return
        }
        toast.success(`${identified.name} added to deck.`)
        setIdentified(null)
        onCardAdded?.()
      } catch (err) {
        toast.error('Failed to add card to deck.')
        console.error('[CardDropZone] addCardToDeck error', err)
      }
    })
  }

  function handleCancel() {
    setIdentified(null)
  }

  // ─── Render: confirmation state ─────────────────────────────────────────────

  if (identified) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3">
        <div className="flex gap-3 items-start">
          {identified.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identified.imageUrl}
              alt={identified.name}
              className="w-14 rounded-md shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-14 h-[78px] rounded-md shrink-0 bg-muted flex items-center justify-center">
              <Camera className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Identified card</p>
            <p className="text-sm font-semibold text-foreground leading-snug">{identified.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleConfirm}>
            Add to Deck
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: idle / loading state ───────────────────────────────────────────

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop a card photo to identify it"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !identifying && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !identifying) inputRef.current?.click()
      }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2',
        'min-h-[200px] rounded-lg border-2 border-dashed',
        'transition-colors duration-150 cursor-pointer select-none',
        dragOver
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/60',
        identifying && 'pointer-events-none opacity-70',
      )}
    >
      {identifying ? (
        <>
          <Spinner />
          <span className="text-xs font-medium">Identifying card...</span>
        </>
      ) : (
        <>
          <Camera className={cn('size-7 transition-colors', dragOver && 'text-primary')} />
          <span className="text-xs font-medium text-center px-4">
            Drop a card photo to identify it
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs mt-1 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
            tabIndex={-1}
          >
            Choose File
          </Button>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
