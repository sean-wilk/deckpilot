'use client'

import { useRef, useState } from 'react'
import { addAiProvider } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ANTHROPIC_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]

const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
]

const DEFAULT_MODELS: Record<string, string[]> = {
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
}

export function AddProviderForm() {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('anthropic')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const models = DEFAULT_MODELS[provider] ?? ANTHROPIC_MODELS
  const defaultModel = models[1] ?? models[0]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      await addAiProvider(formData)
      formRef.current?.reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider')
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Add AI Provider</Button>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Add AI Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                name="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelAnalysis">Analysis Model</Label>
              <select
                id="modelAnalysis"
                name="modelAnalysis"
                defaultValue={defaultModel}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelRecommendations">Recommendations Model</Label>
              <select
                id="modelRecommendations"
                name="modelRecommendations"
                defaultValue={defaultModel}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelChat">Chat Model</Label>
              <select
                id="modelChat"
                name="modelChat"
                defaultValue={defaultModel}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelGeneration">Generation Model</Label>
              <select
                id="modelGeneration"
                name="modelGeneration"
                defaultValue={defaultModel}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usageLimitDailyCents">Daily Usage Limit (cents, optional)</Label>
            <Input
              id="usageLimitDailyCents"
              name="usageLimitDailyCents"
              type="number"
              min="0"
              placeholder="e.g. 500 = $5.00"
              className="max-w-xs"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Provider'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setError(null) }}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
