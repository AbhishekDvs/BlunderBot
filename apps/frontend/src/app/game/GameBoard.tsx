'use client'

import { useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'

export function GameBoard({ difficulty }: { difficulty: string }) {
  const game = useRef(new Chess())
  const [fen, setFen] = useState(game.current.fen())
  const [gameOver, setGameOver] = useState(false)
  const [resultMessage, setResultMessage] = useState('')

  const pieceNames = ['P', 'N', 'B', 'R', 'Q', 'K']
  const colors = ['w', 'b']

  const pirouettiPieces = Object.fromEntries(
    colors.flatMap(color =>
      pieceNames.map(name => {
        const code = `${color}${name}`
        return [
          code,
          () => (
            <img
              src={`/pieces/pirouetti/${code}.svg`}
              alt={code}
              className="w-full h-full select-none pointer-events-none neon-piece"
              draggable={false}
            />
          )
        ]
      })
    )
  )

  function handleGameOver() {
    let message = ''

    if (game.current.isCheckmate()) {
      message = game.current.turn() === 'w' ? '💀 BlunderBot wins!' : '🎉 You win!'
    } else if (game.current.isDraw()) {
      message = '🤝 It’s a draw!'
    } else {
      message = 'Game over!'
    }

    setResultMessage(message)
    setGameOver(true)
  }

  function makeBotMove() {
    if (game.current.isGameOver()) return

    const possibleMoves = game.current.moves()
    if (possibleMoves.length === 0) return

    const randomMove =
      possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
    game.current.move(randomMove)
    setFen(game.current.fen())

    console.log(`[BOT (${difficulty})] plays: ${randomMove}`)

    if (game.current.isGameOver()) {
      handleGameOver()
    }
  }

  const handlePieceDrop = (source: string, target: string): boolean => {
    const move = game.current.move({
      from: source,
      to: target,
      promotion: 'q'
    })

    if (!move) return false

    setFen(game.current.fen())
    console.log(`[YOU] played: ${move.san}`)

    if (game.current.isGameOver()) {
      handleGameOver()
    } else {
      setTimeout(makeBotMove, 500)
    }

    return true
  }

  const resetGame = () => {
    game.current.reset()
    setFen(game.current.fen())
    setGameOver(false)
    setResultMessage('')
  }

  return (
    <div className="relative w-full max-w-[500px] aspect-square mx-auto">
      <Chessboard
        position={fen}
        onPieceDrop={handlePieceDrop}
        customPieces={pirouettiPieces}
        boardOrientation="white"
        boardWidth={500}
        customBoardStyle={{
          borderRadius: '1rem',
          backgroundColor: '#000814',
          boxShadow: '0 0 40px #00ffe0, 0 0 20px #ff00f7 inset'
        }}
        customLightSquareStyle={{ backgroundColor: '#00ffe0' }}
        customDarkSquareStyle={{ backgroundColor: '#8e05c2' }}
      />

      {gameOver && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
          <div className="bg-gradient-to-br from-purple-900 to-black border-2 border-pink-500 text-white p-6 rounded-xl shadow-xl w-[90%] max-w-xs text-center neon-modal">
            <h2 className="text-2xl font-bold mb-2">🧠 Game Over</h2>
            <p className="text-lg mb-4">{resultMessage}</p>
            <button
              className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 transition-all duration-200 shadow-lg"
              onClick={resetGame}
            >
              🔁 Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
