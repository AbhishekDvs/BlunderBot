'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { GameBoard } from './GameBoard'
import { Navbar } from '@/components/ui/Navbar'
import { ThemeCustomizerModal } from '@/components/ui/ThemeCustomizerModal'

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

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F5F6F8] flex flex-col font-sans selection:bg-[#DDAA57]/30 selection:text-[#DDAA57]">
      <Navbar />
      <ThemeCustomizerModal />

      <main className="flex-1 flex flex-col items-center justify-start py-1 sm:py-2">
        <GameBoard difficulty={difficulty} side={side} timeControl={timeControl} />
      </main>
    </div>
  )
}
