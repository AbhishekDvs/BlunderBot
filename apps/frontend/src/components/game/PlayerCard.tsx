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
  { name: string; title: string; depth: string; elo: string; avatar: string; colorClass: string }
> = {
  easy: {
    name: 'WALL·E',
    title: 'Scrap Collector',
    depth: 'Depth 3',
    elo: '~800',
    avatar: '♻️',
    colorClass: 'bg-[#438A69]/20 border-[#438A69]/40 text-[#438A69]',
  },
  medium: {
    name: 'R2-D2',
    title: 'Tactical Astromech',
    depth: 'Depth 6',
    elo: '~1350',
    avatar: '🤖',
    colorClass: 'bg-sky-500/20 border-sky-500/40 text-sky-400',
  },
  hard: {
    name: 'Ultron',
    title: 'Autonomous Sentinel',
    depth: 'Depth 10',
    elo: '~1850',
    avatar: '🧬',
    colorClass: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  },
  insane: {
    name: 'T-800',
    title: 'Cyberdyne Assassin',
    depth: 'Depth 20',
    elo: '~2600+',
    avatar: '🔥',
    colorClass: 'bg-red-500/20 border-red-500/40 text-red-400',
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
  const showThinking = isBot && isThinking

  return (
    <div
      className={`w-full rounded-xl px-3 py-2 border transition-all duration-300 flex items-center justify-between gap-3 ${
        isTurn
          ? 'tactical-panel-active'
          : 'tactical-panel opacity-95'
      }`}
    >
      {/* Left: Player Identity & Emblem */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex-shrink-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg border shadow-inner ${
              isBot
                ? meta?.colorClass ?? 'bg-[#1C232D] border-[#283341] text-[#DDAA57]'
                : 'bg-[#1C232D] border-[#2D3847] text-[#F5F6F8]'
            }`}
          >
            {isBot ? meta?.avatar : (side === 'white' ? '♔' : '♚')}
          </div>

          {/* Active Turn Indicator Ring */}
          {isTurn && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DDAA57] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#DDAA57]" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-xs sm:text-sm text-[#F5F6F8] truncate">
              {isBot ? meta?.name : 'Commander'}
            </span>
            <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-1 py-0.2 rounded bg-[#11151B] text-[#84919D] border border-[#202832]">
              {side === 'white' ? 'White' : 'Black'}
            </span>
            {isBot && (
              <span className="text-[10px] font-mono text-[#DDAA57] hidden sm:inline">
                {meta?.elo}
              </span>
            )}
          </div>

          {/* Contextual Subtitle or Roast */}
          <div className="text-[11px] text-[#84919D] truncate">
            {showThinking ? (
              <span className="text-[#DDAA57] font-semibold animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DDAA57] animate-ping" />
                Calculating line...
              </span>
            ) : isBot && dynamicRoast ? (
              <span className="italic truncate text-[#84919D]">“{dynamicRoast}”</span>
            ) : (
              <span>{isBot ? meta?.title : 'Local Player'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Captured Pieces & Chess Clock */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Captured Pieces Inline */}
        <CapturedPieces fen={fen} color={sideColorCode} />

        {/* Digital Clock */}
        {showClock && timeRemaining !== undefined && (
          <div
            className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center gap-1.5 transition ${
              timeRemaining <= 30
                ? 'bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse'
                : isTurn
                ? 'bg-[#DDAA57]/15 text-[#DDAA57] border border-[#DDAA57]/40 shadow-inner'
                : 'bg-[#11151B] text-[#84919D] border border-[#202832]'
            }`}
          >
            <span className="text-[10px]">⏱</span>
            <span>{formatClockTime(timeRemaining)}</span>
          </div>
        )}

        {/* Turn Pill */}
        <div className="hidden sm:block">
          {showThinking ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#DDAA57]/20 text-[#DDAA57] border border-[#DDAA57]/30">
              Thinking
            </span>
          ) : isTurn ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#438A69]/20 text-emerald-400 border border-[#438A69]/40">
              Turn
            </span>
          ) : (
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#11151B] text-[#84919D] border border-[#202832]">
              Wait
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
