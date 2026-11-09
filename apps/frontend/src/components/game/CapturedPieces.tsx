'use client'

import React, { useMemo } from 'react'

interface CapturedPiecesProps {
  fen: string
  color: 'w' | 'b' // 'w' means display pieces captured BY White (i.e. black pieces taken)
  className?: string
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
}

const PIECE_UNICODE: Record<string, Record<string, string>> = {
  w: {
    q: '♕',
    r: '♖',
    b: '♗',
    n: '♘',
    p: '♙',
  },
  b: {
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟',
  },
}

const STARTING_COUNTS: Record<string, number> = {
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
}

export function CapturedPieces({ fen, color, className = '' }: CapturedPiecesProps) {
  const { capturedPieces, materialDiff } = useMemo(() => {
    const [boardPart] = fen.split(' ')
    const onBoard = {
      w: { q: 0, r: 0, b: 0, n: 0, p: 0 },
      b: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    }

    for (const char of boardPart) {
      const lower = char.toLowerCase()
      if (['q', 'r', 'b', 'n', 'p'].includes(lower)) {
        const side = char === char.toUpperCase() ? 'w' : 'b'
        onBoard[side][lower as 'q' | 'r' | 'b' | 'n' | 'p']++
      }
    }

    // Pieces taken BY White = Black pieces missing from board
    // Pieces taken BY Black = White pieces missing from board
    const opponentSide = color === 'w' ? 'b' : 'w'
    const friendlySide = color

    const capturedByFriendly: { piece: string; count: number }[] = []
    let friendlyScore = 0
    let opponentScore = 0

    const order: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p']

    for (const p of order) {
      const missingOpponent = Math.max(0, STARTING_COUNTS[p] - onBoard[opponentSide][p])
      const missingFriendly = Math.max(0, STARTING_COUNTS[p] - onBoard[friendlySide][p])

      if (missingOpponent > 0) {
        capturedByFriendly.push({ piece: p, count: missingOpponent })
      }

      friendlyScore += missingOpponent * PIECE_VALUES[p]
      opponentScore += missingFriendly * PIECE_VALUES[p]
    }

    const materialDiff = friendlyScore - opponentScore

    return { capturedPieces: capturedByFriendly, materialDiff }
  }, [fen, color])

  const opponentSide = color === 'w' ? 'b' : 'w'

  if (capturedPieces.length === 0 && materialDiff <= 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-1 min-h-[20px] flex-nowrap ${className}`}>
      {capturedPieces.map(({ piece, count }) => (
        <span
          key={piece}
          className="inline-flex items-center text-xs font-serif select-none px-1 py-0.5 rounded bg-[#11151B] border border-[#202832] text-[#F5F6F8]"
          title={`${count}x ${piece.toUpperCase()}`}
        >
          {PIECE_UNICODE[opponentSide][piece]}
          {count > 1 && <span className="text-[9px] font-sans font-bold text-[#84919D] ml-0.5">{count}</span>}
        </span>
      ))}

      {materialDiff > 0 && (
        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-[#438A69]/20 text-emerald-400 border border-[#438A69]/40">
          +{materialDiff}
        </span>
      )}
    </div>
  )
}
