'use client'

import React, { useEffect, useRef } from 'react'
import { CopyIcon, DownloadIcon, ImageIcon, CheckIcon } from '../ui/Icons'

interface MoveHistoryProps {
  history: string[]
  onCopyPGN: () => void
  onDownloadPGN: () => void
  onExportPNG: () => void
  copiedPGN: boolean
}

export function MoveHistory({
  history,
  onCopyPGN,
  onDownloadPGN,
  onExportPNG,
  copiedPGN,
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on move
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history.length])

  // Group into pairs: [White, Black]
  const pairs: { number: number; white: string; black?: string }[] = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    })
  }

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#14161D] border border-white/[0.08] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-[#111318] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Move Log</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 font-mono">
            {history.length} ply
          </span>
        </div>

        {/* Quick action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopyPGN}
            className="p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition"
            title="Copy PGN notation"
          >
            {copiedPGN ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onDownloadPGN}
            className="p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition"
            title="Download .PGN file"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onExportPNG}
            className="p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition"
            title="Export Board as PNG"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Moves Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono select-text"
        style={{ minHeight: '140px', maxHeight: '260px' }}
      >
        {pairs.length === 0 ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 text-zinc-500">
            <span className="text-lg mb-1">⚔️</span>
            <p className="text-xs">Game in opening position.</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">White makes the opening move.</p>
          </div>
        ) : (
          pairs.map((p, idx) => {
            const isLatest = idx === pairs.length - 1
            return (
              <div
                key={p.number}
                className={`grid grid-cols-12 py-1 px-2.5 rounded transition ${
                  isLatest ? 'bg-yellow-500/10 text-yellow-300' : 'hover:bg-white/[0.03] text-zinc-300'
                }`}
              >
                <span className="col-span-2 text-zinc-500 font-semibold">{p.number}.</span>
                <span className={`col-span-5 font-semibold ${isLatest && !p.black ? 'text-yellow-400' : ''}`}>
                  {p.white}
                </span>
                <span className={`col-span-5 font-semibold ${isLatest && p.black ? 'text-yellow-400' : ''}`}>
                  {p.black ?? ''}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-white/[0.06] bg-[#0F1116] flex items-center justify-between text-[11px] text-zinc-400">
        <span>Standard SAN Notation</span>
        <span>Stockfish 16 Engine</span>
      </div>
    </div>
  )
}
