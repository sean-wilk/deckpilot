'use client'

import { useCallback, useEffect, useRef } from 'react'
import { addCardToDeck, removeCardFromDeck, updateCardQuantity } from '@/app/(dashboard)/decks/actions'
import { toast } from 'sonner'

export type UndoAction =
  | { type: 'add'; deckId: string; cardId: string; deckCardId: string }
  | { type: 'remove'; deckId: string; cardId: string; cardName: string; quantity: number }
  | { type: 'quantity'; deckCardId: string; previousQuantity: number }

const MAX_UNDO = 20

export function useDeckUndo() {
  const stackRef = useRef<UndoAction[]>([])

  const pushUndo = useCallback((action: UndoAction) => {
    stackRef.current.push(action)
    if (stackRef.current.length > MAX_UNDO) {
      stackRef.current.shift()
    }
  }, [])

  const undo = useCallback(async () => {
    const action = stackRef.current.pop()
    if (!action) {
      toast.info('Nothing to undo')
      return
    }

    try {
      switch (action.type) {
        case 'add':
          // Undo an add = remove the card
          await removeCardFromDeck(action.deckId, action.deckCardId)
          toast.success('Undid add card')
          break
        case 'remove':
          // Undo a remove = add the card back
          await addCardToDeck(action.deckId, action.cardId)
          if (action.quantity > 1) {
            // Re-add adds with qty 1; full quantity restore would need extra logic
          }
          toast.success(`Undid remove ${action.cardName}`)
          break
        case 'quantity':
          // Undo a quantity change = set back to previous
          await updateCardQuantity(action.deckCardId, action.previousQuantity)
          toast.success('Undid quantity change')
          break
      }
    } catch (err) {
      toast.error('Undo failed')
      console.error('[undo]', err)
    }
  }, [])

  // Listen for Cmd/Ctrl+Z
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Don't undo if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return

        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [undo])

  return { pushUndo, undo }
}
