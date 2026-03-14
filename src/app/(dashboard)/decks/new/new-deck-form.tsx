'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CommanderSearch } from '@/components/deck/commander-search'
import { Loader2, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createDeck } from '../actions'

// ─── Bracket selector ─────────────────────────────────────────────────────────

const BRACKETS = [
  { value: 1, label: 'B1', sublabel: 'Casual', description: 'Precon-power or below' },
  { value: 2, label: 'B2', sublabel: 'Focused', description: 'Upgraded, no combos' },
  { value: 3, label: 'B3', sublabel: 'Optimized', description: 'Powerful synergies' },
  { value: 4, label: 'B4', sublabel: 'cEDH', description: 'Competitive play' },
]

const BRACKET_ACCENT: Record<number, string> = {
  1: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  2: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  3: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  4: 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400',
}

const BRACKET_UNSELECTED =
  'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:bg-muted/40'

function BracketSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        Target Bracket <span className="text-destructive">*</span>
      </Label>
      <div className="grid grid-cols-4 gap-2">
        {BRACKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3 transition-all duration-150 cursor-pointer select-none',
              value === b.value ? BRACKET_ACCENT[b.value] : BRACKET_UNSELECTED
            )}
          >
            <span className="text-sm font-bold leading-none">{b.label}</span>
            <span className="text-[11px] font-medium leading-none">{b.sublabel}</span>
            <span className="text-[10px] leading-snug text-center opacity-70 mt-0.5 hidden sm:block">
              {b.description}
            </span>
          </button>
        ))}
      </div>
      {/* Hidden input for form submission */}
      <input type="hidden" name="targetBracket" value={value} />
    </div>
  )
}

// ─── NewDeckForm ──────────────────────────────────────────────────────────────

export function NewDeckForm() {
  const [bracket, setBracket] = useState(2)
  const [commanderSelected, setCommanderSelected] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!commanderSelected) {
      setError('Please select a commander.')
      return
    }

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createDeck(formData)
      } catch (err: unknown) {
        // createDeck redirects on success — if we get here it's an error
        if (err instanceof Error && err.message !== 'NEXT_REDIRECT') {
          setError(err.message || 'Something went wrong. Please try again.')
        }
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Deck name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Deck Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Atraxa Superfriends"
          required
          maxLength={120}
          autoComplete="off"
        />
      </div>

      {/* Commander search */}
      <CommanderSearch
        name="commanderId"
        label="Commander"
        placeholder="Search by name…"
        required
        onChange={(card) => setCommanderSelected(!!card)}
      />

      {/* Bracket */}
      <BracketSelector value={bracket} onChange={setBracket} />

      {/* Budget */}
      <div className="space-y-1.5">
        <Label htmlFor="budgetInput">
          Budget Limit{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="budgetInput"
            name="budgetLimitCents"
            type="number"
            placeholder="e.g. 500"
            min={0}
            step={1}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the total budget in dollars. Leave blank for no limit.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Creating…
            </>
          ) : (
            'Create Deck'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/decks')}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
