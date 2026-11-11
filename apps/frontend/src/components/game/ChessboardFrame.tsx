'use client'

import React, { Component, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Chessboard } from 'react-chessboard'
import { BoardOrientation } from 'react-chessboard/dist/chessboard/types'
import { useTheme } from '@/theme/ThemeContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { boardAnimationDuration } from '@/lib/astra/motion'
import { ThreeBoardCanvas } from './ThreeBoardCanvas'

interface ChessboardFrameProps {
  fen: string
  side: 'white' | 'black'
  boardWidth: number
  selectedSquare: string | null
  legalMoves: { to: string; captured?: boolean }[]
  lastMove: { from: string; to: string } | null
  inCheckSquare: string | null
  onSquareClick: (square: string) => void
  onPieceDrop: (source: string, target: string) => boolean
  boardOnlyRef: React.RefObject<HTMLDivElement | null>
}

const UNICODE_PIECES: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

function SvgPieceWithFallback({
  folder,
  code,
  squareWidth,
}: {
  folder: string
  code: string
  squareWidth: number
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        style={{ width: squareWidth, height: squareWidth, fontSize: Math.round(squareWidth * 0.68) }}
        className="relative flex items-center justify-center select-none leading-none text-[#F5F6F8] drop-shadow"
        aria-label={code}
      >
        {UNICODE_PIECES[code] ?? code[1]}
      </div>
    )
  }

  return (
    <div
      style={{ width: squareWidth, height: squareWidth }}
      className="relative flex items-center justify-center select-none"
    >
      <Image
        src={`/pieces/${folder}/${code}.svg`}
        alt={code}
        width={squareWidth}
        height={squareWidth}
        draggable={false}
        priority
        onError={() => setFailed(true)}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'block',
          width: `${squareWidth}px`,
          height: `${squareWidth}px`,
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.45))',
        }}
      />
    </div>
  )
}

interface ThreeErrorBoundaryProps {
  children: React.ReactNode
  fallback: (errorMessage: string) => React.ReactNode
}

interface ThreeErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

class ThreeCanvasErrorBoundary extends Component<ThreeErrorBoundaryProps, ThreeErrorBoundaryState> {
  constructor(props: ThreeErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): ThreeErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unable to initialize 3D/2.5D WebGL board.',
    }
  }

  override componentDidCatch(error: Error) {
    console.error('[ChessboardFrame] 3D/2.5D renderer error, falling back to 2D:', error)
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.errorMessage)
    }
    return this.props.children
  }
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

function moveCursorSquare(current: string, key: string, side: 'white' | 'black'): string {
  const fileIdx = Math.max(0, Math.min(7, FILES.indexOf(current[0] as typeof FILES[number])))
  const rank = Math.max(1, Math.min(8, Number(current[1]) || 1))
  const dir = side === 'white' ? 1 : -1

  let nextFile = fileIdx
  let nextRank = rank
  if (key === 'ArrowRight') nextFile = Math.max(0, Math.min(7, fileIdx + dir))
  else if (key === 'ArrowLeft') nextFile = Math.max(0, Math.min(7, fileIdx - dir))
  else if (key === 'ArrowUp') nextRank = Math.max(1, Math.min(8, rank + dir))
  else if (key === 'ArrowDown') nextRank = Math.max(1, Math.min(8, rank - dir))

  return `${FILES[nextFile]}${nextRank}`
}

function buildStatusAnnouncement(
  fen: string,
  selectedSquare: string | null,
  inCheckSquare: string | null,
  lastMove: { from: string; to: string } | null
): string {
  const parts = fen.split(' ')
  const turn = parts[1] === 'b' ? 'Black to move.' : 'White to move.'
  const last = lastMove ? `Last move ${lastMove.from} to ${lastMove.to}.` : ''
  const check = inCheckSquare ? `King on ${inCheckSquare} is in check.` : ''
  const selected = selectedSquare ? `Selected square ${selectedSquare}.` : ''
  return [turn, last, check, selected].filter(Boolean).join(' ')
}

