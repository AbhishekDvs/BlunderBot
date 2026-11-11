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
import {
  FlipBoardIcon,
  FlagIcon,
  RestartIcon,
  PaletteIcon,
  PerspectiveIcon,
  HistoryIcon,
  CloseIcon,
} from '@/components/ui/Icons'
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
  difficulty: initialDifficulty,
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
  const [boardWidth, setBoardWidth] = useState(520)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [copiedPGN, setCopiedPGN] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty)

  // Layout presentation modes
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<'board' | 'history' | 'controls'>('board')

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
  const [isEndingSequencePending, setIsEndingSequencePending] = useState(false)
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
  const resultModalTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Responsive board sizing: Height-aware on desktop, Width-aware on mobile
  useEffect(() => {
    const updateSize = () => {
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
      const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 900

      if (windowWidth < 1024) {
        // Mobile / Tablet: scale precisely to viewport width with comfortable edge margins
        const horizontalPadding = windowWidth < 640 ? 28 : 44
        const maxAvailable = windowWidth - horizontalPadding
        setBoardWidth(Math.max(280, Math.min(maxAvailable, 540)))
      } else {
        // Desktop: Fit top banner, board, bottom banner, and toolbar cleanly within 768px+ viewports
        const availableHeight = windowHeight - 250
        const maxDesktopWidth = isSidebarCollapsed ? 760 : 620
        const optimal = Math.max(380, Math.min(maxDesktopWidth, availableHeight))
        setBoardWidth(optimal)
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
      if (resultModalTimeoutRef.current) clearTimeout(resultModalTimeoutRef.current)
    }
  }, [isSidebarCollapsed])

  // Check Game Over status
  const evaluateGameEnd = useCallback(() => {
    if (!game.current.isGameOver()) return false

    const playerColor = initialSide === 'white' ? 'w' : 'b'
    let type: 'win' | 'loss' | 'draw' = 'draw'
    let title = 'Game Drawn'
    let subtitle = 'The game reached a peaceful resolution.'
    const cinematic=settings.perspective==='true-3d' && settings.animationDuration>0
    const presentationComplete=()=> { setIsEndingSequencePending(false);setShowResultModal(true) }
    let presentationHandled=false

    if (game.current.isCheckmate()) {
      const winner = game.current.turn() === 'w' ? 'b' : 'w'
      const outcome = winner === 'w' ? 'white_wins' : 'black_wins'
      presentationHandled=astraHub.notifyGameEnd(outcome,cinematic?presentationComplete:undefined)
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

    if (!game.current.isCheckmate()) {
      presentationHandled=astraHub.notifyGameEnd('draw',cinematic?presentationComplete:undefined)
    }

    setResultData({ type, title, subtitle })

    // For 2.5D War Chess, delay modal by 3800ms to allow royal salute/bow to finish unobstructed. For 2D, show in 750ms.
    if (resultModalTimeoutRef.current) clearTimeout(resultModalTimeoutRef.current)
    setIsEndingSequencePending(cinematic && presentationHandled)
    if (!cinematic || !presentationHandled) resultModalTimeoutRef.current=setTimeout(presentationComplete,750)
    return true
  }, [initialSide, difficulty, settings.perspective, settings.animationDuration])

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

  // Helper to dispatch authoritative move / capture animation events cleanly
  const dispatchMoveAnimation = useCallback(
    (move: Move) => {
      const pieceCode = `${move.color}${move.piece.toUpperCase()}`
      const isCastling = move.flags.includes('k') || move.flags.includes('q')
      const isEnPassant = move.flags.includes('e')

      if (move.captured) {
        const victimColor = move.color === 'w' ? 'b' : 'w'
        const capturedSquare = isEnPassant ? `${move.to[0]}${move.from[1]}` : move.to
        soundService.playPieceCapture(activePreset.defaultSoundPack, settings.soundEnabled)
        astraHub.notifyCapture({
          attackerSquare: move.from,
          victimSquare: move.to,
          attackerPiece: pieceCode,
          victimPiece: `${victimColor}${move.captured.toUpperCase()}`,
          isEnPassant,
          capturedSquare,
          promotion: move.promotion,
          beforeFen: move.before,
          afterFen: move.after,
          timestamp: Date.now(),
        })
      } else {
        soundService.playPieceMove(activePreset.defaultSoundPack, settings.soundEnabled)
        astraHub.notifyMove(move.from, move.to, pieceCode, {
          isCastling,
          promotion: move.promotion,
          beforeFen: move.before,
          afterFen: move.after,
        })
      }
    },
    [activePreset.defaultSoundPack, settings.soundEnabled]
  )

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
              dispatchMoveAnimation(move)

              if (game.current.inCheck()) {
                soundService.playCheckAlert(settings.soundEnabled)
                setBotQuote(BOT_QUOTES[difficulty].onCheck)
              } else {
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
      [dispatchMoveAnimation, settings.soundEnabled, difficulty, evaluateGameEnd]
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

  // Bot opening move if player chose Black
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
  const handleSquareClick = useCallback(
    (square: string) => {
      if (isBotThinking || game.current.isGameOver()) return

      const playerColor = initialSide === 'white' ? 'w' : 'b'
      if (game.current.turn() !== playerColor) return

      // If already selected and clicking a valid destination
      if (selectedSquare) {
        const piece = game.current.get(selectedSquare as Square)
        // Check promotion (only if clicking a legal destination rank 8/1)
        const legalTargets = game.current.moves({ square: selectedSquare as Square, verbose: true }) as Move[]
        const isLegalTarget = legalTargets.some((m) => m.to === square)
        if (
          isLegalTarget &&
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
            dispatchMoveAnimation(move)

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
    },
    [isBotThinking, initialSide, selectedSquare, dispatchMoveAnimation, evaluateGameEnd, scheduleBotMove, settings.soundEnabled]
  )

  // Handle Piece Drag & Drop
  const handlePieceDrop = useCallback(
    (source: string, target: string): boolean => {
      if (isBotThinking || game.current.isGameOver()) return false
      const playerColor = initialSide === 'white' ? 'w' : 'b'
      if (game.current.turn() !== playerColor) return false

      try {
        const piece = game.current.get(source as Square)
        if (!piece || piece.color !== playerColor) return false

        const legalTargets = game.current.moves({ square: source as Square, verbose: true }) as Move[]
        const isLegalTarget = legalTargets.some((m) => m.to === target)
        if (
          isLegalTarget &&
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
        dispatchMoveAnimation(move)

        if (!evaluateGameEnd()) {
          scheduleBotMove(450)
        }
        return true
      } catch {
        return false
      }
    },
    [isBotThinking, initialSide, dispatchMoveAnimation, evaluateGameEnd, scheduleBotMove]
  )

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
        dispatchMoveAnimation(move)
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
    if (resultModalTimeoutRef.current) clearTimeout(resultModalTimeoutRef.current)
    game.current.reset()
    astraHub.notifyGameReset()
    setFen(game.current.fen())
    setLastMove(null)
    setSelectedSquare(null)
    setPendingPromotion(null)
    setIsEndingSequencePending(false)
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
    const resignWinner = initialSide === 'white' ? 'black_wins' : 'white_wins'
    astraHub.notifyGameEnd(resignWinner)
    setResultData({
      type: 'loss',
      title: 'Match Resigned',
      subtitle: `You conceded the game to BlunderBot (${difficulty.toUpperCase()}).`,
    })
    const modalDelay = settings.perspective === 'true-3d' && settings.animationDuration > 0 ? 3800 : 500
    if (resultModalTimeoutRef.current) clearTimeout(resultModalTimeoutRef.current)
    setIsEndingSequencePending(settings.perspective === 'true-3d' && settings.animationDuration > 0)
    resultModalTimeoutRef.current = setTimeout(() => {
      setIsEndingSequencePending(false)
      setShowResultModal(true)
    }, modalDelay)
  }

  const handleSkipEnding = useCallback(() => {
    if (resultModalTimeoutRef.current) clearTimeout(resultModalTimeoutRef.current)
    setIsEndingSequencePending(false)
    setShowResultModal(true)
  }, [])

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
    <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-6 py-2 sm:py-4 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 sm:gap-6">
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

      {/* Main Board Arena (Centerpiece Dominance) */}
      <div
        ref={boardContainerRef}
        className={`w-full flex flex-col items-center justify-center transition-all duration-300 ${
          isSidebarCollapsed ? 'max-w-[820px]' : 'max-w-[680px]'
        } space-y-2 sm:space-y-3`}
      >
        {/* Top Player Banner */}
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
        <div className="relative w-full flex items-center justify-center py-0.5">
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
          {isEndingSequencePending && (
            <button
              type="button"
              onClick={handleSkipEnding}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#0C0F14]/90 hover:bg-[#1C232D] border border-[#DDAA57]/60 text-[#DDAA57] text-xs font-semibold shadow-xl backdrop-blur-md transition"
            >
              Skip Ending Sequence →
            </button>
          )}
        </div>

        {/* Bottom Player Banner */}
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

        {/* Tactical Quick Actions Toolbar (Under board) */}
        <div className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-[#11151B] border border-[#202832] text-xs shadow-inner">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleFlipBoard}
              className="px-2.5 py-1.5 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition flex items-center gap-1.5 font-medium"
              title="Flip Board View"
            >
              <FlipBoardIcon className="w-3.5 h-3.5 text-[#DDAA57]" />
              <span className="hidden sm:inline">Flip View</span>
            </button>

            <button
              type="button"
              onClick={togglePerspective}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0"
              title="Toggle Perspective: 2D Flat, 2.5D Depth, or 3D War Chess"
            >
              <PerspectiveIcon className="w-3.5 h-3.5 text-[#438A69] shrink-0" />
              <span>
                {settings.perspective === 'true-3d'
                  ? (settings.experimental3d ? '3D Exp' : '2.5D')
                  : settings.perspective === 'elevated-2.5d'
                  ? 'Tilted'
                  : '2D'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              className="px-2.5 py-1.5 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition flex items-center gap-1.5 font-medium"
              title="Customize Board Materials & Pieces"
            >
              <PaletteIcon className="w-3.5 h-3.5 text-[#DDAA57]" />
              <span className="hidden sm:inline">Theme</span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile History Sheet Trigger */}
            <button
              type="button"
              onClick={() => setMobileTab((t) => (t === 'history' ? 'board' : 'history'))}
              className={`lg:hidden px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 font-medium ${
                mobileTab === 'history'
                  ? 'bg-[#DDAA57]/20 border-[#DDAA57]/40 text-[#DDAA57]'
                  : 'hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] border-transparent'
              }`}
              title="Toggle Move History Drawer"
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              <span>Log</span>
            </button>

            <button
              type="button"
              onClick={handleResetGame}
              className="px-2.5 py-1.5 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition flex items-center gap-1.5 font-medium"
              title="Restart Match"
            >
              <RestartIcon className="w-3.5 h-3.5 text-[#DDAA57]" />
              <span className="hidden sm:inline">Restart</span>
            </button>

            <button
              type="button"
              onClick={handleResign}
              disabled={game.current.isGameOver()}
              className="px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-[#84919D] hover:text-red-400 transition flex items-center gap-1.5 font-medium disabled:opacity-40"
              title="Concede Match"
            >
              <FlagIcon className="w-3.5 h-3.5" />
              <span>Resign</span>
            </button>
          </div>
        </div>

        {/* Mobile History Slide-up Sheet */}
        {mobileTab === 'history' && (
          <div className="lg:hidden w-full tactical-panel p-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#202832]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F5F6F8]">
                Match Move Record
              </span>
              <button
                type="button"
                onClick={() => setMobileTab('board')}
                className="p-1 rounded text-[#84919D] hover:text-[#F5F6F8]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <MoveHistory
              history={game.current.history()}
              onCopyPGN={handleCopyPGN}
              onDownloadPGN={handleDownloadPGN}
              onExportPNG={handleExportPNG}
              copiedPGN={copiedPGN}
            />
          </div>
        )}
      </div>

      {/* Desktop Side Analytical & Operations HUD */}
      <div
        className={`hidden lg:flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'w-16' : 'w-80 xl:w-96'
        } space-y-3`}
      >
        {/* Sidebar Dock Toggle Banner */}
        <div className="tactical-panel px-3 py-2 rounded-xl flex items-center justify-between text-xs">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#438A69]" />
              <span className="font-bold uppercase tracking-wider text-[#F5F6F8] text-[11px]">
                Tactical Terminal
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="p-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#DDAA57] transition mx-auto"
            title={isSidebarCollapsed ? 'Expand HUD Panel' : 'Collapse HUD for Immersive Board Presentation'}
          >
            {isSidebarCollapsed ? (
              <span className="text-xs font-mono font-bold text-[#DDAA57]">« EXP</span>
            ) : (
              <span className="text-xs font-mono text-[#84919D] hover:text-[#F5F6F8]">COLLAPSE »</span>
            )}
          </button>
        </div>

        {!isSidebarCollapsed ? (
          <>
            {/* Move History Log */}
            <MoveHistory
              history={game.current.history()}
              onCopyPGN={handleCopyPGN}
              onDownloadPGN={handleDownloadPGN}
              onExportPNG={handleExportPNG}
              copiedPGN={copiedPGN}
            />

            {/* Tactical Match Operations Card */}
            <div className="tactical-panel rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#202832] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#84919D]">
                  Operational Tier
                </span>
                <span className="text-[11px] font-mono text-[#DDAA57] font-bold">
                  {difficulty.toUpperCase()}
                </span>
              </div>

              {/* In-Game Difficulty Switcher */}
              <div className="grid grid-cols-4 gap-1.5">
                {(['easy', 'medium', 'hard', 'insane'] as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => {
                      soundService.playClick(settings.soundEnabled)
                      setDifficulty(diff)
                      setBotQuote(BOT_QUOTES[diff].normal[0])
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold border transition ${
                      difficulty === diff
                        ? 'bg-[#1C232D] border-[#DDAA57] text-[#DDAA57]'
                        : 'bg-[#11151B] border-[#202832] text-[#84919D] hover:text-[#F5F6F8]'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetGame}
                  className="tactical-button-primary py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <RestartIcon className="w-3.5 h-3.5" />
                  <span>Restart Match</span>
                </button>

                <button
                  type="button"
                  onClick={handleResign}
                  disabled={game.current.isGameOver()}
                  className="tactical-button-secondary py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-40"
                >
                  <FlagIcon className="w-3.5 h-3.5" />
                  <span>Concede</span>
                </button>
              </div>
            </div>

            {/* Engine Technical Specifications */}
            <div className="tactical-panel rounded-xl p-3 text-xs text-[#84919D] space-y-1">
              <div className="flex items-center justify-between text-[#F5F6F8] font-bold text-[11px]">
                <span>Stockfish 16 Engine</span>
                <span className="font-mono text-emerald-400">Pure Local WASM</span>
              </div>
              <p className="text-[10px] text-[#84919D] leading-relaxed">
                Zero telemetry. Evaluation is calculated in a dedicated client WebWorker.
              </p>
            </div>
          </>
        ) : (
          /* Collapsed Icon Dock */
          <div className="tactical-panel rounded-2xl py-3 flex flex-col items-center space-y-3">
            <button
              type="button"
              onClick={handleFlipBoard}
              className="p-2 rounded-xl hover:bg-[#1C232D] text-[#84919D] hover:text-[#DDAA57] transition"
              title="Flip Board"
            >
              <FlipBoardIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={togglePerspective}
              className="p-2 rounded-xl hover:bg-[#1C232D] text-[#84919D] hover:text-[#438A69] transition"
              title="Toggle Perspective"
            >
              <PerspectiveIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              className="p-2 rounded-xl hover:bg-[#1C232D] text-[#84919D] hover:text-[#DDAA57] transition"
              title="Themes Studio"
            >
              <PaletteIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleResetGame}
              className="p-2 rounded-xl hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition"
              title="Restart Match"
            >
              <RestartIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
