'use client'

import { useState } from 'react'
import { toggleAiProvider, deleteAiProvider } from './actions'
import { Button } from '@/components/ui/button'

interface ProviderActionsProps {
  id: string
  isActive: boolean
}

export function ProviderActions({ id, isActive }: ProviderActionsProps) {
  const [pending, setPending] = useState(false)

  async function handleToggle() {
    setPending(true)
    try {
      await toggleAiProvider(id, !isActive)
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this AI provider configuration? This cannot be undone.')) return
    setPending(true)
    try {
      await deleteAiProvider(id)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={pending}
      >
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        Delete
      </Button>
    </div>
  )
}
