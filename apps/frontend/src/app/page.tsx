'use client'

import React, { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Chess } from 'chess.js'
import type { Square, Move } from 'chess.js'
import { Navbar } from '@/components/ui/Navbar'
import { ThemeCustomizerModal } from '@/components/ui/ThemeCustomizerModal'
import { useTheme } from '@/theme/ThemeContext'
import { BOARD_PRESETS } from '@/theme/themePresets'
import { BoardPresetId } from '@/theme/themeTypes'
import { soundService } from '@/theme/soundService'
import { ChessboardFrame } from '@/components/game/ChessboardFrame'
import {
  SwordsIcon,
  SparklesIcon,
  PaletteIcon,
} from '@/components/ui/Icons'

const AI_OPPONENTS = [
  {
    value: 'easy',
    name: 'WALL·E',
    role: 'Scrap Collector',
    avatar: '♻️',
    elo: '~800 ELO',
    depth: 'Depth 3',
    roast: 'Will gladly hang a queen just to see what happens.',
    accent: '#438A69',
    badgeClass: 'bg-[#438A69]/15 text-[#438A69] border-[#438A69]/30',
  },
  {
    value: 'medium',
    name: 'R2-D2',
    role: 'Tactical Astromech',
    avatar: '🤖',
    elo: '~1350 ELO',
    depth: 'Depth 6',
    roast: 'Solid opening repertoire, but still falls for sharp pins.',
    accent: '#38BDF8',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  {
    value: 'hard',
    name: 'Ultron',
    role: 'Autonomous Sentinel',
    avatar: '🧬',
    elo: '~1850 ELO',
    depth: 'Depth 10',
    roast: 'Punishes tactical blunders like it is military protocol.',
    accent: '#A855F7',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  {
    value: 'insane',
    name: 'T-800',
    role: 'Cyberdyne Assassin',
    avatar: '🔥',
    elo: '~2600+ ELO',
    depth: 'Depth 20',
    roast: 'Cold, brutal logic. Depth 20 evaluation. Zero mercy.',
    accent: '#EF4444',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
]

const TIME_CONTROLS = [
  { id: 'casual', label: 'Casual', desc: 'No Clock' },
  { id: '10m', label: '10 Min', desc: 'Rapid' },
  { id: '5m', label: '5 Min', desc: 'Blitz' },
  { id: '1m', label: '1 Min', desc: 'Bullet' },
]

export default function Home() {
  const router = useRouter()
  const { settings, setBoardPreset, setIsCustomizerOpen, activePreset } = useTheme()
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('easy')
  const [selectedSide, setSelectedSide] = useState<'white' | 'black' | 'random'>('white')
  const [timeControl, setTimeControl] = useState<string>('casual')
  const [isLaunching, setIsLaunching] = useState(false)

  // Interactive Hero Preview Chessboard state
  const heroGame = useRef(new Chess('r1bqkb1r/pp2pppp/2n5/1B1p4/3P4/8/PPP2PPP/R1BQK1NR w KQkq - 0 1'))
  const [heroFen, setHeroFen] = useState(heroGame.current.fen())
  const [heroSelectedSquare, setHeroSelectedSquare] = useState<string | null>(null)
  const [heroLastMove, setHeroLastMove] = useState<{ from: string; to: string } | null>({ from: 'd2', to: 'd4' })
  const boardOnlyRef = useRef<HTMLDivElement | null>(null)

  const heroLegalMoves = useMemo(() => {
    if (!heroSelectedSquare || !heroFen) return []
    try {
      const moves = heroGame.current.moves({ square: heroSelectedSquare as Square, verbose: true }) as Move[]
      return moves.map((m) => ({ to: m.to, captured: !!m.captured }))
    } catch {
      return []
    }
  }, [heroSelectedSquare, heroFen])

  const handleHeroSquareClick = (square: string) => {
    const playerColor = heroGame.current.turn()

    if (heroSelectedSquare) {
      try {
        const move = heroGame.current.move({
          from: heroSelectedSquare,
          to: square,
          promotion: 'q',
        })
        if (move) {
          setHeroFen(heroGame.current.fen())
          setHeroLastMove({ from: heroSelectedSquare, to: square })
          setHeroSelectedSquare(null)
          soundService.playPieceMove(activePreset.defaultSoundPack, settings.soundEnabled)
          return
        }
      } catch {
        // invalid move
      }
    }

    const piece = heroGame.current.get(square as Square)
    if (piece && piece.color === playerColor) {
      soundService.playClick(settings.soundEnabled)
      setHeroSelectedSquare(square)
    } else {
      setHeroSelectedSquare(null)
    }
  }

  const handleLaunchGame = (diff = selectedDifficulty) => {
    soundService.playClick(settings.soundEnabled)
    setIsLaunching(true)

    const resolvedSide =
      selectedSide === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : selectedSide

    setTimeout(() => {
      router.push(`/game?difficulty=${diff}&side=${resolvedSide}&timeControl=${timeControl}`)
    }, 250)
  }

  const handleSelectPreset = (id: BoardPresetId) => {
    soundService.playPieceMove(BOARD_PRESETS[id].defaultSoundPack, settings.soundEnabled)
    setBoardPreset(id)
  }

  const activeOpponent = AI_OPPONENTS.find((o) => o.value === selectedDifficulty) ?? AI_OPPONENTS[0]

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F5F6F8] flex flex-col font-sans selection:bg-[#DDAA57]/30 selection:text-[#DDAA57]">
      <Navbar />
      <ThemeCustomizerModal />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-between">
        {/* Editorial Top Headline */}
        <div className="space-y-3 max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151A22] border border-[#202832] text-xs font-mono text-[#84919D]">
            <SparklesIcon className="w-3.5 h-3.5 text-[#DDAA57]" />
            <span>Stockfish 16 WASM • Client-Side Neural Search</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#F5F6F8] leading-[1.08]">
            Grandmaster Logic. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DDAA57] via-[#F3CE89] to-[#DDAA57]">
              Zero Remote Telemetry.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#84919D] leading-relaxed max-w-2xl">
            A bespoke chess gaming console. Tactile physical boards, calibrated Stockfish difficulty tiers, and cinematic war chess encounters running entirely within your browser.
          </p>
        </div>

        {/* Hero Interactive Split Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start mb-12">
          {/* Left Column: Mission Control & Match Deployment Deck */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            {/* Deployment Console Box */}
            <div className="tactical-panel p-5 sm:p-7 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-[#202832] pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#DDAA57]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#F5F6F8]">
                    Deployment Parameters
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#84919D]">Local Worker</span>
              </div>

              {/* 1. Side Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#84919D]">
                  Alliance & Initiative
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick(settings.soundEnabled)
                      setSelectedSide('white')
                    }}
                    className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 transition ${
                      selectedSide === 'white'
                        ? 'bg-[#1C232D] border-[#DDAA57] text-[#DDAA57] shadow-md shadow-[#DDAA57]/10'
                        : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:text-[#F5F6F8] hover:border-[#283341]'
                    }`}
                  >
                    <span className="text-lg">♙</span>
                    <span>White (First)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick(settings.soundEnabled)
                      setSelectedSide('random')
                    }}
                    className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 transition ${
                      selectedSide === 'random'
                        ? 'bg-[#1C232D] border-[#DDAA57] text-[#DDAA57] shadow-md shadow-[#DDAA57]/10'
                        : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:text-[#F5F6F8] hover:border-[#283341]'
                    }`}
                  >
                    <span className="text-lg">🎲</span>
                    <span>Random</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick(settings.soundEnabled)
                      setSelectedSide('black')
                    }}
                    className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 transition ${
                      selectedSide === 'black'
                        ? 'bg-[#1C232D] border-[#DDAA57] text-[#DDAA57] shadow-md shadow-[#DDAA57]/10'
                        : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:text-[#F5F6F8] hover:border-[#283341]'
                    }`}
                  >
                    <span className="text-lg">♟</span>
                    <span>Black (Counter)</span>
                  </button>
                </div>
              </div>

              {/* 2. Time Control Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#84919D]">
                    Match Clock Pacing
                  </label>
                  <span className="text-[11px] font-mono text-[#DDAA57]">{timeControl.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_CONTROLS.map((tc) => {
                    const isSelected = timeControl === tc.id
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => {
                          soundService.playClick(settings.soundEnabled)
                          setTimeControl(tc.id)
                        }}
                        className={`py-2 px-2 rounded-xl border text-center transition ${
                          isSelected
                            ? 'bg-[#1C232D] border-[#DDAA57] text-[#F5F6F8]'
                            : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:text-[#F5F6F8] hover:border-[#283341]'
                        }`}
                      >
                        <div className="text-xs font-bold">{tc.label}</div>
                        <div className="text-[10px] text-[#84919D]">{tc.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3. Board Material Quick Palette */}
              <div className="space-y-2.5 pt-2 border-t border-[#202832]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PaletteIcon className="w-4 h-4 text-[#DDAA57]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#84919D]">
                      Active Board: <span className="text-[#F5F6F8]">{activePreset.name}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomizerOpen(true)}
                    className="text-xs text-[#DDAA57] hover:underline font-semibold"
                  >
                    Open Studio
                  </button>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {Object.values(BOARD_PRESETS).map((preset) => {
                    const isSelected = settings.boardPresetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`w-9 h-9 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 border transition ${
                          isSelected
                            ? 'border-[#DDAA57] scale-110 shadow-lg shadow-[#DDAA57]/20 ring-1 ring-[#DDAA57]'
                            : 'border-[#2D3847] opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                        title={preset.name}
                      >
                        <div style={{ backgroundColor: preset.lightSquare }} />
                        <div style={{ backgroundColor: preset.darkSquare }} />
                        <div style={{ backgroundColor: preset.darkSquare }} />
                        <div style={{ backgroundColor: preset.lightSquare }} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Main Launch CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => handleLaunchGame(selectedDifficulty)}
                  className="tactical-button-primary w-full py-4 px-6 rounded-2xl text-base sm:text-lg flex items-center justify-center gap-3 transition active:scale-98 disabled:opacity-50"
                >
                  <SwordsIcon className="w-5 h-5" />
                  <span>
                    {isLaunching
                      ? 'Deploying Arena...'
                      : `Engage ${activeOpponent.name} (${selectedSide.toUpperCase()})`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Board Preview */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="tactical-panel w-full p-4 sm:p-5 rounded-2xl flex flex-col items-center space-y-3">
              <div className="w-full flex items-center justify-between text-xs text-[#84919D] px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#438A69]" />
                  <span className="font-bold text-[#F5F6F8]">Interactive Material Stage</span>
                </div>
                <span className="font-mono text-[11px]">{settings.perspective.toUpperCase()}</span>
              </div>

              {/* Embedded Board Frame Preview */}
              <div className="w-full flex items-center justify-center">
                <ChessboardFrame
                  fen={heroFen}
                  side="white"
                  boardWidth={360}
                  selectedSquare={heroSelectedSquare}
                  legalMoves={heroLegalMoves}
                  lastMove={heroLastMove}
                  inCheckSquare={null}
                  onSquareClick={handleHeroSquareClick}
                  onPieceDrop={() => false}
                  boardOnlyRef={boardOnlyRef}
                />
              </div>

              <div className="w-full text-center text-[11px] text-[#84919D] pt-1">
                Click squares to preview legal move indicators and tactile piece textures.
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Opponent Tactical Dossiers */}
        <div className="space-y-4 mb-10">
          <div className="flex items-center justify-between border-b border-[#202832] pb-3">
            <div>
              <h2 className="text-lg font-bold text-[#F5F6F8] tracking-tight">
                Nemesis Tactical Dossiers
              </h2>
              <p className="text-xs text-[#84919D]">
                Select your computational adversary. Every level uses pure Stockfish alpha-beta depth.
              </p>
            </div>
            <span className="text-xs font-mono text-[#DDAA57]">4 TACTICAL TIERS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AI_OPPONENTS.map((opp) => {
              const isSelected = selectedDifficulty === opp.value
              return (
                <div
                  key={opp.value}
                  onClick={() => {
                    soundService.playClick(settings.soundEnabled)
                    setSelectedDifficulty(opp.value)
                  }}
                  className={`relative p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'tactical-panel-active ring-1 ring-[#DDAA57]/60'
                      : 'tactical-panel hover:border-[#2D3847] hover:bg-[#151A22]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl select-none">{opp.avatar}</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${opp.badgeClass}`}>
                        {opp.elo}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-[#F5F6F8] tracking-tight">{opp.name}</h3>
                      <p className="text-xs font-semibold text-[#DDAA57] mt-0.5">{opp.role}</p>
                    </div>

                    <p className="text-xs text-[#84919D] leading-relaxed italic line-clamp-3">
                      “{opp.roast}”
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#202832] flex items-center justify-between text-xs">
                    <span className="text-[#84919D] font-mono">Engine Scan:</span>
                    <span className="font-mono text-[#F5F6F8] font-bold">{opp.depth}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
