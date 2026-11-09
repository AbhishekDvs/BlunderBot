'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PromotionModalProps {
  isOpen: boolean
  color: 'w' | 'b'
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}

const PROMOTION_PIECES: { code: 'q' | 'r' | 'b' | 'n'; name: string; key: string; symbol: { w: string; b: string } }[] = [
  { code: 'q', name: 'Queen', key: 'Q', symbol: { w: '♕', b: '♛' } },
  { code: 'r', name: 'Rook', key: 'R', symbol: { w: '♖', b: '♜' } },
  { code: 'b', name: 'Bishop', key: 'B', symbol: { w: '♗', b: '♝' } },
  { code: 'n', name: 'Knight', key: 'N', symbol: { w: '♘', b: '♞' } },
]

export function PromotionModal({ isOpen, color, onSelect, onCancel }: PromotionModalProps) {
  // Support keyboard selection (Q, R, B, N, or Escape to cancel)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'q') onSelect('q')
      else if (key === 'r') onSelect('r')
      else if (key === 'b') onSelect('b')
      else if (key === 'n') onSelect('n')
      else if (key === 'escape') onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onSelect, onCancel])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="relative rounded-2xl bg-[#161822] border border-yellow-500/40 p-5 shadow-2xl text-center max-w-xs w-full space-y-4"
        >
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">Pawn Promotion</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Select a rank advancement or press hotkey</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PROMOTION_PIECES.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => onSelect(p.code)}
                className="group flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.04] hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/60 transition active:scale-95"
              >
                <span className="text-3xl text-white group-hover:scale-110 transition select-none">
                  {p.symbol[color]}
                </span>
                <span className="text-[11px] font-bold text-zinc-300 mt-1">{p.name}</span>
                <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 mt-1 font-mono">
                  {p.key}
                </kbd>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Cancel Move (Esc)
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
