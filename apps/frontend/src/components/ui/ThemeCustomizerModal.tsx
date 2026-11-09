'use client'

import React from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/theme/ThemeContext'
import { BOARD_PRESETS, PIECE_SETS } from '@/theme/themePresets'
import { BoardPresetId, PieceSetId } from '@/theme/themeTypes'
import { soundService } from '@/theme/soundService'
import {
  CloseIcon,
  CheckIcon,
  PaletteIcon,
  PerspectiveIcon,
  VolumeOnIcon,
  VolumeOffIcon,
  SparklesIcon,
} from './Icons'

export function ThemeCustomizerModal() {
  const {
    settings,
    activePreset,
    activePieceSet,
    setBoardPreset,
    setPieceSet,
    togglePerspective,
    toggleCoordinates,
    toggleSound,
    resetToDefaults,
    isCustomizerOpen,
    setIsCustomizerOpen,
  } = useTheme()

  if (!isCustomizerOpen) return null

  const handleSelectPreset = (id: BoardPresetId) => {
    soundService.playPieceMove(BOARD_PRESETS[id].defaultSoundPack, settings.soundEnabled)
    setBoardPreset(id)
  }

  const handleSelectPieceSet = (id: PieceSetId) => {
    soundService.playClick(settings.soundEnabled)
    setPieceSet(id)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsCustomizerOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#14161C] border border-white/10 text-white shadow-2xl shadow-black/80 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#111317]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                <PaletteIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Board & Appearance Studio</h2>
                <p className="text-xs text-zinc-400">
                  Custom materials, physical tactile perspectives, and piece craftsmanship.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(false)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Live Preview Strip */}
            <div className="rounded-xl p-4 bg-[#0D0F13] border border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* 2x2 Mini Board swatch */}
                <div
                  className="w-16 h-16 rounded-lg grid grid-cols-2 grid-rows-2 overflow-hidden shadow-inner flex-shrink-0"
                  style={{
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    border: `2px solid ${activePreset.innerBorder}`,
                  }}
                >
                  <div style={{ backgroundColor: activePreset.lightSquare }} />
                  <div style={{ backgroundColor: activePreset.darkSquare }} />
                  <div style={{ backgroundColor: activePreset.darkSquare }} />
                  <div style={{ backgroundColor: activePreset.lightSquare }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{activePreset.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${activePreset.badgeBg}`}>
                      {activePreset.materialTag}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{activePreset.subtitle}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Piece set: <span className="text-yellow-400 font-medium">{activePieceSet.name}</span>
                  </p>
                </div>
              </div>

              {/* Astra Special Banner if active */}
              {settings.boardPresetId === 'ancient-battlefield' && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-yellow-950/40 border border-yellow-700/50 text-xs text-yellow-200">
                  <SparklesIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span>Astra Royal War Miniatures (True 3D) active with two-piece combat choreography and physical destruction.</span>
                </div>
              )}
            </div>

            {/* Section 1: Board Presets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-300">
                  Chessboard Materials ({Object.keys(BOARD_PRESETS).length})
                </h3>
                <span className="text-xs text-zinc-500">Separated from game logic</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(BOARD_PRESETS).map((preset) => {
                  const isSelected = settings.boardPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`relative text-left p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-white/[0.08] border-yellow-500/70 shadow-lg shadow-yellow-500/10'
                          : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Swatch mini display */}
                        <div
                          className="w-10 h-10 rounded-md grid grid-cols-2 grid-rows-2 overflow-hidden shadow-sm flex-shrink-0"
                          style={{ border: `1.5px solid ${preset.innerBorder}` }}
                        >
                          <div style={{ backgroundColor: preset.lightSquare }} />
                          <div style={{ backgroundColor: preset.darkSquare }} />
                          <div style={{ backgroundColor: preset.darkSquare }} />
                          <div style={{ backgroundColor: preset.lightSquare }} />
                        </div>

                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-yellow-500 text-black flex items-center justify-center">
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-white">{preset.name}</div>
                      <div className="text-[11px] text-zinc-400">{preset.subtitle}</div>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{preset.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Piece Sets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-300">Piece Craftsmanship</h3>
                <span className="text-xs text-zinc-500">Physical & Vector models</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.values(PIECE_SETS).filter((set) => set.isAvailable).map((set) => {
                  const isSelected = settings.pieceSetId === set.id
                  return (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => handleSelectPieceSet(set.id)}
                      className={`relative text-left p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-white/[0.08] border-yellow-500/70 shadow-lg shadow-yellow-500/10'
                          : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Piece preview icon */}
                        <div className="w-10 h-10 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center">
                          {set.id === 'default' ? (
                            <span className="text-2xl">♞</span>
                          ) : set.id === 'pirouetti' ? (
                            <div className="relative w-8 h-8">
                              <Image src="/pieces/pirouetti/wN.svg" alt="Knight" width={32} height={32} />
                            </div>
                          ) : set.id === 'chestnut' ? (
                            <div className="relative w-8 h-8">
                              <Image src="/pieces/chestnut/wN.svg" alt="Knight" width={32} height={32} />
                            </div>
                          ) : (
                            <div className="relative w-8 h-8 flex items-center justify-center">
                              <span className="text-xl">⚔️</span>
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-yellow-500 text-black flex items-center justify-center">
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-white">{set.name}</div>
                      <div className="text-[10px] text-yellow-400/90 font-medium">{set.tag}</div>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{set.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section 3: Physical & Audio Preferences */}
            <div>
              <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-300 mb-3">
                Experience & Preferences
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 2.5D Physical Elevation */}
                <button
                  type="button"
                  onClick={togglePerspective}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.perspective === 'elevated-2.5d'
                      ? 'bg-yellow-500/10 border-yellow-500/50 text-white'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <PerspectiveIcon className="w-5 h-5 text-yellow-400" />
                    <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] font-medium">
                      {settings.perspective === 'true-3d'
                        ? 'True 3D Battlefield'
                        : settings.perspective === 'elevated-2.5d'
                        ? '2.5D Physical'
                        : '2D Flat'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-white mt-2">Board Elevation</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Subtle material depth and contact shadow angle</div>
                </button>

                {/* Sound Effects */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.soundEnabled
                      ? 'bg-yellow-500/10 border-yellow-500/50 text-white'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {settings.soundEnabled ? (
                      <VolumeOnIcon className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <VolumeOffIcon className="w-5 h-5 text-red-400" />
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] font-medium">
                      {settings.soundEnabled ? 'Enabled' : 'Muted'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-white mt-2">Procedural Audio</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Wood, stone & marble acoustic synthesized clicks</div>
                </button>

                {/* Rank & File Coordinates */}
                <button
                  type="button"
                  onClick={toggleCoordinates}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.showCoordinates
                      ? 'bg-yellow-500/10 border-yellow-500/50 text-white'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-yellow-400">a1..h8</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] font-medium">
                      {settings.showCoordinates ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-white mt-2">Board Coordinates</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Precision rank and file labels along squares</div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#111317] flex items-center justify-between">
            <button
              type="button"
              onClick={resetToDefaults}
              className="text-xs text-zinc-400 hover:text-white transition"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(false)}
              className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs sm:text-sm transition shadow-md shadow-yellow-500/20"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
