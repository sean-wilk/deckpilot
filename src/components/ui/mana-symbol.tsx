'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

const SCRYFALL_SVG_BASE = 'https://svgs.scryfall.io/card-symbols'

interface ManaSymbolProps {
  symbol?: string  // W, U, B, R, G, C, 0-20, X, T, etc.
  color?: string   // backward compat alias for symbol
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = { xs: 16, sm: 20, md: 24, lg: 32 }

export function ManaSymbol({ symbol, color, size = 'sm', className }: ManaSymbolProps) {
  const key = symbol ?? color ?? 'C'
  const px = SIZE_MAP[size]
  const src = `${SCRYFALL_SVG_BASE}/${encodeURIComponent(key)}.svg`
  return (
    <Image
      src={src}
      alt={key}
      width={px}
      height={px}
      className={cn('inline-block', className)}
      unoptimized
    />
  )
}

export interface ManaSymbolRowProps {
  colors: string[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function ManaSymbolRow({ colors, size = 'sm', className }: ManaSymbolRowProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {colors.map((c, i) => (
        <ManaSymbol key={i} symbol={c} size={size} />
      ))}
    </span>
  )
}

// Keep MANA_COLORS export for backward compat
export const MANA_COLORS: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
}

// Keep ManaSymbolProps export for backward compat
export type { ManaSymbolProps }
