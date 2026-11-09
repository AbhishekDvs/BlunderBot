'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/theme/ThemeContext'
import { soundService } from '@/theme/soundService'
import {
  CrownIcon,
  SkullIcon,
  SwordsIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  RestartIcon,
  EyeIcon,
  CheckIcon,
} from '../ui/Icons'

interface GameResultModalProps {
  isOpen: boolean
  resultType: 'win' | 'loss' | 'draw'
  resultTitle: string
  resultSubtitle: string
  moveCount: number
  pgn: string
  onPlayAgain: () => void
  onCopyPGN: () => void
  onDownloadPGN: () => void
  onExportPNG: () => void
  onClose: () => void
  copiedPGN: boolean
}

export function GameResultModal({
  isOpen,
  resultType,
  resultTitle,
  resultSubtitle,
  moveCount,
  pgn,
  onPlayAgain,
  onCopyPGN,
  onDownloadPGN,
  onExportPNG,
  onClose,
  copiedPGN,
}: GameResultModalProps) {
  const { settings } = useTheme()

  useEffect(() => {
    if (isOpen) {
      soundService.playGameOver(resultType, settings.soundEnabled)
    }
  }, [isOpen, resultType, settings.soundEnabled])

  if (!isOpen) return null

  const isWin = resultType === 'win'
  const isLoss = resultType === 'loss'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-lg rounded-2xl bg-[#14161F] border border-white/10 text-white shadow-2xl shadow-black/90 overflow-hidden"
        >
          {/* Top Decorative Banner */}
          <div
            className={`h-2 w-full ${
              isWin
                ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600'
                : isLoss
                ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-700'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'
            }`}
          />

          <div className="p-6 sm:p-8 text-center space-y-6">
            {/* Outcome Icon with glowing ring */}
            <div className="flex justify-center">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center border shadow-xl ${
                  isWin
                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400 shadow-yellow-500/10'
                    : isLoss
                    ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-red-500/10'
                    : 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-blue-500/10'
                }`}
              >
                {isWin ? (
                  <CrownIcon className="w-10 h-10" />
                ) : isLoss ? (
                  <SkullIcon className="w-10 h-10" />
                ) : (
                  <SwordsIcon className="w-10 h-10" />
                )}
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest font-semibold text-zinc-400">
                Match Concluded
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{resultTitle}</h2>
              <p className="text-sm text-zinc-300 max-w-md mx-auto">{resultSubtitle}</p>
            </div>

            {/* Match Stats Strip */}
            <div className="grid grid-cols-2 gap-3 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
              <div>
                <span className="text-zinc-500 block">Total Moves</span>
                <span className="font-mono font-bold text-sm text-white">{moveCount} moves</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Engine Result</span>
                <span className="font-mono font-bold text-sm text-yellow-400 capitalize">
                  {resultType}
                </span>
              </div>
            </div>

            {/* PGN mini preview */}
            {pgn && (
              <div className="text-left bg-black/40 rounded-xl p-3 border border-white/[0.06] max-h-24 overflow-y-auto text-[11px] font-mono text-zinc-400 select-all">
                {pgn}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onPlayAgain}
                className="col-span-full py-3 px-5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-sm shadow-lg shadow-yellow-500/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <RestartIcon className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={onCopyPGN}
                className="py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                {copiedPGN ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                <span>{copiedPGN ? 'PGN Copied' : 'Copy PGN'}</span>
              </button>

              <button
                type="button"
                onClick={onDownloadPGN}
                className="py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>Download PGN</span>
              </button>

              <button
                type="button"
                onClick={onExportPNG}
                className="py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Export Board Image</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-zinc-300 font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <EyeIcon className="w-4 h-4" />
                <span>Review Final Position</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
