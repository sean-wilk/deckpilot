'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { DeckSettingsDialog } from '@/components/deck/deck-settings-dialog'

interface DeckSettingsButtonProps {
  deck: {
    id: string
    name: string
    description: string | null
    targetBracket: number
    budgetLimitCents: number | null
  }
}

export function DeckSettingsButton({ deck }: DeckSettingsButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
        aria-label="Deck settings"
      >
        <Settings className="size-3.5" />
      </button>
      <DeckSettingsDialog deck={deck} open={open} onOpenChange={setOpen} />
    </>
  )
}
