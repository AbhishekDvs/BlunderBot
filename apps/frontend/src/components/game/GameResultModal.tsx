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
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-lg rounded-2xl bg-[#151A22] border border-[#2D3847] text-[#F5F6F8] shadow-2xl shadow-black/95 overflow-hidden"
        >
          {/* Top Decorative Banner */}
          <div
            className={`h-2 w-full ${
              isWin
                ? 'bg-gradient-to-r from-[#DDAA57] via-[#F3CE89] to-[#DDAA57]'
                : isLoss
                ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-700'
                : 'bg-gradient-to-r from-[#438A69] via-emerald-400 to-[#438A69]'
            }`}
          />

          <div className="p-6 sm:p-8 text-center space-y-6">
            {/* Outcome Icon with glowing ring */}
            <div className="flex justify-center">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center border shadow-xl ${
                  isWin
                    ? 'bg-[#DDAA57]/15 border-[#DDAA57]/50 text-[#DDAA57] shadow-[#DDAA57]/20'
                    : isLoss
                    ? 'bg-red-500/15 border-red-500/50 text-red-400 shadow-red-500/20'
                    : 'bg-[#438A69]/15 border-[#438A69]/50 text-emerald-400 shadow-[#438A69]/20'
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
              <span className="text-xs uppercase tracking-widest font-mono font-bold text-[#84919D]">
                Match Engagement Concluded
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#F5F6F8]">{resultTitle}</h2>
              <p className="text-xs sm:text-sm text-[#84919D] max-w-md mx-auto leading-relaxed">{resultSubtitle}</p>
            </div>

            {/* Match Stats Strip */}
            <div className="grid grid-cols-2 gap-3 py-3 px-4 rounded-xl bg-[#11151B] border border-[#202832] text-xs">
              <div>
                <span className="text-[#84919D] block text-[11px]">Total Moves</span>
                <span className="font-mono font-bold text-sm text-[#F5F6F8]">{moveCount} moves</span>
              </div>
              <div>
                <span className="text-[#84919D] block text-[11px]">Outcome</span>
                <span className="font-mono font-bold text-sm text-[#DDAA57] uppercase">
                  {resultType}
                </span>
              </div>
            </div>

            {/* PGN mini preview */}
            {pgn && (
              <div className="text-left bg-[#0A0D12] rounded-xl p-3 border border-[#202832] max-h-24 overflow-y-auto text-[11px] font-mono text-[#84919D] select-all">
                {pgn}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onPlayAgain}
                className="col-span-full tactical-button-primary py-3 px-5 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95"
              >
                <RestartIcon className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={onCopyPGN}
                className="tactical-button-secondary py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                {copiedPGN ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                <span>{copiedPGN ? 'PGN Copied' : 'Copy PGN'}</span>
              </button>

              <button
                type="button"
                onClick={onDownloadPGN}
                className="tactical-button-secondary py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>Download PGN</span>
              </button>

              <button
                type="button"
                onClick={onExportPNG}
                className="tactical-button-secondary py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Export Board</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="tactical-button-secondary py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <EyeIcon className="w-4 h-4" />
                <span>Review Board</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
