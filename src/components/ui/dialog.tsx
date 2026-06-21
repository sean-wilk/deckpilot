'use client'

/**
 * Lightweight modal dialog — no external dependencies.
 * Renders into a portal with backdrop overlay.
 */

import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// ─── Dialog ──────────────────────────────────────────────────────────────────

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  // Prevent body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false)
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Content wrapper */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ─── Dialog Content ──────────────────────────────────────────────────────────

interface DialogContentProps {
  children: ReactNode
  className?: string
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'rounded-xl border border-border bg-popover text-popover-foreground',
        'shadow-xl shadow-black/30',
        'p-5 space-y-4',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Dialog Title ────────────────────────────────────────────────────────────

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h3 className={cn('text-sm font-semibold text-foreground', className)}>
      {children}
    </h3>
  )
}

// ─── Dialog Description ──────────────────────────────────────────────────────

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-xs text-muted-foreground leading-relaxed', className)}>
      {children}
    </p>
  )
}

// ─── Dialog Footer ───────────────────────────────────────────────────────────

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex justify-end gap-2 pt-2', className)}>
      {children}
    </div>
  )
}
