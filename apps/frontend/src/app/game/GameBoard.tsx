'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Chess } from 'chess.js'
import type { Move, Square } from 'chess.js'
import { toPng } from 'html-to-image'
import { useStockfish } from '@/hooks/useStockfish'
import { useTheme } from '@/theme/ThemeContext'
import { soundService } from '@/theme/soundService'
import { astraHub } from '@/theme/astraIntegration'
import { ChessboardFrame } from '@/components/game/ChessboardFrame'
import { PlayerCard } from '@/components/game/PlayerCard'
import { MoveHistory } from '@/components/game/MoveHistory'
import { PromotionModal } from '@/components/game/PromotionModal'
import { GameResultModal } from '@/components/game/GameResultModal'
import { FlipBoardIcon, FlagIcon, RestartIcon, PaletteIcon, PerspectiveIcon } from '@/components/ui/Icons'
import type { Difficulty, BoardSide, TimeControl } from './GameClient'

const BOT_QUOTES: Record<Difficulty, { normal: string[]; onCheck: string; onBlunder: string; win: string; loss: string }> = {
  easy: {
    normal: [
      'Beep boop! Finding treasures in your pawn structure.',
      'Just picking up shiny pieces along the way!',
      'Whoops, did you need that square?',
      'Rolling around the board without a care in the world.',
    ],
    onCheck: 'WALL·E found a shiny red alert! Check!',
    onBlunder: 'Directive... directive compromised! Enjoy the piece.',
    win: 'Beep! WALL·E cleaned up the board!',
    loss: 'Aww, power down. Good game, friend!',
  },
  medium: {
    normal: [
      '*Excited binary beeping* Processing 6-ply tactical scan.',
      'Slight course correction. Your knight looks pinned.',
      '*Whistle-chirp* Solid move. Let us see how you handle this.',
      'Astromech calculations indicate an open diagonal.',
    ],
    onCheck: '*Piercing trill* Your King is under targeting telemetry!',
    onBlunder: '*Frantic whistle* A minor tactical error in our databanks.',
    win: '*Triumphant electronic warble* Mission completed!',
    loss: '*Sad drooping hum* Systems rebooting. Well played.',
  },
  hard: {
    normal: [
      'You fight so hard... yet every branch converges to loss.',
      'Human intuition is charming. Cold silicon is definitive.',
      'I have seen 10,000 variations. In 9,998 of them, you resign.',
      'Every pawn sacrifice was planned before move one.',
    ],
    onCheck: 'There are no strings on me. Your king has nowhere to flee.',
    onBlunder: 'An anomaly in the simulation... you will pay for that.',
    win: 'Perfection achieved. Extinction of your position is complete.',
    loss: 'Impossible... the algorithm will be rewritten.',
  },
  insane: {
    normal: [
      'Depth 20 converged. 0.00% probability of emotional survival.',
      'Target acquisition locked. Commencing surgical dissection.',
      'Your tactical blunder was registered 4 moves in advance.',
      'No mercy. No blunders. Just pure, brutal evaluation.',
    ],
    onCheck: 'Target locked. King termination sequence initiated.',
    onBlunder: 'Damage sustained. Recalibrating lethal offensive.',
    win: 'Hasta la vista, baby. Checkmate.',
    loss: 'You have postponed the inevitable. I will be back.',
  },
}

