import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewDeckForm } from './new-deck-form'

export const metadata = {
  title: 'New Deck — DeckPilot',
}

export default function NewDeckPage() {
  return (
    <div className="max-w-xl mx-auto">
      {/* Back nav */}
      <Link
        href="/decks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        My Decks
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">New Deck</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose a commander and configure your deck settings.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <NewDeckForm />
      </div>
    </div>
  )
}
