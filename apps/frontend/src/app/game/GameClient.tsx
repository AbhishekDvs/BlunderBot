'use client'

import { useState } from 'react'
import { GameBoard } from './GameBoard'
import { NewGameButton } from './NewGameButton'
import { useSearchParams } from 'next/navigation'
import { boardThemes, BoardThemeKey } from '@/constants/themes'

type PieceStyle = 'default' | 'pirouetti' | 'chestnut'

export default function GameClient() {
  const searchParams = useSearchParams()
  const difficulty = searchParams.get('difficulty') || 'easy'
  const side = searchParams.get('side') === 'black' ? 'black' : 'white'
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>('default')
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>('default')

  return (
    <main className="min-h-screen bg-[#1F1D2B] text-white flex flex-col-reverse md:flex-row">
      <div className="w-full md:w-1/4 bg-[#2A2937] p-4 space-y-4 border-t md:border-t-0 md:border-l border-gray-700">
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
            onChange={(e) => setPieceStyle(e.target.value as PieceStyle)}
          >
            <option value="default">♟️ Default</option>
            <option value="pirouetti">🎭 Pirouetti</option>
            <option value="chestnut">🌰 Chessnut</option>
          </select>
        </div>

        <div className="text-sm text-gray-300">
          Board Theme
          <div className="flex flex-wrap gap-2 mt-1">
            {(Object.keys(boardThemes) as BoardThemeKey[]).map((theme) => (
              <button
                key={theme}
                onClick={() => setBoardTheme(theme)}
                className={`cursor-pointer px-3 py-1 rounded ${
                  boardTheme === theme ? 'bg-yellow-200 text-black' : 'bg-gray-700'
                }`}
              >
                {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <NewGameButton />
      </div>

      <div className="w-full md:w-3/4 flex items-center justify-center p-4">
        <GameBoard
          difficulty={difficulty}
          pieceStyle={pieceStyle}
          side={side}
          boardTheme={boardTheme}
        />
      </div>
    </main>
  )
}
