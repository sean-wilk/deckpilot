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
  const [showToast, setShowToast] = useState(false)

  async function handleExport(format: 'mtgo' | 'arena') {
    const text = format === 'mtgo' ? exportMTGO(cards) : exportArena(cards)
    await navigator.clipboard.writeText(text)
    setOpen(false)
    setCopied(true)
    setShowToast(true)
    setTimeout(() => {
      setCopied(false)
      setShowToast(false)
    }, 2000)
  }

  function handleDownload(format: 'mtgo' | 'arena') {
    const text = format === 'mtgo' ? exportMTGO(cards) : exportArena(cards)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `deck-${format}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    setOpen(false)
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
        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('mtgo')}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Copy MTGO
            </button>
            <button
              onClick={() => handleExport('arena')}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Copy Arena
            </button>
            <button
              onClick={() => handleDownload('mtgo')}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Download MTGO .txt
            </button>
            <button
              onClick={() => handleDownload('arena')}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Download Arena .txt
            </button>
          </div>
        </div>
      )}

      {showToast && (
        <div className="absolute right-0 mt-2 px-3 py-2 rounded-md bg-green-700 text-white text-sm shadow-lg z-20 transition-opacity duration-500">
          Copied to clipboard!
        </div>
      )}
    </div>
  )
}
