'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { CardImageUris, CardFace } from '@/types/card'

// ─── Size variants ────────────────────────────────────────────────────────────

type SizeVariant = 'small' | 'normal' | 'large'

const SIZE_MAP: Record<SizeVariant, { width: number; height: number }> = {
  small:  { width: 146,  height: 204  },
  normal: { width: 244,  height: 340  },
  large:  { width: 488,  height: 680  },
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CardImageProps {
  name: string
  imageUris?: CardImageUris | null
  cardFaces?: CardFace[] | null
  size?: SizeVariant
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(uris: CardImageUris, size: SizeVariant): string {
  // Fall back gracefully: large → normal → small → png
  if (size === 'large') return uris.large || uris.normal || uris.small || uris.png
  if (size === 'normal') return uris.normal || uris.small || uris.png
  return uris.small || uris.normal || uris.png
}

// ─── Single-face image ────────────────────────────────────────────────────────

interface SingleFaceProps {
  src: string
  alt: string
  size: SizeVariant
  className?: string
}

function SingleFaceImage({ src, alt, size, className }: SingleFaceProps) {
  const { width, height } = SIZE_MAP[size]
  return (
    <div
      className={cn('relative overflow-hidden rounded-[4.75%/3.4%]', className)}
      style={{ width, height }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${width}px`}
        loading="lazy"
        className="object-cover"
        draggable={false}
      />
    </div>
  )
}

// ─── Flip button icon ─────────────────────────────────────────────────────────

function FlipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

// ─── Dual-faced card ──────────────────────────────────────────────────────────

interface DualFaceProps {
  faces: [CardFace, CardFace]
  name: string
  size: SizeVariant
  className?: string
}

function DualFaceImage({ faces, name, size, className }: DualFaceProps) {
  const [flipped, setFlipped] = useState(false)
  const { width, height } = SIZE_MAP[size]

  const frontUris = faces[0].image_uris
  const backUris  = faces[1].image_uris

  // If a face is missing image_uris fall back to placeholder
  const frontSrc = frontUris ? resolveUrl(frontUris, size) : null
  const backSrc  = backUris  ? resolveUrl(backUris,  size) : null

  return (
    <div
      className={cn('relative select-none', className)}
      style={{ width, height }}
    >
      {/* Card flip container — perspective gives depth */}
      <div
        className="absolute inset-0"
        style={{
          perspective: `${width * 3}px`,
        }}
      >
        <div
          className="relative w-full h-full transition-transform duration-500 ease-in-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front face */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[4.75%/3.4%]"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            {frontSrc ? (
              <Image
                src={frontSrc}
                alt={`${faces[0].name} — front face of ${name}`}
                fill
                sizes={`${width}px`}
                loading="lazy"
                className="object-cover"
                draggable={false}
              />
            ) : (
              <CardImagePlaceholder name={faces[0].name} />
            )}
          </div>

          {/* Back face — pre-rotated so it appears correct after flip */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[4.75%/3.4%]"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {backSrc ? (
              <Image
                src={backSrc}
                alt={`${faces[1].name} — back face of ${name}`}
                fill
                sizes={`${width}px`}
                loading="lazy"
                className="object-cover"
                draggable={false}
              />
            ) : (
              <CardImagePlaceholder name={faces[1].name} />
            )}
          </div>
        </div>
      </div>

      {/* Flip control — uses div to avoid nested button hydration error */}
      <div
        role="switch"
        tabIndex={0}
        aria-checked={flipped}
        aria-label={flipped ? `Show front face of ${name}` : `Show back face of ${name}`}
        onClick={(e) => { e.stopPropagation(); setFlipped((f) => !f) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setFlipped((f) => !f) } }}
        className={cn(
          'absolute bottom-2 right-2 z-10 cursor-pointer',
          'flex items-center justify-center',
          'size-7 rounded-full',
          'bg-black/60 text-white backdrop-blur-sm',
          'border border-white/20',
          'shadow-lg',
          'transition-all duration-200',
          'hover:bg-black/80 hover:scale-110',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
          'active:scale-95',
        )}
      >
        <FlipIcon />
      </div>
    </div>
  )
}

// ─── Placeholder (no image uri available) ─────────────────────────────────────

interface PlaceholderProps {
  name: string
}

function CardImagePlaceholder({ name }: PlaceholderProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs text-center p-2 rounded-[inherit]">
      {name}
    </div>
  )
}

// ─── CardImageSkeleton ────────────────────────────────────────────────────────

export interface CardImageSkeletonProps {
  size?: SizeVariant
  className?: string
}

export function CardImageSkeleton({ size = 'normal', className }: CardImageSkeletonProps) {
  const { width, height } = SIZE_MAP[size]
  return (
    <div
      role="status"
      aria-label="Loading card image"
      className={cn(
        'animate-pulse rounded-[4.75%/3.4%] bg-muted',
        className,
      )}
      style={{ width, height }}
    />
  )
}

// ─── CardImage (main export) ──────────────────────────────────────────────────

export function CardImage({
  name,
  imageUris,
  cardFaces,
  size = 'normal',
  className,
}: CardImageProps) {
  // Dual-faced card: needs at least two faces each with image_uris OR the
  // component renders a placeholder per face gracefully.
  const isDfc =
    Array.isArray(cardFaces) &&
    cardFaces.length >= 2 &&
    (cardFaces[0].image_uris != null || cardFaces[1].image_uris != null)

  if (isDfc) {
    return (
      <DualFaceImage
        faces={[cardFaces![0], cardFaces![1]]}
        name={name}
        size={size}
        className={className}
      />
    )
  }

  // Normal card
  if (imageUris) {
    return (
      <SingleFaceImage
        src={resolveUrl(imageUris, size)}
        alt={name}
        size={size}
        className={className}
      />
    )
  }

  // Fallback: no image data at all
  const { width, height } = SIZE_MAP[size]
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[4.75%/3.4%] bg-muted',
        className,
      )}
      style={{ width, height }}
    >
      <CardImagePlaceholder name={name} />
    </div>
  )
}
