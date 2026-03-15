'use client'

import { startTransition, useState } from 'react'
import { updateDeck, deleteDeck } from '@/app/(dashboard)/decks/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DeckSettingsDialogProps {
  deck: {
    id: string
    name: string
    description: string | null
    targetBracket: number
    budgetLimitCents: number | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

const BRACKET_OPTIONS = [
  { value: 1, label: 'Precon' },
  { value: 2, label: 'Casual' },
  { value: 3, label: 'Focused' },
  { value: 4, label: 'Competitive' },
]

export function DeckSettingsDialog({ deck, open, onOpenChange }: DeckSettingsDialogProps) {
  const [name, setName] = useState(deck.name)
  const [description, setDescription] = useState(deck.description ?? '')
  const [targetBracket, setTargetBracket] = useState(deck.targetBracket)
  const [budgetDollars, setBudgetDollars] = useState(
    deck.budgetLimitCents != null ? String(deck.budgetLimitCents / 100) : ''
  )
  const [isPending, setIsPending] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!open) return null

  function handleSave() {
    if (!name.trim()) return
    const formData = new FormData()
    formData.set('name', name.trim())
    formData.set('description', description)
    formData.set('targetBracket', String(targetBracket))
    if (budgetDollars !== '') {
      formData.set('budgetLimitCents', String(Math.round(parseFloat(budgetDollars) * 100)))
    }
    setIsPending(true)
    startTransition(async () => {
      await updateDeck(deck.id, formData)
      setIsPending(false)
      onOpenChange(false)
    })
  }

  function handleDelete() {
    setIsDeleting(true)
    startTransition(async () => {
      await deleteDeck(deck.id)
      setIsDeleting(false)
      onOpenChange(false)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-settings-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="deck-settings-title" className="text-base font-semibold text-foreground">
            Deck Settings
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Deck name */}
          <div className="space-y-1.5">
            <Label htmlFor="deck-name">
              Deck Name <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <Input
              id="deck-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter deck name"
              required
              aria-required="true"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="deck-description">Description</Label>
            <textarea
              id="deck-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your deck (optional)"
              rows={3}
              className="h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 resize-none"
            />
          </div>

          {/* Target bracket */}
          <div className="space-y-1.5">
            <Label htmlFor="deck-bracket">Target Bracket</Label>
            <select
              id="deck-bracket"
              value={targetBracket}
              onChange={e => setTargetBracket(Number(e.target.value))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {BRACKET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} — {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Budget limit */}
          <div className="space-y-1.5">
            <Label htmlFor="deck-budget">Budget Limit (USD)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="deck-budget"
                type="number"
                min="0"
                step="0.01"
                value={budgetDollars}
                onChange={e => setBudgetDollars(e.target.value)}
                placeholder="No limit"
                className="pl-6"
              />
            </div>
          </div>
        </div>

        {/* Footer — actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending || isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || isDeleting || !name.trim()}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>

        {/* Danger zone */}
        <div className="rounded-b-xl border-t border-border bg-destructive/5 px-6 py-5">
          <p className="mb-3 text-sm font-medium text-destructive">Danger Zone</p>

          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting…' : 'Yes, Delete Deck'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isPending || isDeleting}
            >
              Delete Deck
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
