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
import { BRACKETS, BRACKET_ACCENT_COLORS } from '@/lib/constants/brackets'

// ─── Bracket selector ─────────────────────────────────────────────────────────

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
      <div className="grid grid-cols-5 gap-2">
        {BRACKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3 transition-all duration-150 cursor-pointer select-none',
              value === b.value ? BRACKET_ACCENT_COLORS[b.value] : BRACKET_UNSELECTED
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
  const [importAfterCreate, setImportAfterCreate] = useState(false)
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
        const { id } = await createDeck(formData)
        const destination = importAfterCreate ? `/decks/${id}/import` : `/decks/${id}`
        router.push(destination)
      } catch (err: unknown) {
        if (err instanceof Error) {
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

      {/* Import after creation */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="importAfterCreate"
          checked={importAfterCreate}
          onChange={(e) => setImportAfterCreate(e.target.checked)}
          className="size-4 rounded border-border accent-primary cursor-pointer"
        />
        <Label htmlFor="importAfterCreate" className="cursor-pointer font-normal">
          Import a deck list after creation
        </Label>
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
