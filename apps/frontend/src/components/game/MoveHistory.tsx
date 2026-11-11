'use client'

import React, { useEffect, useRef } from 'react'
import { CopyIcon, DownloadIcon, ImageIcon, CheckIcon } from '../ui/Icons'

interface MoveHistoryProps {
  history: string[]
  onCopyPGN: () => void
  onDownloadPGN: () => void
  onExportPNG: () => void
  copiedPGN: boolean
  activePly?: number | null
  onSelectPly?: (ply: number | null) => void
}

export function MoveHistory({
  history,
  onCopyPGN,
  onDownloadPGN,
  onExportPNG,
  copiedPGN,
  activePly = null,
  onSelectPly,
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on live move if not in review
  useEffect(() => {
    if (activePly === null && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history.length, activePly])

  // Group into pairs: [White, Black]
  const pairs: { number: number; white: string; black?: string; whitePly: number; blackPly?: number }[] = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
      whitePly: i + 1,
      blackPly: history[i + 1] ? i + 2 : undefined,
    })
  }

  const currentPly = activePly ?? history.length
  const canNavigate = typeof onSelectPly === 'function'

  const handleStepFirst = () => onSelectPly?.(0)
  const handleStepPrev = () => onSelectPly?.(Math.max(0, currentPly - 1))
  const handleStepNext = () => {
    const next = Math.min(history.length, currentPly + 1)
    onSelectPly?.(next >= history.length ? null : next)
  }
  const handleStepLive = () => onSelectPly?.(null)

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canNavigate || history.length === 0) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handleStepPrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleStepNext()
    } else if (e.key === 'Home') {
      e.preventDefault()
      handleStepFirst()
    } else if (e.key === 'End') {
      e.preventDefault()
      handleStepLive()
    }
  }

  return (
    <div
      className="tactical-panel flex flex-col h-full rounded-2xl overflow-hidden shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57]"
      tabIndex={canNavigate ? 0 : undefined}
      onKeyDown={handlePanelKeyDown}
      aria-label="Match move history"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[#202832] bg-[#11151B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#F5F6F8]">Move History</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1C232D] text-[#84919D] font-mono border border-[#283341]">
            {history.length} ply
          </span>
          {activePly !== null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#DDAA57]/20 text-[#DDAA57] font-mono font-bold border border-[#DDAA57]/40">
              Reviewing
            </span>
          )}
        </div>

        {/* Quick action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopyPGN}
            className="p-1.5 rounded-lg hover:bg-[#202832] text-[#84919D] hover:text-[#F5F6F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] transition"
            title="Copy PGN notation"
            aria-label={copiedPGN ? 'PGN copied to clipboard' : 'Copy PGN notation'}
          >
            {copiedPGN ? <CheckIcon className="w-3.5 h-3.5 text-[#438A69]" /> : <CopyIcon className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDownloadPGN}
            className="p-1.5 rounded-lg hover:bg-[#202832] text-[#84919D] hover:text-[#F5F6F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] transition"
            title="Download .PGN file"
            aria-label="Download PGN file"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExportPNG}
            className="p-1.5 rounded-lg hover:bg-[#202832] text-[#84919D] hover:text-[#F5F6F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] transition"
            title="Export Board as PNG"
            aria-label="Export board as PNG image"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Moves Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono select-text"
        style={{ minHeight: '130px', maxHeight: '220px' }}
      >
        {pairs.length === 0 ? (
          <div className="h-full min-h-[130px] flex flex-col items-center justify-center text-center p-4 text-[#84919D]">
            <span className="text-lg mb-1" aria-hidden="true">⚔️</span>
            <p className="text-xs text-[#F5F6F8]">Game in opening position.</p>
            <p className="text-[11px] text-[#84919D] mt-0.5">White makes the opening move.</p>
          </div>
        ) : (
          pairs.map((p) => {
            const isWhiteActive = (activePly === null && p.whitePly === history.length && !p.black) || activePly === p.whitePly
            const isBlackActive = (activePly === null && p.blackPly === history.length) || (p.blackPly && activePly === p.blackPly)

            return (
              <div
                key={p.number}
                className="grid grid-cols-12 py-0.5 px-2 rounded transition hover:bg-[#1C232D]/30"
              >
                <span className="col-span-2 text-[#84919D] font-semibold flex items-center">
                  {p.number}.
                </span>

                {/* White Move */}
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => onSelectPly?.(p.whitePly)}
                  aria-label={`Move ${p.number} White: ${p.white}`}
                  className={`col-span-5 text-left px-1.5 py-0.5 rounded font-semibold transition ${
                    isWhiteActive
                      ? 'bg-[#DDAA57]/20 text-[#DDAA57] ring-1 ring-[#DDAA57]/50'
                      : canNavigate
                      ? 'text-[#F5F6F8] hover:text-[#DDAA57] hover:bg-white/[0.04]'
                      : 'text-[#F5F6F8] cursor-default'
                  }`}
                >
                  {p.white}
                </button>

                {/* Black Move */}
                {p.black ? (
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => p.blackPly && onSelectPly?.(p.blackPly)}
                    aria-label={`Move ${p.number} Black: ${p.black}`}
                    className={`col-span-5 text-left px-1.5 py-0.5 rounded font-semibold transition ${
                      isBlackActive
                        ? 'bg-[#DDAA57]/20 text-[#DDAA57] ring-1 ring-[#DDAA57]/50'
                        : canNavigate
                        ? 'text-[#F5F6F8] hover:text-[#DDAA57] hover:bg-white/[0.04]'
                        : 'text-[#F5F6F8] cursor-default'
                    }`}
                  >
                    {p.black}
                  </button>
                ) : (
                  <span className="col-span-5" />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Replay / Review Step Controls Bar (shown when navigation callback is wired) */}
      {history.length > 0 && canNavigate && (
        <div className="px-3 py-1.5 border-t border-[#202832] bg-[#0E1217] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleStepFirst}
              disabled={currentPly === 0}
              aria-label="First move"
              className="px-2 py-0.5 rounded hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] disabled:opacity-30 transition"
              title="First Move (|«)"
            >
              |«
            </button>
            <button
              type="button"
              onClick={handleStepPrev}
              disabled={currentPly === 0}
              aria-label="Previous move"
              className="px-2 py-0.5 rounded hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] disabled:opacity-30 transition"
              title="Previous Move (‹)"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleStepNext}
              disabled={currentPly >= history.length}
              aria-label="Next move"
              className="px-2 py-0.5 rounded hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] disabled:opacity-30 transition"
              title="Next Move (›)"
            >
              ›
            </button>
            <button
              type="button"
              onClick={handleStepLive}
              disabled={activePly === null}
              aria-label="Jump to live position"
              className="px-2 py-0.5 rounded hover:bg-[#1C232D] text-[#DDAA57] disabled:opacity-40 font-bold transition"
              title="Live Position (»|)"
            >
              »|
            </button>
          </div>

          <span className="text-[10px] text-[#84919D]">
            {activePly !== null ? `Ply ${activePly}/${history.length}` : 'Live Game'}
          </span>
        </div>
      )}

      {/* Footer Info */}
      <div className="px-3.5 py-1.5 border-t border-[#202832] bg-[#11151B] flex items-center justify-between text-[10px] text-[#84919D]">
        <span>{canNavigate ? 'Click move or use ‹ › keys' : 'Algebraic match log'}</span>
        <span className="font-mono">Stockfish 16</span>
      </div>
    </div>
  )
}
