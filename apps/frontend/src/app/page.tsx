'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/ui/Navbar'
import { ThemeCustomizerModal } from '@/components/ui/ThemeCustomizerModal'
import { useTheme } from '@/theme/ThemeContext'
import { BOARD_PRESETS } from '@/theme/themePresets'
import { BoardPresetId } from '@/theme/themeTypes'
import { soundService } from '@/theme/soundService'
import { SwordsIcon, SparklesIcon, PaletteIcon } from '@/components/ui/Icons'

const AI_OPPONENTS = [
  {
    value: 'easy',
    name: 'WALL·E',
    role: 'Scrap Collector',
    avatar: '♻️',
    elo: '~800 ELO',
    depth: 'Depth 3',
    roast: 'Will gladly hang a queen just to see what happens.',
    bg: 'from-emerald-500/10 via-emerald-950/20 to-transparent',
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    tag: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40',
    accentText: 'text-emerald-400',
  },
  {
    value: 'medium',
    name: 'R2-D2',
    role: 'Tactical Astromech',
    avatar: '🤖',
    elo: '~1350 ELO',
    depth: 'Depth 6',
    roast: 'Solid opening repertoire, but still falls for sharp pins.',
    bg: 'from-blue-500/10 via-blue-950/20 to-transparent',
    border: 'border-blue-500/30 hover:border-blue-400/60',
    tag: 'bg-blue-950/60 text-blue-300 border-blue-700/40',
    accentText: 'text-blue-400',
  },
  {
    value: 'hard',
    name: 'Ultron',
    role: 'Autonomous Sentinel',
    avatar: '🧬',
    elo: '~1850 ELO',
    depth: 'Depth 10',
    roast: 'Punishes tactical blunders like it is military protocol.',
    bg: 'from-indigo-500/10 via-indigo-950/20 to-transparent',
    border: 'border-indigo-500/30 hover:border-indigo-400/60',
    tag: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/40',
    accentText: 'text-indigo-400',
  },
  {
    value: 'insane',
    name: 'T-800',
    role: 'Cyberdyne Assassin',
    avatar: '🔥',
    elo: '~2600+ ELO',
    depth: 'Depth 20',
    roast: 'Cold, brutal logic. Depth 20 evaluation. Zero mercy.',
    bg: 'from-red-500/10 via-red-950/20 to-transparent',
    border: 'border-red-500/30 hover:border-red-400/60',
    tag: 'bg-red-950/60 text-red-300 border-red-700/40',
    accentText: 'text-red-400',
  },
]

