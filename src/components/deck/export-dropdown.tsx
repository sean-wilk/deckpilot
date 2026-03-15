'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportMTGO, exportArena } from '@/lib/export/text-export'

interface ExportDropdownProps {
  cards: { quantity: number; name: string; setCode?: string; isCommander?: boolean; isSideboard?: boolean }[]
}

export function ExportDropdown({ cards }: ExportDropdownProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleExport(format: 'mtgo' | 'arena') {
    const text = format === 'mtgo' ? exportMTGO(cards) : exportArena(cards)
    await navigator.clipboard.writeText(text)
    setOpen(false)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        {copied ? 'Copied!' : 'Export'}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('mtgo')}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Export MTGO
            </button>
            <button
              onClick={() => handleExport('arena')}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Export Arena
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
