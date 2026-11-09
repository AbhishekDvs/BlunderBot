'use client'

import React from 'react'
import { CapturedPieces } from './CapturedPieces'
import { Difficulty, BoardSide } from '@/app/game/GameClient'

interface PlayerCardProps {
  isBot?: boolean
  side: BoardSide
  difficulty?: Difficulty
  isTurn: boolean
  isThinking?: boolean
  fen: string
  dynamicRoast?: string
  timeRemaining?: number
  showClock?: boolean
}

function formatClockTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const DIFFICULTY_METADATA: Record<
  Difficulty,
  { name: string; title: string; depth: string; elo: string; avatar: string; color: string }
> = {
  easy: {
    name: 'WALL·E',
    title: 'Scrap Collector',
    depth: 'Depth 3',
    elo: '~800 ELO',
    avatar: '♻️',
    color: 'from-emerald-500/20 to-emerald-950/40 border-emerald-500/30 text-emerald-300',
  },
  medium: {
    name: 'R2-D2',
    title: 'Tactical Astromech',
    depth: 'Depth 6',
    elo: '~1350 ELO',
    avatar: '🤖',
    color: 'from-blue-500/20 to-blue-950/40 border-blue-500/30 text-blue-300',
  },
  hard: {
    name: 'Ultron',
    title: 'Autonomous Sentinel',
    depth: 'Depth 10',
    elo: '~1850 ELO',
    avatar: '🧬',
    color: 'from-indigo-500/20 to-indigo-950/40 border-indigo-500/30 text-indigo-300',
  },
  insane: {
    name: 'T-800',
    title: 'Cyberdyne Assassin',
    depth: 'Depth 20',
    elo: '~2600+ ELO',
    avatar: '🔥',
    color: 'from-red-500/20 to-red-950/40 border-red-500/30 text-red-300',
  },
}

export function PlayerCard({
  isBot = false,
  side,
  difficulty = 'easy',
  isTurn,
  isThinking = false,
  fen,
  dynamicRoast,
  timeRemaining,
  showClock = false,
}: PlayerCardProps) {
  const meta = isBot ? DIFFICULTY_METADATA[difficulty] : null
  const sideColorCode = side === 'white' ? 'w' : 'b'

  return (
    <div
      className={`relative rounded-xl p-3 sm:p-4 border transition-all duration-300 ${
        isTurn
          ? 'bg-gradient-to-r from-white/[0.08] to-white/[0.03] border-yellow-500/60 shadow-lg shadow-yellow-500/10'
          : 'bg-[#14161E]/70 border-white/[0.06] opacity-90'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Avatar & Identity */}
        <div className="flex items-center gap-3">
          {/* Avatar with Turn Glow */}
          <div className="relative">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-gradient-to-b border shadow-inner ${
                isBot
                  ? meta?.color ?? 'from-yellow-500/20 to-transparent border-yellow-500/30'
                  : 'from-zinc-700/40 to-zinc-900 border-white/20 text-white'
              }`}
            >
              {isBot ? meta?.avatar : (side === 'white' ? '♔' : '♚')}
            </div>

            {/* Turn pulse ring */}
            {isTurn && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
              </span>
            )}
          </div>

          {/* Name & Title */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                {isBot ? meta?.name : 'You'}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                {side}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              {isBot ? (
                <>
                  <span>{meta?.title}</span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-yellow-400/90">{meta?.elo}</span>
                </>
              ) : (
                <span>Commander</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Engine Thinking state, Clock or Turn badge */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {showClock && timeRemaining !== undefined && (
              <div
                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center gap-1.5 transition ${
                  timeRemaining <= 30
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                    : isTurn
                    ? 'bg-white/10 text-yellow-300 border border-yellow-500/40 shadow-inner'
                    : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                }`}
              >
                <span className="text-[10px] text-zinc-400">⏱</span>
                <span>{formatClockTime(timeRemaining)}</span>
              </div>
            )}

            {isThinking && isBot ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[11px] font-semibold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                Thinking...
              </span>
            ) : isTurn ? (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-[10px] font-bold tracking-wider uppercase border border-yellow-500/30">
                To Move
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono">Waiting</span>
            )}
          </div>

          {/* Captured Pieces for this player */}
          <CapturedPieces fen={fen} color={sideColorCode} />
        </div>
      </div>

      {/* Dynamic Roast Box for Bot */}
      {isBot && dynamicRoast && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-start gap-2 text-xs text-zinc-300 italic">
          <span className="text-yellow-400 not-italic select-none">💬</span>
          <p className="line-clamp-2">“{dynamicRoast}”</p>
        </div>
      )}
    </div>
  )
}
