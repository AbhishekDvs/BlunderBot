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
    <div className="tactical-panel flex flex-col h-full rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[#202832] bg-[#11151B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#F5F6F8]">Move History</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1C232D] text-[#84919D] font-mono border border-[#283341]">
            {history.length} ply
          </span>
        </div>

        {/* Quick action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopyPGN}
            className="p-1.5 rounded-lg hover:bg-[#202832] text-[#84919D] hover:text-[#F5F6F8] transition"
            title="Copy PGN notation"
            aria-label="Copy PGN notation"
          >
            {copiedPGN ? <CheckIcon className="w-3.5 h-3.5 text-[#438A69]" /> : <CopyIcon className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDownloadPGN}
            className="p-1.5 rounded-lg hover:bg-[#202832] text-[#84919D] hover:text-[#F5F6F8] transition"
            title="Download .PGN file"
            aria-label="Download .PGN file"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExportPNG}
            className="p-1.5 rounded-lg hover:bg-[#202832] text-[#84919D] hover:text-[#F5F6F8] transition"
            title="Export Board as PNG"
            aria-label="Export Board as PNG"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Moves Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono select-text"
        style={{ minHeight: '130px', maxHeight: '240px' }}
      >
        {pairs.length === 0 ? (
          <div className="h-full min-h-[130px] flex flex-col items-center justify-center text-center p-4 text-[#84919D]">
            <span className="text-lg mb-1">⚔️</span>
            <p className="text-xs text-[#F5F6F8]">Game in opening position.</p>
            <p className="text-[11px] text-[#84919D] mt-0.5">White makes the opening move.</p>
          </div>
        ) : (
          pairs.map((p, idx) => {
            const isLatest = idx === pairs.length - 1
            return (
              <div
                key={p.number}
                className={`grid grid-cols-12 py-1 px-2.5 rounded transition ${
                  isLatest ? 'bg-[#DDAA57]/15 text-[#DDAA57]' : 'hover:bg-[#1C232D]/50 text-[#F5F6F8]'
                }`}
              >
                <span className="col-span-2 text-[#84919D] font-semibold">{p.number}.</span>
                <span className={`col-span-5 font-semibold ${isLatest && !p.black ? 'text-[#DDAA57]' : ''}`}>
                  {p.white}
                </span>
                <span className={`col-span-5 font-semibold ${isLatest && p.black ? 'text-[#DDAA57]' : ''}`}>
                  {p.black ?? ''}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3.5 py-1.5 border-t border-[#202832] bg-[#11151B] flex items-center justify-between text-[10px] text-[#84919D]">
        <span>Standard SAN Notation</span>
        <span className="font-mono">Stockfish 16</span>
      </div>
    </div>
  )
}
