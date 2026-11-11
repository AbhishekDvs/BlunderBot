'use client'

import React from 'react'
import Link from 'next/link'
import { useTheme } from '@/theme/ThemeContext'
import { useStockfishStatus } from '@/hooks/useStockfish'
import { soundService } from '@/theme/soundService'
import {
  LogoMark,
  PaletteIcon,
  VolumeOnIcon,
  VolumeOffIcon,
  PerspectiveIcon,
  SwordsIcon,
  ZapIcon,
} from './Icons'

export function Navbar({ onNewGameClick }: { onNewGameClick?: () => void }) {
  const { settings, toggleSound, togglePerspective, setIsCustomizerOpen, activePreset } = useTheme()
  const engineState = useStockfishStatus()

  const handleSoundClick = () => {
    soundService.playClick(!settings.soundEnabled)
    toggleSound()
  }

  const handlePerspectiveClick = () => {
    soundService.playClick(settings.soundEnabled)
    togglePerspective()
  }

  const handleCustomizerClick = () => {
    soundService.playClick(settings.soundEnabled)
    setIsCustomizerOpen(true)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#202832] bg-[#0C0F14]/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand & Identity */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 sm:gap-3 text-white transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] rounded-xl p-1"
        >
          <div className="relative flex items-center justify-center p-1.5 rounded-xl bg-gradient-to-b from-[#202832] to-[#11151B] border border-[#2D3847] group-hover:border-[#DDAA57]/60 transition shadow-lg shadow-black/40">
            <LogoMark className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-black tracking-tight text-base sm:text-lg text-[#F5F6F8] uppercase font-sans">
                Blunder<span className="text-[#DDAA57]">Bot</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#1C232D] text-[#84919D] border border-[#283341] tracking-wider uppercase">
                Tactical HUD
              </span>
            </div>
            <span className="text-[10px] text-[#84919D] -mt-0.5 tracking-wider uppercase font-semibold hidden sm:block">
              WASM Chess Intelligence
            </span>
          </div>
        </Link>

        {/* Center: Live Board Material & Engine Telemetry (Desktop) */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#11151B] border border-[#202832] text-xs shadow-inner">
          {/* Swatch Pill */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm grid grid-cols-2 grid-rows-2 overflow-hidden border border-white/20 shadow-sm">
              <div style={{ backgroundColor: activePreset.lightSquare }} />
              <div style={{ backgroundColor: activePreset.darkSquare }} />
              <div style={{ backgroundColor: activePreset.darkSquare }} />
              <div style={{ backgroundColor: activePreset.lightSquare }} />
            </div>
            <span className="text-[#84919D] font-medium text-[11px]">Material:</span>
            <span className="text-[#F5F6F8] font-bold text-[11px]">{activePreset.name}</span>
          </div>

          <span className="w-1 h-1 rounded-full bg-[#2D3847]" />

          {/* Engine Status */}
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono text-[#84919D]"
            role="status"
            aria-live="polite"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                engineState.status === 'error'
                  ? 'bg-red-500'
                  : engineState.status === 'searching'
                  ? 'bg-[#DDAA57] animate-pulse'
                  : 'bg-[#438A69]'
              }`}
            />
            <span>
              {engineState.status === 'error'
                ? 'Engine Error'
                : engineState.status === 'searching'
                ? 'Stockfish Thinking'
                : 'Stockfish 16'}
            </span>
          </div>
        </div>

        {/* Controls & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={handleSoundClick}
            className={`p-2 rounded-xl border transition flex items-center justify-center ${
              settings.soundEnabled
                ? 'bg-[#151A22] border-[#252F3C] text-[#F5F6F8] hover:border-[#DDAA57]/50 hover:bg-[#1C232D]'
                : 'bg-red-950/30 border-red-900/40 text-red-400 hover:bg-red-950/40'
            }`}
            title={settings.soundEnabled ? 'Sound Active (Web Audio)' : 'Sound Muted'}
            aria-label={settings.soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
          >
            {settings.soundEnabled ? <VolumeOnIcon className="w-4 h-4 text-[#DDAA57]" /> : <VolumeOffIcon className="w-4 h-4" />}
          </button>

          {/* 3D / 2.5D / 2D Perspective Toggle */}
          <button
            type="button"
            onClick={handlePerspectiveClick}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
              settings.perspective === 'true-3d'
                ? 'bg-[#DDAA57]/15 border-[#DDAA57]/50 text-[#DDAA57] shadow-sm shadow-[#DDAA57]/10'
                : settings.perspective === 'elevated-2.5d'
                ? 'bg-[#438A69]/15 border-[#438A69]/50 text-emerald-400'
                : 'bg-[#151A22] border-[#252F3C] text-[#84919D] hover:text-[#F5F6F8] hover:border-[#DDAA57]/40'
            }`}
            title="Cycle between True 3D Battlefield, 2.5D Physical Depth, and 2D Classical Flat"
          >
            <PerspectiveIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">
              {settings.perspective === 'true-3d'
                ? (settings.experimental3d ? '3D Exp' : '2.5D War')
                : settings.perspective === 'elevated-2.5d'
                ? '2D Tilted'
                : '2D Flat'}
            </span>
          </button>

          {/* Theme Customizer Trigger */}
          <button
            type="button"
            onClick={handleCustomizerClick}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#151A22] border border-[#252F3C] hover:border-[#DDAA57]/50 hover:bg-[#1C232D] text-[#F5F6F8] transition shadow-sm text-xs sm:text-sm font-semibold"
            title="Board Materials & Piece Styles"
          >
            <PaletteIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#DDAA57]" />
            <span className="hidden sm:inline">Studio</span>
          </button>

          {/* Quick Play Action */}
          {onNewGameClick ? (
            <button
              type="button"
              onClick={onNewGameClick}
              className="tactical-button-primary flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm transition active:scale-95"
            >
              <SwordsIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Rematch</span>
            </button>
          ) : (
            <Link
              href="/game"
              className="tactical-button-primary flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm transition active:scale-95"
            >
              <ZapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Deploy</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
