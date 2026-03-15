'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { addCardToDeck, createDeckSnapshot } from '@/app/(dashboard)/decks/actions'

interface CardRecord {
  id: string
  name: string
  imageUris: unknown
  setCode: string
}

interface MatchedCard {
  quantity: number
  name: string
  setCode?: string
  isCommander?: boolean
  isSideboard?: boolean
  card: CardRecord
}

interface UnmatchedCard {
  quantity: number
  name: string
}

interface ImportResult {
  matched: MatchedCard[]
  unmatched: UnmatchedCard[]
  parseErrors: string[]
}

function getCardImageUrl(imageUris: unknown): string | null {
  if (!imageUris || typeof imageUris !== 'object') return null
  const uris = imageUris as Record<string, string>
  return uris.normal ?? uris.small ?? uris.large ?? null
}

export default function ImportPage() {
  const params = useParams()
  const deckId = params.id as string

  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleParse() {
    if (!text.trim()) return
    setIsParsing(true)
    setResult(null)
    setImportDone(false)
    setImportError(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Parse failed')
      setResult(data)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImport() {
    if (!result?.matched.length) return
    setIsImporting(true)
    setImportError(null)
    try {
      for (const match of result.matched) {
        await addCardToDeck(deckId, match.card.id)
      }
      await createDeckSnapshot(deckId, `Imported ${result.matched.length} cards from text list`)
      setImportDone(true)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/decks/${deckId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to deck
        </Link>
        <h1 className="text-2xl font-semibold">Import cards</h1>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="decklist">
          Paste deck list (MTGO or Arena format)
        </label>
        <textarea
          id="decklist"
          className="w-full h-64 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={"4 Lightning Bolt\n2 Counterspell (LEA)\n\nSideboard\n4 Pyroblast"}
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </div>

      <button
        onClick={handleParse}
        disabled={isParsing || !text.trim()}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isParsing ? 'Parsing…' : 'Parse'}
      </button>

      {importError && (
        <p className="text-sm text-destructive">{importError}</p>
      )}

      {result && (
        <div className="space-y-6">
          {result.parseErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 space-y-1">
              <p className="text-sm font-medium text-destructive">Parse warnings</p>
              {result.parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-destructive/80 font-mono">{e}</p>
              ))}
            </div>
          )}

          {result.matched.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium">
                Matched ({result.matched.length} card{result.matched.length !== 1 ? 's' : ''})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {result.matched.map((m, i) => {
                  const imageUrl = getCardImageUrl(m.card.imageUris)
                  return (
                    <div key={i} className="space-y-1">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt={m.card.name}
                          className="w-full rounded-md border border-border"
                        />
                      ) : (
                        <div className="w-full aspect-[63/88] rounded-md border border-border bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground text-center px-2">{m.card.name}</span>
                        </div>
                      )}
                      <p className="text-xs font-medium truncate">{m.quantity}x {m.card.name}</p>
                      {m.isSideboard && (
                        <span className="text-xs text-muted-foreground">Sideboard</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.unmatched.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-destructive">
                Unmatched ({result.unmatched.length} card{result.unmatched.length !== 1 ? 's' : ''})
              </h2>
              <ul className="rounded-md border border-destructive/50 divide-y divide-destructive/20">
                {result.unmatched.map((u, i) => (
                  <li key={i} className="px-3 py-2 text-sm font-mono">
                    {u.quantity}x {u.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importDone ? (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              {result.matched.length} card{result.matched.length !== 1 ? 's' : ''} imported successfully.{' '}
              <Link href={`/decks/${deckId}`} className="underline font-medium">
                View deck
              </Link>
            </div>
          ) : (
            <button
              onClick={handleImport}
              disabled={isImporting || result.matched.length === 0}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting
                ? 'Importing…'
                : `Import ${result.matched.length} matched card${result.matched.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
