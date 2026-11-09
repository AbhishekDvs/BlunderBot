'use client'

import React, { useMemo } from 'react'
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
  const { settings, activePreset } = useTheme()

  // Generate custom square styling map (selection, legal moves, last move, check)
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    // 1. Last Move highlights
    if (lastMove) {
      styles[lastMove.from] = {
        background: activePreset.lastMoveColor,
      }
      styles[lastMove.to] = {
        background: activePreset.lastMoveColor,
      }
    }

    // 2. Selected Square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        background: activePreset.accentGlow,
        boxShadow: `inset 0 0 0 2px ${activePreset.innerBorder}`,
      }
    }

    // 3. Legal destination squares (dots for empty, rings for capture)
    legalMoves.forEach(({ to, captured }) => {
      if (captured) {
        styles[to] = {
          background: `radial-gradient(circle, transparent 55%, ${activePreset.captureIndicatorColor} 56%, ${activePreset.captureIndicatorColor} 70%, transparent 71%)`,
          cursor: 'pointer',
        }
      } else {
        styles[to] = {
          background: `radial-gradient(circle, ${activePreset.moveIndicatorColor} 26%, transparent 28%)`,
          cursor: 'pointer',
        }
      }
    })

    // 4. King in check crimson aura
    if (inCheckSquare) {
      styles[inCheckSquare] = {
        background: `radial-gradient(circle, ${activePreset.checkAuraColor} 0%, rgba(220, 38, 38, 0.2) 65%, transparent 75%)`,
        boxShadow: 'inset 0 0 12px rgba(239, 68, 68, 0.8)',
      }
    }

    return styles
  }, [selectedSquare, legalMoves, lastMove, inCheckSquare, activePreset])

  // Custom piece set loader
  const customPieces = useMemo(() => {
    const style = settings.pieceSetId

    if (style === 'default') return undefined

    // Unavailable assets must never fall through to placeholder art.
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
                  style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                    display: 'block',
                    width: `${squareWidth}px`,
                    height: `${squareWidth}px`,
                    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))',
                  }}
                />
              </div>
            ),
          ]
        })
      )
    )
  }, [settings.pieceSetId])

  const is25D = settings.perspective === 'elevated-2.5d'
  const is3D = settings.perspective === 'true-3d'
  const systemReducedMotion = useReducedMotion()
  const animDuration = boardAnimationDuration('system', systemReducedMotion, side)

  if (is3D) {
    return (
      <div className="relative flex flex-col items-center justify-center p-1">
        <ThreeBoardCanvas
          fen={fen}
          side={side}
          boardWidth={boardWidth}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          inCheckSquare={inCheckSquare}
          onSquareClick={onSquareClick}
        />
      </div>
    )
  }

  return (
    <div
      className="relative flex items-center justify-center transition-all duration-500 ease-out"
      style={{
        transform: is25D ? 'perspective(1100px) rotateX(4.5deg) translateY(-6px)' : 'none',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Physical Board Outer Enclosure & Bevel Frame */}
      <div
        className="relative rounded-2xl p-2.5 sm:p-4 transition-all duration-300"
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
        <div className="mt-2 hidden sm:flex items-center justify-between px-1 text-[10px] font-mono tracking-widest uppercase text-zinc-500 select-none">
          <span>{activePreset.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
            BlunderBot Engine
          </span>
        </div>
      </div>
    </div>
  )
}
