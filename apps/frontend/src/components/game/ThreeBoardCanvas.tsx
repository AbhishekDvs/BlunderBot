'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ThreeChessRenderer } from '@/lib/three/ThreeChessRenderer'
import { PieceBuilder3D } from '@/lib/three/pieceBuilder'
import { useTheme } from '@/theme/ThemeContext'
import { astraHub } from '@/theme/astraIntegration'
import { soundService } from '@/theme/soundService'
import type { CameraViewMode, AnimationPacing } from '@/lib/three/types'

interface ThreeBoardCanvasProps {
  fen: string
  side: 'white' | 'black'
  boardWidth: number
  selectedSquare: string | null
  legalMoves: { to: string; captured?: boolean }[]
  lastMove: { from: string; to: string } | null
  inCheckSquare: string | null
  onSquareClick: (square: string) => void
}

export function ThreeBoardCanvas({
  fen,
  side,
  boardWidth,
  selectedSquare,
  legalMoves,
  lastMove,
  inCheckSquare,
  onSquareClick,
}: ThreeBoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<ThreeChessRenderer | null>(null)
  const { activePreset, settings } = useTheme()

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('tactical')
  const [pacing, setPacing] = useState<AnimationPacing>('cinematic')

  // Astra event subscriptions (Capture, Move, GameEnd, Reset)
  useEffect(() => {
    const unsubCapture = astraHub.onCapture((event) => {
      if (rendererRef.current) {
        rendererRef.current.triggerCapture(
          event.attackerSquare,
          event.victimSquare,
          event.attackerPiece,
          event.victimPiece,
          () => {
            soundService.playPieceCapture(activePreset.defaultSoundPack, settings.soundEnabled)
          }
        )
      }
    })

    const unsubMove = astraHub.onMove((from, to, piece) => {
      if (rendererRef.current) {
        rendererRef.current.triggerMove(from, to, piece)
      }
    })

    const unsubEnd = astraHub.onGameEnd((outcome) => {
      if (rendererRef.current) {
        rendererRef.current.triggerGameEnding(outcome)
      }
    })

    const unsubReset = astraHub.onGameReset(() => {
      if (rendererRef.current) {
        rendererRef.current.resetGame()
      }
    })

    return () => {
      unsubCapture()
      unsubMove()
      unsubEnd()
      unsubReset()
    }
  }, [activePreset.defaultSoundPack, settings.soundEnabled])

  const fenRef = useRef(fen)
  fenRef.current = fen

  // Initialize ThreeChessRenderer
  useEffect(() => {
    if (!containerRef.current) return

    // Preload GLB assets in background
    PieceBuilder3D.preloadArmyModels()

    const renderer = new ThreeChessRenderer({
      container: containerRef.current,
      preset: activePreset,
      side,
      onSquareClick,
    })

    rendererRef.current = renderer
    renderer.setFen(fenRef.current)

    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [activePreset, side, onSquareClick]) // Recreate only on core context changes

  // Sync FEN changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setFen(fen)
    }
  }, [fen])

  // Sync Last Move
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.board.setLastMove(lastMove)
    }
  }, [lastMove])

  // Sync Selection
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.board.setSelectedSquare(selectedSquare)
    }
  }, [selectedSquare])

  // Sync Legal Moves
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.board.showLegalMoves(legalMoves)
    }
  }, [legalMoves])

  // Sync In-Check Square
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.board.setInCheckSquare(inCheckSquare)
    }
  }, [inCheckSquare])

  // Sync Orientation (Side)
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setOrientation(side)
    }
  }, [side])

  // Sync Pacing
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPacing(pacing)
    }
  }, [pacing])

  // Handle Resize
  useEffect(() => {
    if (rendererRef.current && boardWidth > 0) {
      rendererRef.current.resize(boardWidth, boardWidth)
    }
  }, [boardWidth])

  // Camera toggle handler
  const handleToggleCamera = useCallback(() => {
    const nextMode = cameraMode === 'tactical' ? 'cinematic' : 'tactical'
    setCameraMode(nextMode)
    if (rendererRef.current) {
      rendererRef.current.setCameraMode(nextMode)
    }
  }, [cameraMode])

  // Skip active combat sequence on Escape or button click
  const handleSkipCombat = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.encounterDirector.cancel()
    }
  }, [])

  // Keyboard shortcut: Escape to skip combat
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkipCombat()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSkipCombat])

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* 3D Viewport Container */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{
          width: `${boardWidth}px`,
          height: `${boardWidth}px`,
        }}
      />

      {/* Floating 3D Tactical Controls Overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-xs">
        <button
          type="button"
          onClick={handleToggleCamera}
          className="px-2.5 py-1 rounded-lg hover:bg-white/15 text-zinc-300 hover:text-white transition font-medium flex items-center gap-1.5"
          title="Toggle between Tactical Top-Down and Cinematic Low Angle"
        >
          <span>📷</span>
          <span>{cameraMode === 'tactical' ? 'Tactical' : 'Cinematic'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const pacings: AnimationPacing[] = ['cinematic', 'fast', 'reduced']
            const nextPacing = pacings[(pacings.indexOf(pacing) + 1) % pacings.length]
            setPacing(nextPacing)
          }}
          className="px-2.5 py-1 rounded-lg hover:bg-white/15 text-zinc-300 hover:text-white transition font-medium flex items-center gap-1.5"
          title="Pacing: Cinematic (Full), Fast, or Reduced"
        >
          <span>⚡</span>
          <span className="capitalize">{pacing}</span>
        </button>

        <button
          type="button"
          onClick={handleSkipCombat}
          className="px-2 py-1 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition text-[11px]"
          title="Skip active combat sequence (Esc)"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
