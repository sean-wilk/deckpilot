'use client'

/**
 * Lightweight dropdown menu — no external dependencies.
 * Renders into a portal to avoid overflow clipping.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// ─── Context ──────────────────────────────────────────────────────────────────

interface DropdownCtx {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownContext = createContext<DropdownCtx | null>(null)

function useDropdown() {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('useDropdown must be used within DropdownMenu')
  return ctx
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface DropdownMenuProps {
  children: ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </DropdownContext.Provider>
  )
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface DropdownMenuTriggerProps {
  children: ReactNode
  asChild?: boolean
  className?: string
}

export function DropdownMenuTrigger({ children, className }: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdown()

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        setOpen(!open)
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      {children}
    </button>
  )
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface DropdownMenuContentProps {
  children: ReactNode
  className?: string
  align?: 'start' | 'end'
  sideOffset?: number
}

export function DropdownMenuContent({
  children,
  className,
  align = 'end',
  sideOffset = 4,
}: DropdownMenuContentProps) {
  const { open, setOpen, triggerRef } = useDropdown()
  const contentRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  // SSR guard — lazy initializer avoids setState-in-effect lint rule
  const [mounted] = useState(() => typeof window !== 'undefined')

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger || !contentRef.current) return
    const rect = trigger.getBoundingClientRect()
    const menuRect = contentRef.current.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    const top = rect.bottom + scrollY + sideOffset
    let left =
      align === 'end'
        ? rect.right + scrollX - menuRect.width
        : rect.left + scrollX

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8))

    setCoords({ top, left })
  }, [align, sideOffset, triggerRef])

  useEffect(() => {
    if (!open) return
    // Position on next frame after paint so menuRect is available
    const frame = requestAnimationFrame(positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    window.addEventListener('resize', positionMenu)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', positionMenu, true)
      window.removeEventListener('resize', positionMenu)
    }
  }, [open, positionMenu])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        contentRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, setOpen, triggerRef])

  // Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, setOpen, triggerRef])

  if (!mounted || !open) return null

  return createPortal(
    <div
      ref={contentRef}
      role="menu"
      aria-orientation="vertical"
      style={{ top: coords.top, left: coords.left }}
      className={cn(
        'fixed z-[9999] min-w-[10rem] overflow-hidden',
        'rounded-md border border-border bg-popover text-popover-foreground',
        'shadow-lg shadow-black/20',
        'py-1',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface DropdownMenuItemProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
  inset?: boolean
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
  disabled,
  inset,
}: DropdownMenuItemProps) {
  const { setOpen } = useDropdown()

  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2',
        'px-2 py-1.5 text-sm outline-none',
        'transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        inset && 'pl-8',
        className,
      )}
      onClick={() => {
        onClick?.()
        setOpen(false)
      }}
    >
      {children}
    </button>
  )
}

// ─── Separator ────────────────────────────────────────────────────────────────

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn('my-1 h-px bg-border mx-1', className)}
    />
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────

export function DropdownMenuLabel({
  children,
  className,
  inset,
}: {
  children: ReactNode
  className?: string
  inset?: boolean
}) {
  return (
    <div
      className={cn(
        'px-2 py-1 text-xs font-semibold text-muted-foreground',
        inset && 'pl-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Sub menu (simplified — opens inline, not nested portal) ─────────────────

interface DropdownMenuSubProps {
  trigger: ReactNode
  children: ReactNode
  className?: string
}

export function DropdownMenuSub({ trigger, children, className }: DropdownMenuSubProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={cn(
          'relative flex w-full cursor-default select-none items-center gap-2',
          'px-2 py-1.5 text-sm outline-none',
          'transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          className,
        )}
      >
        {trigger}
        <svg className="ml-auto size-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
      {open && (
        <div
          className={cn(
            'absolute left-full top-0 -mt-1 ml-1 z-10 min-w-[10rem]',
            'rounded-md border border-border bg-popover text-popover-foreground',
            'shadow-lg shadow-black/20 py-1',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
