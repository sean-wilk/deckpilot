'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { logMatch, getMatches } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchResult = 'win' | 'loss' | 'draw'

interface Match {
  id: string
  deckId: string
  playedAt: Date | string
  result: string
  playerCount: number
  turnCount: number | null
  notes: string | null
  opponentCommanders: string[] | null
  createdAt: Date | string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function resultBadge(result: string) {
  if (result === 'win')  return { label: 'Win',  classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  if (result === 'loss') return { label: 'Loss', classes: 'bg-red-100 text-red-700 border-red-200' }
  return { label: 'Draw', classes: 'bg-slate-100 text-slate-600 border-slate-200' }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeStats(matches: Match[]) {
  const total = matches.length
  const wins  = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const draws  = matches.filter(m => m.result === 'draw').length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  return { total, wins, losses, draws, winRate }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const params = useParams<{ id: string }>()
  const deckId = params.id

  // Form state
  const [result, setResult] = useState<MatchResult>('win')
  const [playerCount, setPlayerCount] = useState('4')
  const [turnCount, setTurnCount] = useState('')
  const [notes, setNotes] = useState('')
  const [opponents, setOpponents] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // Match history state
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)

  const [isPending, startTransition] = useTransition()

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true)
    try {
      const rows = await getMatches(deckId)
      setMatches(rows as Match[])
    } catch {
      // silently ignore — user may not be authenticated yet
    } finally {
      setLoadingMatches(false)
    }
  }, [deckId])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    const fd = new FormData()
    fd.append('result', result)
    fd.append('playerCount', playerCount)
    if (turnCount) fd.append('turnCount', turnCount)
    if (notes.trim()) fd.append('notes', notes.trim())
    if (opponents.trim()) fd.append('opponents', opponents.trim())

    startTransition(async () => {
      try {
        await logMatch(deckId, fd)
        setFormSuccess(true)
        setTurnCount('')
        setNotes('')
        setOpponents('')
        await loadMatches()
        setTimeout(() => setFormSuccess(false), 3000)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to log match')
      }
    })
  }

  const stats = computeStats(matches)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/decks/${deckId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Deck
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Match Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your game results over time</p>
        </div>
      </div>

      {/* Stats strip */}
      {matches.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Games', value: stats.total },
            { label: 'Wins',  value: stats.wins,   color: 'text-emerald-600' },
            { label: 'Losses', value: stats.losses, color: 'text-red-600' },
            { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? 'text-emerald-600' : 'text-muted-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border bg-card p-4 text-center">
              <div className={`text-2xl font-bold tabular-nums ${color ?? 'text-foreground'}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Log a match form */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold">Log a Match</h2>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Result */}
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-2">Result</legend>
            <div className="flex gap-2">
              {(['win', 'loss', 'draw'] as MatchResult[]).map((r) => (
                <label
                  key={r}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all select-none',
                    result === r
                      ? r === 'win'  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : r === 'loss' ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-400 bg-slate-100 text-slate-700'
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="result"
                    value={r}
                    checked={result === r}
                    onChange={() => setResult(r)}
                    className="sr-only"
                  />
                  {r === 'win' && (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {r === 'loss' && (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {r === 'draw' && (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                    </svg>
                  )}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Player count + Turn count */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="playerCount">
                Player Count
              </label>
              <select
                id="playerCount"
                name="playerCount"
                value={playerCount}
                onChange={e => setPlayerCount(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n} players</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="turnCount">
                Turn Count <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="turnCount"
                name="turnCount"
                type="number"
                min="1"
                max="100"
                value={turnCount}
                onChange={e => setTurnCount(e.target.value)}
                placeholder="e.g. 12"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Opponent commanders */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="opponents">
              Opponent Commanders <span className="text-muted-foreground font-normal">(optional, comma-separated)</span>
            </label>
            <input
              id="opponents"
              name="opponents"
              type="text"
              value={opponents}
              onChange={e => setOpponents(e.target.value)}
              placeholder="e.g. Atraxa, Omnath, Korvold"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="notes">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did the game go?"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Error / success */}
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Match logged successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <>
                <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </>
            ) : 'Log Match'}
          </button>
        </form>
      </div>

      {/* Match history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Match History</h2>

        {loadingMatches && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-muted/30 h-16 animate-pulse" />
            ))}
          </div>
        )}

        {!loadingMatches && matches.length === 0 && (
          <div className="rounded-xl border bg-muted/20 p-10 text-center">
            <p className="text-sm text-muted-foreground">No matches logged yet. Log your first game above.</p>
          </div>
        )}

        {!loadingMatches && matches.map((match) => {
          const badge = resultBadge(match.result)
          return (
            <div
              key={match.id}
              className="rounded-xl border bg-card px-4 py-3 flex items-start gap-4"
            >
              {/* Result badge */}
              <span className={`mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md border ${badge.classes}`}>
                {badge.label}
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-foreground font-medium">
                    {match.playerCount}-player game
                    {match.turnCount ? ` · ${match.turnCount} turns` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(match.playedAt)}</span>
                </div>

                {match.opponentCommanders && match.opponentCommanders.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    vs. {match.opponentCommanders.join(', ')}
                  </p>
                )}

                {match.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{match.notes}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