export default function Home() {
  const router = useRouter()
  const { settings, setBoardPreset, setIsCustomizerOpen, activePreset } = useTheme()
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('easy')
  const [selectedSide, setSelectedSide] = useState<'white' | 'black' | 'random'>('white')
  const [isLaunching, setIsLaunching] = useState(false)

  const handleLaunchGame = (diff = selectedDifficulty) => {
    soundService.playClick(settings.soundEnabled)
    setIsLaunching(true)

    // Resolve random side
    const resolvedSide =
      selectedSide === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : selectedSide

    setTimeout(() => {
      router.push(`/game?difficulty=${diff}&side=${resolvedSide}`)
    }, 280)
  }

  const handleSelectPreset = (id: BoardPresetId) => {
    soundService.playPieceMove(BOARD_PRESETS[id].defaultSoundPack, settings.soundEnabled)
    setBoardPreset(id)
  }

  const activeOpponent = AI_OPPONENTS.find((o) => o.value === selectedDifficulty) ?? AI_OPPONENTS[0]

  return (
    <div className="min-h-screen bg-[#0A0C10] text-white flex flex-col font-sans selection:bg-yellow-500/30 selection:text-yellow-200">
      <Navbar />
      <ThemeCustomizerModal />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 max-w-3xl mx-auto mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-300">
            <SparklesIcon className="w-3.5 h-3.5 text-yellow-400" />
            <span>Client-Side Stockfish 16 Engine • Zero Latency</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
            Outsmarted by a Machine? <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              Meet Your Chess Nemesis.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            An original, cinematic chess experience. Choose your opponent, calibrate your board materials, and test your tactical endurance.
          </p>
        </motion.div>

        {/* Setup Deck Container */}
        <div className="space-y-8">
          {/* Section 1: Side Selection */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <span className="text-xs uppercase tracking-widest font-bold text-zinc-400">
              Choose Your Colors
            </span>

            <div className="inline-flex p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  soundService.playClick(settings.soundEnabled)
                  setSelectedSide('white')
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                  selectedSide === 'white'
                    ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-base">♙</span>
                <span>White (First Move)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playClick(settings.soundEnabled)
                  setSelectedSide('random')
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                  selectedSide === 'random'
                    ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-base">🎲</span>
                <span>Random</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playClick(settings.soundEnabled)
                  setSelectedSide('black')
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                  selectedSide === 'black'
                    ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-base">♟</span>
                <span>Black (Defense)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Opponent Personas Grid */}
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-xs uppercase tracking-widest font-bold text-zinc-400">
                Select Your Opponent
              </span>
              <span className="text-xs text-zinc-500 font-mono">Stockfish Depth & Persona</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {AI_OPPONENTS.map((opp) => {
                const isSelected = selectedDifficulty === opp.value
                return (
                  <motion.div
                    key={opp.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      soundService.playClick(settings.soundEnabled)
                      setSelectedDifficulty(opp.value)
                    }}
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between bg-gradient-to-b ${
                      opp.bg
                    } ${
                      isSelected
                        ? 'border-yellow-400 shadow-xl shadow-yellow-500/10 ring-1 ring-yellow-400/50'
                        : `${opp.border} bg-[#111319]`
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl select-none">{opp.avatar}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${opp.tag}`}>
                            {opp.elo}
                          </span>
                        </div>
                      </div>

                      {/* Opponent Identity */}
                      <h3 className="text-xl font-black text-white tracking-tight">{opp.name}</h3>
                      <p className={`text-xs font-semibold ${opp.accentText} mt-0.5`}>{opp.role}</p>

                      <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed line-clamp-3">
                        “{opp.roast}”
                      </p>
                    </div>

                    {/* Bottom Specs */}
                    <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Calculation:</span>
                      <span className="font-mono text-zinc-300 font-bold">{opp.depth}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Section 3: Board Aesthetic Quick Strip */}
          <div className="p-4 rounded-2xl bg-[#111319] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex-shrink-0">
                <PaletteIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Board Theme: <span className="text-yellow-400">{activePreset.name}</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  {activePreset.materialTag} • {settings.perspective === 'elevated-2.5d' ? '2.5D Physical Depth' : '2D Tournament Flat'}
                </div>
              </div>
            </div>

            {/* Swatches preview strip */}
            <div className="flex items-center gap-2 flex-wrap">
              {Object.values(BOARD_PRESETS).map((p) => {
                const isSelected = settings.boardPresetId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`w-7 h-7 rounded-md overflow-hidden grid grid-cols-2 grid-rows-2 border transition ${
                      isSelected ? 'border-yellow-400 scale-110 shadow-md shadow-yellow-500/20' : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                    title={p.name}
                  >
                    <div style={{ backgroundColor: p.lightSquare }} />
                    <div style={{ backgroundColor: p.darkSquare }} />
                    <div style={{ backgroundColor: p.darkSquare }} />
                    <div style={{ backgroundColor: p.lightSquare }} />
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setIsCustomizerOpen(true)}
                className="ml-2 text-xs text-yellow-400 hover:text-yellow-300 font-medium underline underline-offset-4"
              >
                Customize Studio
              </button>
            </div>
          </div>

          {/* Section 4: Main Launch CTA */}
          <div className="flex flex-col items-center justify-center pt-2">
            <button
              type="button"
              disabled={isLaunching}
              onClick={() => handleLaunchGame(selectedDifficulty)}
              className="group relative px-10 py-4 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 hover:from-yellow-400 hover:to-amber-300 text-black font-black text-base sm:text-lg shadow-2xl shadow-yellow-500/25 transition active:scale-95 flex items-center gap-3 disabled:opacity-50"
            >
              <SwordsIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span>
                {isLaunching ? 'Deploying Board...' : `Engage ${activeOpponent.name} (${selectedSide.toUpperCase()})`}
              </span>
            </button>
            <p className="text-xs text-zinc-500 mt-2">
              Stockfish will initialize instantly in your local browser worker.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
