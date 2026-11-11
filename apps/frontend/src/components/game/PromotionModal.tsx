'use client'

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'
import { useTheme } from '@/theme/ThemeContext'

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
  const systemReducedMotion = useReducedMotion()
  const { settings } = useTheme()
  const noMotion = systemReducedMotion || settings.animationDuration === 0
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useModalAccessibility(isOpen, dialogRef, onCancel)

  // Support keyboard piece selection (Q, R, B, N)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'q') onSelect('q')
      else if (key === 'r') onSelect('r')
      else if (key === 'b') onSelect('b')
      else if (key === 'n') onSelect('n')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onSelect])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promotion-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: noMotion ? 0 : 0.15 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Tactical Promotion Box */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={noMotion ? false : { opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={noMotion ? undefined : { opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: noMotion ? 0 : 0.18 }}
            className="relative rounded-2xl bg-[#151A22] border border-[#DDAA57]/60 p-5 shadow-2xl text-center max-w-xs w-full space-y-4"
          >
            <div>
              <h3 id="promotion-modal-title" className="text-base font-extrabold text-[#F5F6F8] tracking-tight">
                Pawn Promotion
              </h3>
              <p className="text-xs text-[#84919D] mt-0.5">Select a rank advancement or press hotkey</p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PROMOTION_PIECES.map((p, idx) => (
                <button
                  key={p.code}
                  type="button"
                  autoFocus={idx === 0}
                  aria-label={`Promote pawn to ${p.name} (shortcut ${p.key})`}
                  onClick={() => onSelect(p.code)}
                  className="group flex flex-col items-center justify-center p-3 rounded-xl bg-[#11151B] hover:bg-[#DDAA57]/15 border border-[#202832] hover:border-[#DDAA57]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] transition active:scale-95"
                >
                  <span className="text-3xl text-[#F5F6F8] group-hover:scale-110 transition select-none" aria-hidden="true">
                    {p.symbol[color]}
                  </span>
                  <span className="text-[11px] font-bold text-[#F5F6F8] mt-1">{p.name}</span>
                  <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-[#1C232D] text-[#84919D] mt-1 font-mono border border-[#283341]">
                    {p.key}
                  </kbd>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[#84919D] hover:text-[#F5F6F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] rounded px-2 py-1 transition"
            >
              Cancel Move (Esc)
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
