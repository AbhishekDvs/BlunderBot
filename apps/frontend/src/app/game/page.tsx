'use client'

import { useState, Suspense } from 'react'
import { GameBoard } from './GameBoard'
import { NewGameButton } from './NewGameButton'
import { useSearchParams } from 'next/navigation'

export default function GamePage() {
  const searchParams = useSearchParams()
  const difficulty = searchParams.get('difficulty') || 'easy'
  const [pieceStyle, setPieceStyle] = useState<'default' | 'pirouetti' | 'chestnut'>('pirouetti')
  const side = searchParams.get('side') === 'black' ? 'black' : 'white'

  return (
    <main className="min-h-screen bg-[#1F1D2B] text-white flex flex-col md:flex-row">
      <div className="w-full md:w-3/4 flex items-center justify-center p-4">
        <Suspense fallback={<div>Loading board...</div>}>
          <GameBoard difficulty={difficulty} pieceStyle={pieceStyle} side={side} />
        </Suspense>
      </div>

      <div className="w-full md:w-1/4 bg-[#2A2937] p-4 space-y-4 border-l border-gray-700">
        <h2 className="text-xl font-bold text-yellow-400">BlunderBot Says:</h2>

        <div className="bg-[#3A3949] p-3 rounded-xl shadow-inner text-sm">
          “Nice move. If your goal is to lose.”
        </div>

        <div className="text-sm text-gray-300">
          Difficulty: <span className="capitalize">{difficulty}</span>
        </div>

        <div>
          <label htmlFor="pieceStyle" className="block text-sm font-medium text-gray-300 mb-1">
            Piece Style
          </label>
          <select
            id="pieceStyle"
            className="w-full p-2 rounded bg-[#3A3949] text-white text-sm shadow-inner"
            value={pieceStyle}
            onChange={(e) => setPieceStyle(e.target.value as any)}
          >
            <option value="default">♟️ Default</option>
            <option value="pirouetti">🎭 Pirouetti</option>
            <option value="chestnut">🌰 Chessnut</option>
          </select>
        </div>

        <NewGameButton />
      </div>
    </main>
  )
}