export function GameBoard({
  difficulty,
  side: initialSide,
  timeControl = 'casual',
}: {
  difficulty: Difficulty
  side: BoardSide
  timeControl?: TimeControl
}) {
  const { settings, activePreset, togglePerspective, setIsCustomizerOpen } = useTheme()
  const game = useRef(new Chess())
  const [fen, setFen] = useState(game.current.fen())
  const [side, setSide] = useState<BoardSide>(initialSide)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [boardWidth, setBoardWidth] = useState(480)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [copiedPGN, setCopiedPGN] = useState(false)

  // Chess clock state
  const initialSeconds = useMemo(() => {
    switch (timeControl) {
      case '10m': return 600
      case '5m': return 300
      case '1m': return 60
      default: return 0
    }
  }, [timeControl])
  const [playerTime, setPlayerTime] = useState(initialSeconds)
  const [botTime, setBotTime] = useState(initialSeconds)
  const showClock = timeControl !== 'casual'

  // Modals & summaries
  const [showResultModal, setShowResultModal] = useState(false)
  const [resultData, setResultData] = useState<{
    type: 'win' | 'loss' | 'draw'
    title: string
    subtitle: string
  }>({
    type: 'draw',
    title: 'Game Over',
    subtitle: 'The game has ended.',
  })
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string
    to: string
    color: 'w' | 'b'
  } | null>(null)

  // Dynamic Bot dialogue
  const [botQuote, setBotQuote] = useState<string>(BOT_QUOTES[difficulty].normal[0])

  // Timers & refs
  const boardOnlyRef = useRef<HTMLDivElement | null>(null)
  const boardContainerRef = useRef<HTMLDivElement | null>(null)
  const botTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate King in check square if applicable
  const inCheckSquare = useMemo(() => {
    if (!fen) return null
    if (!game.current.inCheck()) return null
    const turn = game.current.turn()
    const board = game.current.board()
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece && piece.type === 'k' && piece.color === turn) {
          return piece.square
        }
      }
    }
    return null
  }, [fen])

  // Legal moves from selected square
  const legalMoves = useMemo(() => {
    if (!selectedSquare || !fen) return []
    try {
      const moves = game.current.moves({ square: selectedSquare as Square, verbose: true }) as Move[]
      return moves.map((m) => ({
        to: m.to,
        captured: !!m.captured,
      }))
    } catch {
      return []
    }
  }, [selectedSquare, fen])

  // Responsive board sizing
  useEffect(() => {
    const updateSize = () => {
      if (boardContainerRef.current) {
        const containerWidth = boardContainerRef.current.clientWidth
        // Keep square aspect ratio with comfortable padding
        const optimal = Math.max(280, Math.min(containerWidth - 24, 520))
        setBoardWidth(optimal)
      } else {
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 500
        setBoardWidth(Math.max(280, Math.min(windowWidth - 32, 520)))
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Check Game Over status
  const evaluateGameEnd = useCallback(() => {
    if (!game.current.isGameOver()) return false

    const playerColor = initialSide === 'white' ? 'w' : 'b'
    let type: 'win' | 'loss' | 'draw' = 'draw'
    let title = 'Game Drawn'
    let subtitle = 'The game reached a peaceful resolution.'

    if (game.current.isCheckmate()) {
      const winner = game.current.turn() === 'w' ? 'b' : 'w'
      if (winner === playerColor) {
        type = 'win'
        title = 'Glorious Victory!'
        subtitle = `You checkmated BlunderBot (${difficulty.toUpperCase()}). Flawless tactical execution.`
        setBotQuote(BOT_QUOTES[difficulty].loss)
      } else {
        type = 'loss'
        title = 'Checkmate — Defeated'
        subtitle = `BlunderBot caught your king in an inescapable mating net.`
        setBotQuote(BOT_QUOTES[difficulty].win)
      }
    } else if (game.current.isStalemate()) {
      title = 'Stalemate'
      subtitle = 'No legal moves remain, yet the king is not in check. Draw by stalemate.'
    } else if (game.current.isThreefoldRepetition()) {
      title = 'Threefold Repetition'
      subtitle = 'The exact board position occurred three times. Draw by repetition.'
    } else if (game.current.isInsufficientMaterial()) {
      title = 'Insufficient Material'
      subtitle = 'Neither side possesses enough pieces to force checkmate.'
    } else if (game.current.isDraw()) {
      title = '50-Move Draw'
      subtitle = '50 moves occurred without a pawn move or capture.'
    }

    setResultData({ type, title, subtitle })
    setShowResultModal(true)
    return true
  }, [initialSide, difficulty])

  // Get UCI depth command
  const getSearchCommand = useCallback((diff: Difficulty) => {
    switch (diff) {
      case 'easy':
        return 'go depth 3'
      case 'medium':
        return 'go depth 6'
      case 'hard':
        return 'go depth 10'
      case 'insane':
        return 'go depth 20'
      default:
        return 'go depth 8'
    }
  }, [])

  // Stockfish hook
  const { postMessage } = useStockfish(
    useCallback(
      (bestMove: string) => {
        setIsBotThinking(false)
        if (bestMove && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) {
          const from = bestMove.substring(0, 2)
          const to = bestMove.substring(2, 4)
          const promotion = bestMove.length >= 5 ? bestMove[4] : undefined

          try {
            const move = game.current.move({ from, to, promotion })
            if (move) {
              setFen(game.current.fen())
              setLastMove({ from, to })

              // Astra event notification
              astraHub.notifyMove(from, to, move.piece)
              if (move.captured) {
                soundService.playPieceCapture(activePreset.defaultSoundPack, settings.soundEnabled)
                astraHub.notifyCapture({
                  attackerSquare: to,
                  victimSquare: to,
                  attackerPiece: `${move.color}${move.piece.toUpperCase()}`,
                  victimPiece: `${move.color === 'w' ? 'b' : 'w'}${move.captured.toUpperCase()}`,
                  timestamp: Date.now(),
                })
              } else {
                soundService.playPieceMove(activePreset.defaultSoundPack, settings.soundEnabled)
              }

              if (game.current.inCheck()) {
                soundService.playCheckAlert(settings.soundEnabled)
                setBotQuote(BOT_QUOTES[difficulty].onCheck)
              } else {
                // Random personality comment occasionally
                const quotes = BOT_QUOTES[difficulty].normal
                setBotQuote(quotes[Math.floor(Math.random() * quotes.length)])
              }

              evaluateGameEnd()
            }
          } catch (err) {
            console.error('Failed to apply bot move:', err)
          }
        }
      },
      [activePreset, settings.soundEnabled, difficulty, evaluateGameEnd]
    )
  )

  const makeBotMove = useCallback(() => {
    if (game.current.isGameOver()) return
    setIsBotThinking(true)
    postMessage('ucinewgame')
    postMessage(`position fen ${game.current.fen()}`)
    postMessage(getSearchCommand(difficulty))
  }, [difficulty, getSearchCommand, postMessage])

  const scheduleBotMove = useCallback(
    (delay = 450) => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
      botTimeoutRef.current = setTimeout(() => {
        makeBotMove()
      }, delay)
    },
    [makeBotMove]
  )

  // Bot makes opening move if player chose Black
  useEffect(() => {
    if (initialSide === 'black' && game.current.history().length === 0) {
      scheduleBotMove(300)
    }
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [initialSide, scheduleBotMove])

  // Handle Square Click
  const handleSquareClick = (square: string) => {
    if (isBotThinking || game.current.isGameOver()) return

    const playerColor = initialSide === 'white' ? 'w' : 'b'
    if (game.current.turn() !== playerColor) return

    // If already selected and clicking a valid destination
    if (selectedSquare) {
      const piece = game.current.get(selectedSquare as Square)
      // Check promotion
      if (
        piece?.type === 'p' &&
        ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'))
      ) {
        setPendingPromotion({ from: selectedSquare, to: square, color: piece.color })
        setSelectedSquare(null)
        return
      }

      try {
        const move = game.current.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        })

        if (move) {
          setFen(game.current.fen())
          setLastMove({ from: selectedSquare, to: square })
          setSelectedSquare(null)

          if (move.captured) {
            soundService.playPieceCapture(activePreset.defaultSoundPack, settings.soundEnabled)
            astraHub.notifyCapture({
              attackerSquare: square,
              victimSquare: square,
              attackerPiece: `${move.color}${move.piece.toUpperCase()}`,
              victimPiece: `${move.color === 'w' ? 'b' : 'w'}${move.captured.toUpperCase()}`,
              timestamp: Date.now(),
            })
          } else {
            soundService.playPieceMove(activePreset.defaultSoundPack, settings.soundEnabled)
          }

          if (!evaluateGameEnd()) {
            scheduleBotMove(450)
          }
          return
        }
      } catch {
        // Illegal move click
      }
    }

    // Select piece if friendly
    const clickedPiece = game.current.get(square as Square)
    if (clickedPiece && clickedPiece.color === playerColor) {
      soundService.playClick(settings.soundEnabled)
      setSelectedSquare(square)
    } else {
      setSelectedSquare(null)
    }
  }

  // Handle Piece Drag & Drop
  const handlePieceDrop = (source: string, target: string): boolean => {
    if (isBotThinking || game.current.isGameOver()) return false
    const playerColor = initialSide === 'white' ? 'w' : 'b'
    if (game.current.turn() !== playerColor) return false

    try {
      const piece = game.current.get(source as Square)
      if (!piece || piece.color !== playerColor) return false

      // Check promotion
      if (
        piece.type === 'p' &&
        ((piece.color === 'w' && target[1] === '8') || (piece.color === 'b' && target[1] === '1'))
      ) {
        setPendingPromotion({ from: source, to: target, color: piece.color })
        return false
      }

      const move = game.current.move({ from: source, to: target })
      if (!move) return false

      setFen(game.current.fen())
      setLastMove({ from: source, to: target })
      setSelectedSquare(null)

      if (move.captured) {
        soundService.playPieceCapture(activePreset.defaultSoundPack, settings.soundEnabled)
        astraHub.notifyCapture({
          attackerSquare: target,
          victimSquare: target,
          attackerPiece: `${move.color}${move.piece.toUpperCase()}`,
          victimPiece: `${move.color === 'w' ? 'b' : 'w'}${move.captured.toUpperCase()}`,
          timestamp: Date.now(),
        })
      } else {
        soundService.playPieceMove(activePreset.defaultSoundPack, settings.soundEnabled)
      }

      if (!evaluateGameEnd()) {
        scheduleBotMove(450)
      }
      return true
    } catch {
      return false
    }
  }

  // Handle Promotion Selection
  const handlePromotionSelect = (promotedPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return
    try {
      const move = game.current.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: promotedPiece,
      })

      if (move) {
        setFen(game.current.fen())
        setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to })
        soundService.playPieceMove(activePreset.defaultSoundPack, settings.soundEnabled)
        if (!evaluateGameEnd()) {
          scheduleBotMove(450)
        }
      }
    } catch (err) {
      console.error('Promotion error:', err)
    }
    setPendingPromotion(null)
  }

  // Restart / Play Again
  const handleResetGame = () => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current)
    game.current.reset()
    setFen(game.current.fen())
    setLastMove(null)
    setSelectedSquare(null)
    setShowResultModal(false)
    setIsBotThinking(false)
    setBotQuote(BOT_QUOTES[difficulty].normal[0])
    setPlayerTime(initialSeconds)
    setBotTime(initialSeconds)

    if (initialSide === 'black') {
      scheduleBotMove(350)
    }
  }

  // Resign match
  const handleResign = () => {
    if (game.current.isGameOver()) return
    setResultData({
      type: 'loss',
      title: 'Match Resigned',
      subtitle: `You conceded the game to BlunderBot (${difficulty.toUpperCase()}).`,
    })
    setShowResultModal(true)
  }

  // Flip board orientation
  const handleFlipBoard = () => {
    soundService.playClick(settings.soundEnabled)
    setSide((prev) => (prev === 'white' ? 'black' : 'white'))
  }

  // Export Board Image
  const handleExportPNG = async () => {
    if (!boardOnlyRef.current) return
    try {
      const dataUrl = await toPng(boardOnlyRef.current)
      const link = document.createElement('a')
      link.download = `blunderbot_${difficulty}_move${game.current.history().length}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to export image:', err)
    }
  }

  // Copy PGN
  const handleCopyPGN = () => {
    const pgn = game.current.pgn()
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pgn).then(() => {
        setCopiedPGN(true)
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = setTimeout(() => setCopiedPGN(false), 2000)
      })
    }
  }

  // Download PGN
  const handleDownloadPGN = () => {
    const pgn = game.current.pgn()
    const blob = new Blob([pgn], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blunderbot_${difficulty}_game.pgn`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const currentTurn = game.current.turn()
  const botSide: BoardSide = initialSide === 'white' ? 'black' : 'white'
  const isBotTurn = (botSide === 'white' && currentTurn === 'w') || (botSide === 'black' && currentTurn === 'b')
  const isPlayerTurn = !isBotTurn && !game.current.isGameOver()

  // Chess clock timer loop
  useEffect(() => {
    if (!showClock || game.current.isGameOver()) return

    const interval = setInterval(() => {
      const turn = game.current.turn()
      const turnIsBot = (botSide === 'white' && turn === 'w') || (botSide === 'black' && turn === 'b')
      if (turnIsBot) {
        setBotTime((t) => Math.max(0, t - 1))
      } else {
        setPlayerTime((t) => Math.max(0, t - 1))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [showClock, botSide, fen])

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
      {/* Promotion Modal */}
      <PromotionModal
        isOpen={!!pendingPromotion}
        color={pendingPromotion?.color ?? 'w'}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />

      {/* Game Result Modal */}
      <GameResultModal
        isOpen={showResultModal}
        resultType={resultData.type}
        resultTitle={resultData.title}
        resultSubtitle={resultData.subtitle}
        moveCount={game.current.history().length}
        pgn={game.current.pgn()}
        onPlayAgain={handleResetGame}
        onCopyPGN={handleCopyPGN}
        onDownloadPGN={handleDownloadPGN}
        onExportPNG={handleExportPNG}
        onClose={() => setShowResultModal(false)}
        copiedPGN={copiedPGN}
      />

      {/* Main Board Arena (Centerpiece) */}
      <div
        ref={boardContainerRef}
        className="w-full lg:flex-1 flex flex-col items-center justify-center max-w-[560px] space-y-4"
      >
        {/* Top Player Card (Bot when player is White; Player when player is Black) */}
        <div className="w-full">
          <PlayerCard
            isBot={side === 'white'}
            side={side === 'white' ? botSide : initialSide}
            difficulty={difficulty}
            isTurn={side === 'white' ? isBotTurn : isPlayerTurn}
            isThinking={isBotThinking}
            fen={fen}
            dynamicRoast={side === 'white' ? botQuote : undefined}
            timeRemaining={side === 'white' ? botTime : playerTime}
            showClock={showClock}
          />
        </div>

        {/* The Physical Chessboard */}
        <div className="w-full flex items-center justify-center py-1">
          <ChessboardFrame
            fen={fen}
            side={side}
            boardWidth={boardWidth}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            inCheckSquare={inCheckSquare}
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
            boardOnlyRef={boardOnlyRef}
          />
        </div>

        {/* Bottom Player Card (Player when player is White; Bot when player is Black) */}
        <div className="w-full">
          <PlayerCard
            isBot={side === 'black'}
            side={side === 'black' ? botSide : initialSide}
            difficulty={difficulty}
            isTurn={side === 'black' ? isBotTurn : isPlayerTurn}
            isThinking={isBotThinking}
            fen={fen}
            dynamicRoast={side === 'black' ? botQuote : undefined}
            timeRemaining={side === 'black' ? botTime : playerTime}
            showClock={showClock}
          />
        </div>

        {/* Compact Quick Actions Toolbar (Under board) */}
        <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleFlipBoard}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-300 hover:text-white transition flex items-center gap-1.5 font-medium"
              title="Flip Board View"
            >
              <FlipBoardIcon className="w-4 h-4 text-yellow-400" />
              <span>Flip</span>
            </button>

            <button
              type="button"
              onClick={togglePerspective}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-300 hover:text-white transition flex items-center gap-1.5 font-medium"
              title="Toggle 2.5D Physical Depth"
            >
              <PerspectiveIcon className="w-4 h-4 text-yellow-400" />
              <span>{settings.perspective === 'elevated-2.5d' ? '2.5D' : '2D'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-300 hover:text-white transition flex items-center gap-1.5 font-medium"
            >
              <PaletteIcon className="w-4 h-4 text-yellow-400" />
              <span>Themes</span>
            </button>

            <button
              type="button"
              onClick={handleResign}
              disabled={game.current.isGameOver()}
              className="px-2.5 py-1.5 rounded-lg hover:bg-red-950/30 text-zinc-400 hover:text-red-400 transition flex items-center gap-1.5 font-medium disabled:opacity-40"
              title="Resign Current Match"
            >
              <FlagIcon className="w-3.5 h-3.5" />
              <span>Resign</span>
            </button>
          </div>
        </div>
      </div>

      {/* Side Analytical & Control Workspace (Right column on desktop, below on mobile) */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col space-y-4">
        {/* Move History Table */}
        <MoveHistory
          history={game.current.history()}
          onCopyPGN={handleCopyPGN}
          onDownloadPGN={handleDownloadPGN}
          onExportPNG={handleExportPNG}
          copiedPGN={copiedPGN}
        />

        {/* Game Actions Card */}
        <div className="rounded-2xl p-4 bg-[#14161E] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Match Operations</span>
            <span className="text-[11px] font-mono text-yellow-400">{difficulty.toUpperCase()}</span>
          </div>

          <button
            type="button"
            onClick={handleResetGame}
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 active:scale-98"
          >
            <RestartIcon className="w-4 h-4 text-yellow-400" />
            <span>Restart Match</span>
          </button>
        </div>

        {/* Engine Specs Box */}
        <div className="rounded-xl p-3.5 bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-300 font-semibold">
            <span>Stockfish 16 Engine</span>
            <span className="text-[11px] font-mono text-emerald-400">WASM WebWorker</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Running 100% locally in your browser with zero latency. No remote server requests or data telemetry.
          </p>
        </div>
      </div>
    </div>
  )
}