export function ChessboardFrame({
  fen,
  side,
  boardWidth,
  selectedSquare,
  legalMoves,
  lastMove,
  inCheckSquare,
  onSquareClick,
  onPieceDrop,
  boardOnlyRef,
}: ChessboardFrameProps) {
  const { settings, activePreset, isHydrated } = useTheme()
  const systemReducedMotion = useReducedMotion()
  const [cursorSquare, setCursorSquare] = useState<string>('e2')
  const [isKeyboardNavActive, setIsKeyboardNavActive] = useState(false)

  useEffect(() => {
    if (selectedSquare) {
      setCursorSquare(selectedSquare)
    }
  }, [selectedSquare])

  const handleBoardKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        setIsKeyboardNavActive(true)
        setCursorSquare((prev) => moveCursorSquare(prev, e.key, side))
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsKeyboardNavActive(true)
        onSquareClick(cursorSquare)
        return
      }
      if (e.key === 'Escape' && selectedSquare) {
        setIsKeyboardNavActive(true)
        onSquareClick('')
      }
    },
    [cursorSquare, onSquareClick, selectedSquare, side]
  )

  // Generate custom square styling map (selection, legal moves, last move, check, keyboard cursor)
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (lastMove) {
      styles[lastMove.from] = {
        background: activePreset.lastMoveColor,
      }
      styles[lastMove.to] = {
        background: activePreset.lastMoveColor,
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        background: activePreset.accentGlow,
        boxShadow: `inset 0 0 0 2.5px ${activePreset.innerBorder}, 0 0 12px ${activePreset.accentGlow}`,
      }
    }

    legalMoves.forEach(({ to, captured }) => {
      if (captured) {
        styles[to] = {
          background: `radial-gradient(circle, transparent 52%, ${activePreset.captureIndicatorColor} 53%, ${activePreset.captureIndicatorColor} 70%, transparent 71%)`,
          cursor: 'pointer',
        }
      } else {
        styles[to] = {
          background: `radial-gradient(circle, ${activePreset.moveIndicatorColor} 26%, transparent 28%)`,
          cursor: 'pointer',
        }
      }
    })

    if (inCheckSquare) {
      styles[inCheckSquare] = {
        background: 'radial-gradient(circle, rgba(224, 72, 72, 0.7) 0%, rgba(220, 38, 38, 0.25) 65%, transparent 75%)',
        boxShadow: 'inset 0 0 14px rgba(224, 72, 72, 0.9)',
      }
    }

    if (isKeyboardNavActive && cursorSquare) {
      styles[cursorSquare] = {
        ...styles[cursorSquare],
        outline: '2px solid #DDAA57',
        outlineOffset: '-2px',
      }
    }

    return styles
  }, [selectedSquare, legalMoves, lastMove, inCheckSquare, activePreset, isKeyboardNavActive, cursorSquare])

  // Custom piece set loader
  const customPieces = useMemo(() => {
    const style = settings.pieceSetId

    if (style === 'default') return undefined
    // Unavailable or 2.5D-only set falls back to clean 2D tournament pieces in 2D mode
    if (style === 'astra-medieval') return undefined

    const folder = style
    const pieceNames = ['P', 'N', 'B', 'R', 'Q', 'K']
    const colors = ['w', 'b']

    return Object.fromEntries(
      colors.flatMap((color) =>
        pieceNames.map((name) => {
          const code = `${color}${name}`
          return [
            code,
            ({ squareWidth }: { squareWidth: number }) => (
              <SvgPieceWithFallback folder={folder} code={code} squareWidth={squareWidth} />
            ),
          ]
        })
      )
    )
  }, [settings.pieceSetId])

  const is25D = settings.perspective === 'elevated-2.5d'
  const is3D = settings.perspective === 'true-3d'
  const motionDisabled = settings.animationDuration === 0 || systemReducedMotion
  const motionPreference = settings.animationDuration === 0 ? 'off' : 'system'
  const animDuration = boardAnimationDuration(motionPreference, systemReducedMotion, side)
  const announcement = useMemo(
    () => buildStatusAnnouncement(fen, selectedSquare, inCheckSquare, lastMove),
    [fen, selectedSquare, inCheckSquare, lastMove]
  )

  const renderClassic2DBoard = (fallbackNotice?: string) => (
    <div
      data-testid="chessboard-frame"
      data-fen={fen}
      data-perspective={fallbackNotice ? 'flat-2d' : settings.perspective}
      data-selected-square={selectedSquare ?? ''}
      data-cursor-square={isKeyboardNavActive ? cursorSquare : ''}
      tabIndex={0}
      role="application"
      aria-label="Chessboard. Use arrow keys to move between squares, Enter or Space to select or place a piece, Escape to cancel selection."
      onKeyDown={handleBoardKeyDown}
      onPointerDown={() => setIsKeyboardNavActive(false)}
      onBlur={() => setIsKeyboardNavActive(false)}
      className={`relative flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] rounded-2xl ${
        motionDisabled ? '' : 'transition-all duration-500 ease-out'
      }`}
      style={{
        transform: !fallbackNotice && is25D ? 'perspective(1100px) rotateX(4.5deg) translateY(-6px)' : 'none',
        touchAction: 'manipulation',
      }}
    >
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
        {isKeyboardNavActive ? ` Focus square ${cursorSquare}.` : ''}
      </div>

      {fallbackNotice && (
        <div
          role="alert"
          className="mb-2 w-full px-3 py-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-100 text-xs"
        >
          <span className="font-semibold">Classic 2D Fallback Active:</span> {fallbackNotice}
        </div>
      )}

      {/* Physical Board Outer Enclosure & Bevel Frame */}
      <div
        className={`relative rounded-2xl p-2 sm:p-3.5 ${motionDisabled ? '' : 'transition-all duration-300'}`}
        style={{
          background: activePreset.frameBackground,
          border: `2px solid ${activePreset.frameBorder}`,
          boxShadow: activePreset.frameShadow,
        }}
      >
        {/* Inner Brass/Wood Recessed Inlay Lip */}
        <div
          ref={boardOnlyRef as React.RefObject<HTMLDivElement>}
          className="relative rounded-lg overflow-hidden shadow-inner"
          style={{
            border: `1.5px solid ${activePreset.innerBorder}`,
          }}
        >
          <Chessboard
            position={fen}
            boardOrientation={side as BoardOrientation}
            boardWidth={boardWidth}
            onPieceDrop={onPieceDrop}
            onSquareClick={(sq) => onSquareClick(sq as string)}
            customPieces={customPieces}
            customSquareStyles={customSquareStyles}
            customDarkSquareStyle={{ backgroundColor: activePreset.darkSquare }}
            customLightSquareStyle={{ backgroundColor: activePreset.lightSquare }}
            showBoardNotation={settings.showCoordinates}
            animationDuration={animDuration}
            arePiecesDraggable={true}
          />
        </div>

        {/* Physical Board Material Engraving Accent (Bottom Lip) */}
        <div className="mt-1.5 hidden sm:flex items-center justify-between px-1 text-[10px] font-mono tracking-widest uppercase text-[#84919D] select-none">
          <span>{activePreset.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DDAA57]" />
            BlunderBot Console
          </span>
        </div>
      </div>
    </div>
  )

  // Read the saved perspective before mounting a renderer. Otherwise a saved
  // classic game briefly creates WebGL and starts loading the entire army.
  if (!isHydrated) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading chessboard"
        style={{ width: boardWidth, height: boardWidth * 0.82 }}
      />
    )
  }

  if (is3D) {
    return (
      <ThreeCanvasErrorBoundary
        fallback={(msg) => renderClassic2DBoard(msg)}
      >
        <div
          data-testid="chessboard-frame"
          data-fen={fen}
          data-perspective={settings.perspective}
          data-selected-square={selectedSquare ?? ''}
          data-cursor-square={isKeyboardNavActive ? cursorSquare : ''}
          tabIndex={0}
          role="application"
          aria-label="2.5D War Chess board. Use arrow keys to navigate squares, Enter or Space to select or move a piece."
          onKeyDown={handleBoardKeyDown}
          onPointerDown={() => setIsKeyboardNavActive(false)}
          onBlur={() => setIsKeyboardNavActive(false)}
          className="relative flex flex-col items-center justify-center p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAA57] rounded-2xl"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
            {isKeyboardNavActive ? ` Focus square ${cursorSquare}.` : ''}
          </div>

          <ThreeBoardCanvas
            fen={fen}
            side={side}
            boardWidth={boardWidth}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            inCheckSquare={inCheckSquare}
            onSquareClick={onSquareClick}
            boardOnlyRef={boardOnlyRef}
          />
        </div>
      </ThreeCanvasErrorBoundary>
    )
  }

  return renderClassic2DBoard()
}
