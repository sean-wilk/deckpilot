import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
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

      {/* AI Wizard Card */}
      <Link href="/decks/new/wizard">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-6 shadow-sm mb-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-foreground">Build with AI</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Let our AI wizard help you create a powerful deck from scratch based on your preferences.
              </p>
            </div>
          </div>
        </div>
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <NewDeckForm />
      </div>
    </div>
  )
}
