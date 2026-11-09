'use client'

import React from 'react'
import Link from 'next/link'
import { useTheme } from '@/theme/ThemeContext'
import { soundService } from '@/theme/soundService'
import {
  LogoMark,
  PaletteIcon,
  VolumeOnIcon,
  VolumeOffIcon,
  PerspectiveIcon,
  SwordsIcon,
} from './Icons'

export function Navbar({ onNewGameClick }: { onNewGameClick?: () => void }) {
  const { settings, toggleSound, togglePerspective, setIsCustomizerOpen, activePreset } = useTheme()

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
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0E1015]/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Identity */}
        <Link
          href="/"
          className="group flex items-center gap-3 text-white transition hover:opacity-90 focus:outline-none"
        >
          <div className="relative flex items-center justify-center p-1 rounded-xl bg-gradient-to-b from-yellow-500/20 to-transparent border border-yellow-500/30 group-hover:border-yellow-400/60 transition shadow-lg shadow-yellow-500/5">
            <LogoMark className="w-8 h-8" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg sm:text-xl text-white font-sans">
                Blunder<span className="text-yellow-400">Bot</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                v2.0
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 -mt-0.5 tracking-wider uppercase font-medium hidden sm:block">
              Play Chess
            </span>
          </div>
        </Link>

        {/* Center / Ambient status (Desktop) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-zinc-300">Active Board:</span>
          <span className="text-yellow-300 font-semibold">{activePreset.name}</span>
        </div>

        {/* Controls & Tools */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={handleSoundClick}
            className={`p-2 rounded-lg border transition ${
              settings.soundEnabled
                ? 'bg-white/[0.04] border-white/10 text-zinc-200 hover:bg-white/[0.08]'
                : 'bg-red-950/20 border-red-900/40 text-red-400 hover:bg-red-950/30'
            }`}
            title={settings.soundEnabled ? 'Mute Sound (Web Audio)' : 'Unmute Sound'}
            aria-label={settings.soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
          >
            {settings.soundEnabled ? <VolumeOnIcon className="w-4 h-4" /> : <VolumeOffIcon className="w-4 h-4" />}
          </button>

          {/* 2.5D Physical Perspective Toggle */}
          <button
            type="button"
            onClick={handlePerspectiveClick}
            className={`p-2 rounded-lg border transition hidden sm:flex items-center gap-1.5 text-xs font-medium ${
              settings.perspective === 'elevated-2.5d'
                ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                : 'bg-white/[0.04] border-white/10 text-zinc-300 hover:bg-white/[0.08]'
            }`}
            title="Toggle 2.5D Physical Elevation"
          >
            <PerspectiveIcon className="w-4 h-4" />
            <span className="hidden lg:inline">{settings.perspective === 'elevated-2.5d' ? '2.5D' : '2D'}</span>
          </button>

          {/* Theme Customizer Trigger */}
          <button
            type="button"
            onClick={handleCustomizerClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 hover:border-yellow-500/40 text-zinc-200 hover:text-white transition shadow-sm text-xs sm:text-sm font-medium"
            title="Board Materials & Piece Styles"
          >
            <PaletteIcon className="w-4 h-4 text-yellow-400" />
            <span className="hidden sm:inline">Appearance</span>
          </button>

          {/* New Match Action (if provided) */}
          {onNewGameClick ? (
            <button
              type="button"
              onClick={onNewGameClick}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold text-xs sm:text-sm shadow-md shadow-yellow-500/10 transition active:scale-95"
            >
              <SwordsIcon className="w-4 h-4" />
              <span>New Match</span>
            </button>
          ) : (
            <Link
              href="/game"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold text-xs sm:text-sm shadow-md shadow-yellow-500/10 transition active:scale-95"
            >
              <SwordsIcon className="w-4 h-4" />
              <span>Play</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
