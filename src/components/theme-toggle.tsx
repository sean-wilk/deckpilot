'use client'

import { useTheme } from '@/components/theme-provider'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

type Theme = 'light' | 'dark' | 'system'

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system']

const THEME_ICONS: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  system: '⚙',
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)

  function cycleTheme() {
    const currentIndex = THEME_CYCLE.indexOf(theme)
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length
    setTheme(THEME_CYCLE[nextIndex])
  }

  // Render a placeholder on server to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className={[
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5',
          'text-xs font-medium text-muted-foreground',
          'border border-border bg-background',
          className ?? '',
        ].join(' ')}
        aria-label="Toggle theme"
      >
        <span aria-hidden="true" className="text-sm leading-none">⚙</span>
        <span>Theme</span>
      </button>
    )
  }

  return (
    <button
      onClick={cycleTheme}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5',
        'text-xs font-medium text-muted-foreground',
        'border border-border bg-background',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className ?? '',
      ].join(' ')}
      title={`Theme: ${THEME_LABELS[theme]} — click to cycle`}
      aria-label={`Current theme: ${THEME_LABELS[theme]}. Click to change.`}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {THEME_ICONS[theme]}
      </span>
      <span>{THEME_LABELS[theme]}</span>
    </button>
  )
}
