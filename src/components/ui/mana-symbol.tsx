'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ManaSymbolProps {
  color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export const MANA_COLORS: Record<
  ManaSymbolProps['color'],
  { bg: string; text: string; border: string; label: string }
> = {
  W: {
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-300',
    label: 'White',
  },
  U: {
    bg: 'bg-blue-500',
    text: 'text-white',
    border: 'border-blue-600',
    label: 'Blue',
  },
  B: {
    bg: 'bg-gray-900',
    text: 'text-gray-100',
    border: 'border-gray-700',
    label: 'Black',
  },
  R: {
    bg: 'bg-red-600',
    text: 'text-white',
    border: 'border-red-700',
    label: 'Red',
  },
  G: {
    bg: 'bg-green-600',
    text: 'text-white',
    border: 'border-green-700',
    label: 'Green',
  },
  C: {
    bg: 'bg-gray-400',
    text: 'text-gray-900',
    border: 'border-gray-500',
    label: 'Colorless',
  },
}

const sizeClasses: Record<NonNullable<ManaSymbolProps['size']>, string> = {
  xs: 'size-4 text-[9px]',
  sm: 'size-5 text-[10px]',
  md: 'size-6 text-xs',
  lg: 'size-8 text-sm',
}

export function ManaSymbol({ color, size = 'md', className }: ManaSymbolProps) {
  const { bg, text, border, label } = MANA_COLORS[color]

  return (
    <span
      role="img"
      aria-label={`${label} mana`}
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-bold leading-none select-none',
        bg,
        text,
        border,
        sizeClasses[size],
        className
      )}
    >
      {color}
    </span>
  )
}

export interface ManaSymbolRowProps {
  colors: string[]
  size?: ManaSymbolProps['size']
  className?: string
}

const VALID_COLORS = new Set<string>(['W', 'U', 'B', 'R', 'G', 'C'])

export function ManaSymbolRow({ colors, size = 'md', className }: ManaSymbolRowProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {colors.map((color, index) => {
        const upper = color.toUpperCase()
        if (!VALID_COLORS.has(upper)) return null
        return (
          <ManaSymbol
            key={index}
            color={upper as ManaSymbolProps['color']}
            size={size}
          />
        )
      })}
    </span>
  )
}
