'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { GameBoard } from './GameBoard'
import { Navbar } from '@/components/ui/Navbar'
import { ThemeCustomizerModal } from '@/components/ui/ThemeCustomizerModal'
import { useStockfishStatus } from '@/hooks/useStockfish'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane'
export type PieceStyle = 'default' | 'pirouetti' | 'chestnut'
export type BoardSide = 'white' | 'black'
export type TimeControl = 'casual' | '10m' | '5m' | '1m'

const VALID_DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'insane'] as const
const VALID_TIME_CONTROLS: readonly TimeControl[] = ['casual', '10m', '5m', '1m'] as const

function sanitizeDifficulty(val: string | null): Difficulty {
  if (val && (VALID_DIFFICULTIES as readonly string[]).includes(val)) {
    return val as Difficulty
  }
  return 'easy'
}

function sanitizeSide(val: string | null): BoardSide {
  return val === 'black' ? 'black' : 'white'
}

function sanitizeTimeControl(val: string | null): TimeControl {
  if (val && (VALID_TIME_CONTROLS as readonly string[]).includes(val)) {
    return val as TimeControl
  }
  return 'casual'
}

export default function GameClient() {
  const searchParams = useSearchParams()
  const difficulty = useMemo(() => sanitizeDifficulty(searchParams.get('difficulty')), [searchParams])
  const side = useMemo(() => sanitizeSide(searchParams.get('side')), [searchParams])
  const timeControl = useMemo(() => sanitizeTimeControl(searchParams.get('timeControl')), [searchParams])
  const engineState = useStockfishStatus()

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F5F6F8] flex flex-col font-sans selection:bg-[#DDAA57]/30 selection:text-[#DDAA57]">
      <Navbar />
      <ThemeCustomizerModal />

      {engineState.status === 'error' && (
        <div
          role="alert"
          className="mx-auto mt-2 max-w-2xl w-[calc(100%-1rem)] px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-500/60 text-red-100 text-xs flex items-center justify-between gap-3 shadow-lg"
        >
          <div>
            <span className="font-bold">Stockfish Engine Error: </span>
            <span>{engineState.error || 'Failed to initialize chess engine worker.'}</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-100 font-semibold shrink-0 transition"
          >
            Reload
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-start py-1 sm:py-2" aria-label="Chess match arena">
        <GameBoard difficulty={difficulty} side={side} timeControl={timeControl} />
      </main>
    </div>
  )
}
