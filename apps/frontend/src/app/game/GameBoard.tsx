'use client'

import { useRef, useState , useEffect } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { BoardOrientation } from 'react-chessboard/dist/chessboard/types'
import { useStockfish } from '@/hooks/useStockfish'

type PieceStyle = 'default' | 'pirouetti' | 'chestnut'

export function GameBoard({
  difficulty,
  pieceStyle,
  side
}: {
  difficulty: string
  pieceStyle: PieceStyle,
  side:BoardOrientation
}) {
  const { postMessage } = useStockfish((bestMove: string) => {
    if (bestMove && bestMove.length === 4) {
      const move = game.current.move({
        from: bestMove.substring(0, 2),
        to: bestMove.substring(2, 4),
        promotion: 'q'
      });

      if (move) {
        setFen(game.current.fen());
        console.log(`[SF BOT (${difficulty})] plays: ${move.san}`);
        if (game.current.isGameOver()) handleGameOver();
      }
    }
  });

  const game = useRef(new Chess())
  const [fen, setFen] = useState(game.current.fen())
  const [gameOver, setGameOver] = useState(false)
  const [resultMessage, setResultMessage] = useState('')

  const pieceNames = ['P', 'N', 'B', 'R', 'Q', 'K']
  const colors = ['w', 'b']

  useEffect(() => {
    if (side === 'black') {
      // Human is black, bot plays first as white
      makeBotMove()
    }
  }, [side])


  function getCustomPieces(style: string) {
    if (style === 'default') return undefined

    const basePath = `/pieces/${style}`

    return Object.fromEntries(
      colors.flatMap(color =>
        pieceNames.map(name => {
          const code = `${color}${name}`
          return [
            code,
            ({ squareWidth }: { squareWidth: number }) => (
              <img
                src={`${basePath}/${code}.svg`}
                alt={code}
                width={squareWidth}
                height={squareWidth}
                draggable={false}
                style={{
                  pointerEvents: 'none',
                  userSelect: 'none',
                  display: 'block'
                }}
              />
            )
          ]
        })
      )
    )
  }

  function handleGameOver() {
    let message = ''

    if (game.current.isCheckmate()) {
      message = game.current.turn() === 'w' ? '💀 BlunderBot wins!' : '🎉 You win!'
    } else if (game.current.isDraw()) {
      message = "🤝 It's a draw!"
    } else {
      message = 'Game over!'
    }

    setResultMessage(message)
    setGameOver(true)
  }

  const getSearchCommand = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'go depth 5';
      case 'medium': return 'go depth 10';
      case 'hard': return 'go depth 14';
      case 'insane': return 'go depth 20';
      default: return 'go depth 8';
    }
  };


  function makeBotMove() {
  if (game.current.isGameOver()) return;

    postMessage('ucinewgame');
    postMessage(`position fen ${game.current.fen()}`);
    postMessage(getSearchCommand(difficulty));
  }


  // function makeBotMove() {
  //   if (game.current.isGameOver()) return

  //   const possibleMoves = game.current.moves()
  //   if (possibleMoves.length === 0) return

  //   const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
  //   game.current.move(randomMove)
  //   setFen(game.current.fen())

  //   console.log(`[BOT (${difficulty})] plays: ${randomMove}`)

  //   if (game.current.isGameOver()) {
  //     handleGameOver()
  //   }
  // }

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
      const turn = game.current.turn()
      const botColor = side === 'white' ? 'b' : 'w'
      if (turn === botColor) {
        setTimeout(makeBotMove, 300)
      }
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
        customPieces={getCustomPieces(pieceStyle)}
        boardOrientation={side}
        animationDuration={side === 'black' ? 0 : 300}
        boardWidth={500}
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
