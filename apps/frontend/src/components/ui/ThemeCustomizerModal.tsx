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
    setPerspective,
    updateSettings,
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
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#151A22] border border-[#2D3847] text-[#F5F6F8] shadow-2xl shadow-black/90 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#202832] bg-[#11151B]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#DDAA57]/15 border border-[#DDAA57]/40 text-[#DDAA57]">
                <PaletteIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#F5F6F8] tracking-tight">
                  Board & Appearance Studio
                </h2>
                <p className="text-xs text-[#84919D]">
                  Custom materials, physical tactile perspectives, and piece craftsmanship.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(false)}
              className="p-2 rounded-lg text-[#84919D] hover:text-[#F5F6F8] hover:bg-[#1C232D] transition"
              aria-label="Close Customizer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Live Preview Strip */}
            <div className="rounded-xl p-4 bg-[#11151B] border border-[#202832] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* 2x2 Mini Board swatch */}
                <div
                  className="w-16 h-16 rounded-lg grid grid-cols-2 grid-rows-2 overflow-hidden shadow-inner flex-shrink-0"
                  style={{
                    boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
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
                    <span className="text-sm font-bold text-[#F5F6F8]">{activePreset.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#DDAA57]/30 bg-[#DDAA57]/10 text-[#DDAA57] font-semibold">
                      {activePreset.materialTag}
                    </span>
                  </div>
                  <p className="text-xs text-[#84919D] mt-0.5">{activePreset.subtitle}</p>
                  <p className="text-[11px] text-[#84919D] mt-1">
                    Piece Model: <span className="text-[#DDAA57] font-medium">{activePieceSet.name}</span>
                  </p>
                </div>
              </div>

              {/* Astra 2.5D War Chess Banner if active */}
              {settings.perspective === 'true-3d' && settings.pieceSetId === 'astra-medieval' && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#DDAA57]/10 border border-[#DDAA57]/30 text-xs text-[#DDAA57]">
                  <SparklesIcon className="w-4 h-4 text-[#DDAA57] flex-shrink-0" />
                  <span>
                    {settings.experimental3d
                      ? 'Experimental 3D GLB mode active — experimental figurine study.'
                      : 'Animated 2.5D Indian War Chess active with articulated combat and directional board flipping.'}
                  </span>
                </div>
              )}
            </div>

            {/* Section 1: Board Presets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#84919D]">
                  Chessboard Materials ({Object.keys(BOARD_PRESETS).length})
                </h3>
                <span className="text-xs text-[#84919D]">Theme-neutral separation</span>
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
                          ? 'bg-[#1C232D] border-[#DDAA57] shadow-lg shadow-[#DDAA57]/10 ring-1 ring-[#DDAA57]/50'
                          : 'bg-[#11151B] border-[#202832] hover:bg-[#151A22] hover:border-[#2D3847]'
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
                          <span className="w-5 h-5 rounded-full bg-[#DDAA57] text-[#0A0D12] flex items-center justify-center font-bold">
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-[#F5F6F8]">{preset.name}</div>
                      <div className="text-[11px] text-[#84919D]">{preset.subtitle}</div>
                      <p className="text-[11px] text-[#84919D] mt-1 line-clamp-2 leading-relaxed">{preset.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Piece Sets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#84919D]">
                  Piece Craftsmanship
                </h3>
                <span className="text-xs text-[#84919D]">Physical & Vector Models</span>
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
                          ? 'bg-[#1C232D] border-[#DDAA57] shadow-lg shadow-[#DDAA57]/10 ring-1 ring-[#DDAA57]/50'
                          : 'bg-[#11151B] border-[#202832] hover:bg-[#151A22] hover:border-[#2D3847]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Piece preview icon */}
                        <div className="w-10 h-10 rounded-md bg-[#0A0D12] border border-[#202832] flex items-center justify-center">
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
                          <span className="w-5 h-5 rounded-full bg-[#DDAA57] text-[#0A0D12] flex items-center justify-center font-bold">
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-[#F5F6F8]">{set.name}</div>
                      <div className="text-[10px] text-[#DDAA57] font-semibold">{set.tag}</div>
                      <p className="text-[11px] text-[#84919D] mt-1 line-clamp-2 leading-relaxed">{set.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section 3: Visual Engine Mode (2D / Animated 2.5D / Experimental 3D) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#84919D] mb-3">
                Rendering Engine Mode
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick(settings.soundEnabled)
                    updateSettings({ perspective: 'true-3d', pieceSetId: 'astra-medieval', experimental3d: false })
                  }}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.perspective === 'true-3d' && !settings.experimental3d
                      ? 'bg-[#DDAA57]/15 border-[#DDAA57] text-[#F5F6F8]'
                      : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <PerspectiveIcon className="w-5 h-5 text-[#DDAA57]" />
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1C232D] text-[#DDAA57] border border-[#DDAA57]/40">
                      Recommended
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-[#F5F6F8] mt-2">Animated 2.5D</div>
                  <div className="text-xs text-[#84919D] mt-0.5">48° tactical Indian war chess with character animations & combat</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick(settings.soundEnabled)
                    setPerspective('flat-2d')
                    updateSettings({ experimental3d: false })
                  }}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.perspective !== 'true-3d'
                      ? 'bg-[#DDAA57]/15 border-[#DDAA57] text-[#F5F6F8]'
                      : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">♟️</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1C232D] text-[#F5F6F8] border border-[#283341]">
                      Lightweight
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-[#F5F6F8] mt-2">2D Vector Board</div>
                  <div className="text-xs text-[#84919D] mt-0.5">Fast, classical tournament SVG pieces with optional subtle tilt</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick(settings.soundEnabled)
                    updateSettings({ perspective: 'true-3d', pieceSetId: 'astra-medieval', experimental3d: true })
                  }}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.perspective === 'true-3d' && settings.experimental3d
                      ? 'bg-emerald-500/15 border-emerald-500 text-[#F5F6F8]'
                      : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🗿</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1C232D] text-emerald-300 border border-emerald-500/40">
                      Experimental
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-[#F5F6F8] mt-2">Experimental 3D</div>
                  <div className="text-xs text-[#84919D] mt-0.5">Direct GLB miniature geometry study with full orbit</div>
                </button>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-[#84919D] mb-3">
                Experience & Preferences
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Combat & Move Animations Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick(settings.soundEnabled)
                    updateSettings({ animationDuration: settings.animationDuration === 0 ? 250 : 0 })
                  }}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.animationDuration > 0
                      ? 'bg-[#DDAA57]/15 border-[#DDAA57] text-[#F5F6F8]'
                      : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <SparklesIcon className="w-5 h-5 text-[#DDAA57]" />
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1C232D] text-[#F5F6F8] border border-[#283341]">
                      {settings.animationDuration > 0 ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-[#F5F6F8] mt-2">Piece Animations</div>
                  <div className="text-xs text-[#84919D] mt-0.5">Toggle character walking, leaps, and combat sequences</div>
                </button>

                {/* Sound Effects */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.soundEnabled
                      ? 'bg-[#DDAA57]/15 border-[#DDAA57] text-[#F5F6F8]'
                      : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {settings.soundEnabled ? (
                      <VolumeOnIcon className="w-5 h-5 text-[#DDAA57]" />
                    ) : (
                      <VolumeOffIcon className="w-5 h-5 text-red-400" />
                    )}
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1C232D] text-[#F5F6F8] border border-[#283341]">
                      {settings.soundEnabled ? 'Synthesized' : 'Muted'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-[#F5F6F8] mt-2">Procedural Audio</div>
                  <div className="text-xs text-[#84919D] mt-0.5">Wood, marble, and stone acoustic clicks via Web Audio API</div>
                </button>

                {/* Rank & File Coordinates */}
                <button
                  type="button"
                  onClick={toggleCoordinates}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    settings.showCoordinates
                      ? 'bg-[#DDAA57]/15 border-[#DDAA57] text-[#F5F6F8]'
                      : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#DDAA57]">a1..h8</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1C232D] text-[#F5F6F8] border border-[#283341]">
                      {settings.showCoordinates ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-[#F5F6F8] mt-2">Board Notation</div>
                  <div className="text-xs text-[#84919D] mt-0.5">Precision algebraic file and rank markers</div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-[#202832] bg-[#11151B] flex items-center justify-between">
            <button
              type="button"
              onClick={resetToDefaults}
              className="text-xs text-[#84919D] hover:text-[#F5F6F8] transition"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(false)}
              className="tactical-button-primary px-5 py-2 rounded-xl text-xs sm:text-sm"
            >
              Apply Changes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
