'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { DeckDetailsTab } from '@/components/deck/deck-details-tab'

// ─── Dynamic imports ───────────────────────────────────────────────────────────
// These components are created by parallel agents — dynamic imports ensure this
// file compiles even if they aren't on disk yet at type-check time.

const AnalysisTabContent = dynamic(
  () => import('@/components/ai/analysis-tab-content').then((m) => ({ default: m.AnalysisTabContent })),
  { loading: () => <TabLoadingState label="Analysis" />, ssr: false }
)

const RecommendationsTabContent = dynamic(
  () => import('@/components/ai/recommendations-tab-content').then((m) => ({ default: m.RecommendationsTabContent })),
  { loading: () => <TabLoadingState label="Recommendations" />, ssr: false }
)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeckContentTabsProps {
  deckId: string
  targetBracket: number
  cardCount: number
  philosophy?: string | null
  archetype?: string | null
  isOwner?: boolean
  activeTab?: string
  onTabChange?: (tab: string) => void
  children?: React.ReactNode // for DeckCardGrid and sideboard section
}

type TabId = 'deck' | 'analysis' | 'recommendations' | 'details'

interface Tab {
  id: TabId
  label: string
  notificationKey: string
}

const TABS: Tab[] = [
  { id: 'deck', label: 'Deck', notificationKey: '' },
  { id: 'analysis', label: 'Analysis', notificationKey: 'analysis' },
  { id: 'recommendations', label: 'Recommendations', notificationKey: 'recommendations' },
  { id: 'details', label: 'Details', notificationKey: '' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TabLoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Loading {label}…</p>
    </div>
  )
}

// ─── Notification dot ─────────────────────────────────────────────────────────

function NotificationDot() {
  return (
    <span
      className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-blue-500 ring-1 ring-background"
      aria-hidden="true"
    />
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

interface TabButtonProps {
  tab: Tab
  isActive: boolean
  hasNotification: boolean
  onClick: () => void
}

function TabButton({ tab, isActive, hasNotification, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-150',
        'whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'border-b-2',
        isActive
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
      )}
    >
      <span className="relative">
        {tab.label}
        {hasNotification && !isActive && <NotificationDot />}
      </span>
    </button>
  )
}

// ─── DeckContentTabs ──────────────────────────────────────────────────────────

export function DeckContentTabs({
  deckId,
  targetBracket,
  cardCount,
  philosophy = null,
  archetype = null,
  isOwner = false,
  activeTab,
  onTabChange,
  children,
}: DeckContentTabsProps) {
  const [activeTabId, setActiveTabId] = useState<TabId>((activeTab as TabId) ?? 'deck')
  const [recommendationsFocus, setRecommendationsFocus] = useState<string | undefined>(undefined)
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    analysis: false,
    recommendations: false,
  })

  // Sync with external activeTab prop
  useEffect(() => {
    if (activeTab && activeTab !== activeTabId) {
      setActiveTabId(activeTab as TabId) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for saved AI data on mount to show notification dots
  useEffect(() => {
    if (!deckId) return

    async function checkSavedData() {
      try {
        const [analysisRes, recsRes] = await Promise.allSettled([
          fetch(`/api/decks/${deckId}/analysis/saved`, { method: 'HEAD' }),
          fetch(`/api/decks/${deckId}/recommendations/saved`, { method: 'HEAD' }),
        ])

        setNotifications({
          analysis: analysisRes.status === 'fulfilled' && analysisRes.value.ok,
          recommendations: recsRes.status === 'fulfilled' && recsRes.value.ok,
        })
      } catch {
        // Silently ignore — notification dots are a nice-to-have
      }
    }

    void checkSavedData()
  }, [deckId])

  function handleTabChange(tabId: TabId) {
    setActiveTabId(tabId)
    onTabChange?.(tabId)
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Deck sections"
        className="flex items-end gap-0 border-b border-border mb-6 -mx-1 px-1"
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTabId === tab.id}
            hasNotification={tab.notificationKey ? notifications[tab.notificationKey] ?? false : false}
            onClick={() => handleTabChange(tab.id)}
          />
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex-1 min-h-0">
        {/* Deck tab — renders children (DeckCardGrid + sideboard section) */}
        {activeTabId === 'deck' && (
          <div role="tabpanel" aria-label="Deck">
            {children}
          </div>
        )}

        {/* Analysis tab */}
        {activeTabId === 'analysis' && (
          <div role="tabpanel" aria-label="Analysis">
            <AnalysisTabContent
              deckId={deckId}
              cardCount={cardCount}
              targetBracket={targetBracket}
              onSwitchToRecommendations={(focus) => {
                handleTabChange('recommendations')
                setRecommendationsFocus(focus)
              }}
            />
          </div>
        )}

        {/* Recommendations tab */}
        {activeTabId === 'recommendations' && (
          <div role="tabpanel" aria-label="Recommendations">
            <RecommendationsTabContent
              deckId={deckId}
              cardCount={cardCount}
              focus={recommendationsFocus}
            />
          </div>
        )}

        {/* Details tab */}
        {activeTabId === 'details' && (
          <div role="tabpanel" aria-label="Details">
            <DeckDetailsTab
              deckId={deckId}
              philosophy={philosophy}
              archetype={archetype}
              isOwner={isOwner}
            />
          </div>
        )}
      </div>
    </div>
  )
}
