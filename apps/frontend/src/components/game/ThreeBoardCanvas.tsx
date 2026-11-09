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

type InspectorViewMode = 'match' | 'army' | 'compare' | 'turnaround'

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
  const [manifestId, setManifestId] = useState<string>('production')
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const isInspectorOpenRef = useRef(isInspectorOpen)
  isInspectorOpenRef.current = isInspectorOpen
  const [inspectorMode, setInspectorMode] = useState<InspectorViewMode>('match')
  const [selectedClass, setSelectedClass] = useState<'P' | 'N' | 'B' | 'R' | 'Q' | 'K'>('N')

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
            const attackerClass = event.attackerPiece.slice(1)
            soundService.playCombatImpact(attackerClass, settings.soundEnabled)
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

    let isMounted = true

    const renderer = new ThreeChessRenderer({
      container: containerRef.current,
      preset: activePreset,
      side,
      onSquareClick: (sq) => {
        if (!isInspectorOpenRef.current) {
          onSquareClick(sq)
        }
      },
    })

    rendererRef.current = renderer
    renderer.setFen(fenRef.current)
    if (typeof window !== 'undefined') {
      (window as unknown as { __THREE_RENDERER__: unknown }).__THREE_RENDERER__ = renderer
    }

    // Preload models for active manifest and upgrade board pieces
    PieceBuilder3D.preloadArmyModels(manifestId).then(() => {
      if (isMounted && rendererRef.current) {
        rendererRef.current.clearPieces()
        rendererRef.current.setFen(fenRef.current)
      }
    })

    return () => {
      isMounted = false
      if (typeof window !== 'undefined') {
        (window as unknown as { __THREE_RENDERER__: unknown }).__THREE_RENDERER__ = null
      }
      renderer.dispose()
      rendererRef.current = null
    }
  }, [activePreset, side, onSquareClick, manifestId])

  // Sync FEN changes
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.setFen(fen)
    }
  }, [fen, isInspectorOpen])

  // Sync Last Move
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.board.setLastMove(lastMove)
    }
  }, [lastMove, isInspectorOpen])

  // Sync Selection
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.board.setSelectedSquare(selectedSquare)
    }
  }, [selectedSquare, isInspectorOpen])

  // Sync Legal Moves
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.board.showLegalMoves(legalMoves)
    }
  }, [legalMoves, isInspectorOpen])

  // Sync In-Check Square
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.board.setInCheckSquare(inCheckSquare)
    }
  }, [inCheckSquare, isInspectorOpen])

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

  // Manifest switcher
  const handleSwitchManifest = useCallback(async (newManifestId: string) => {
    setManifestId(newManifestId)
    if (rendererRef.current) {
      await rendererRef.current.setAssetManifest(newManifestId)
    }
  }, [])

  // Camera toggle handler
  const handleToggleCamera = useCallback(() => {
    const nextMode = cameraMode === 'tactical' ? 'cinematic' : 'tactical'
    setCameraMode(nextMode)
    if (rendererRef.current) {
      rendererRef.current.setCameraMode(nextMode)
    }
  }, [cameraMode])

  // Camera view reset
  const handleResetCamera = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.resetView()
      setCameraMode('tactical')
    }
  }, [])

  // Skip active combat sequence on Escape or button click
  const handleSkipCombat = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.encounterDirector.cancel()
    }
  }, [])

  // Inspector Mode Setup
  const handleSetInspectorMode = useCallback((mode: InspectorViewMode, pieceChar: 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' = selectedClass) => {
    setInspectorMode(mode)
    setSelectedClass(pieceChar)
    if (!rendererRef.current) return

    rendererRef.current.board.setSelectedSquare(null)
    rendererRef.current.board.clearLegalMoves()

    switch (mode) {
      case 'match':
        rendererRef.current.setFen(fen)
        break
      case 'army':
        // Full 16-piece White army deployed against Black
        rendererRef.current.setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
        break
      case 'compare':
        // Lineup of all 6 pieces across ranks 4 and 5
        rendererRef.current.setFen('8/8/8/1prnbqk1/1PRNBQK1/8/8/8 w - - 0 1')
        break
      case 'turnaround':
        // Center piece for 360-degree turnaround inspection
        rendererRef.current.setFen(`8/8/8/8/3${pieceChar}4/8/8/8 w - - 0 1`)
        break
    }
  }, [fen, selectedClass])

  // Keyboard shortcut: Escape to skip combat or close inspector
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isInspectorOpen) {
          setIsInspectorOpen(false)
          handleSetInspectorMode('match')
        } else {
          handleSkipCombat()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSkipCombat, isInspectorOpen, handleSetInspectorMode])

  const isDevKit = manifestId === 'astra-dev-v01'

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* 3D Viewport Container */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#283341] bg-[#0A0D12]"
        style={{
          width: `${boardWidth}px`,
          height: `${boardWidth}px`,
        }}
      />

      {/* Experimental Geometry Notice Banner */}
      {isDevKit && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-medium backdrop-blur-md shadow-lg animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Experimental Geometry — Development Kit v0.1 (Unapproved Geometry Study)</span>
        </div>
      )}

      {/* Floating 3D Tactical Controls Overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 p-1 rounded-xl bg-[#0C0F14]/90 backdrop-blur-md border border-[#202832] shadow-xl text-xs">
        {/* Camera Elevation Toggle */}
        <button
          type="button"
          onClick={handleToggleCamera}
          className="px-2.5 py-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition font-medium flex items-center gap-1.5"
          title="Toggle between Tactical High Elevation (67°) and Cinematic Low Angle (34°)"
        >
          <span>📷</span>
          <span className="font-semibold text-[#F5F6F8]">
            {cameraMode === 'tactical' ? 'Tactical 67°' : 'Cinematic 34°'}
          </span>
        </button>

        {/* Snap / Reset Camera View */}
        <button
          type="button"
          onClick={handleResetCamera}
          className="px-2 py-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#DDAA57] transition font-mono text-[11px]"
          title="Reset Camera to Default Tactical Framing (Double-click board or press here)"
        >
          Reset View
        </button>

        {/* Combat Pacing Selector */}
        <button
          type="button"
          onClick={() => {
            const pacings: AnimationPacing[] = ['cinematic', 'fast', 'reduced']
            const nextPacing = pacings[(pacings.indexOf(pacing) + 1) % pacings.length]
            setPacing(nextPacing)
          }}
          className="px-2 py-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition font-medium flex items-center gap-1"
          title="Combat animation pacing: Cinematic, Fast, or Reduced"
        >
          <span>⚡</span>
          <span className="capitalize font-semibold text-[#DDAA57]">{pacing}</span>
        </button>

        {/* Model Inspector / Dev Kit Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !isInspectorOpen
            setIsInspectorOpen(next)
            if (!next) {
              handleSetInspectorMode('match')
            } else {
              handleSetInspectorMode('compare')
            }
          }}
          className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
            isInspectorOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8]'
          }`}
          title="Open 3D Model Inspector & Development Kit Comparison"
        >
          <span>🧪</span>
          <span className="font-semibold">Dev Preview</span>
        </button>

        {/* Skip Active Combat Sequence */}
        <button
          type="button"
          onClick={handleSkipCombat}
          className="px-2 py-1 rounded-lg hover:bg-red-500/20 text-[#84919D] hover:text-red-300 transition text-[11px] font-mono"
          title="Skip active combat sequence (Esc)"
        >
          Skip
        </button>
      </div>

      {/* Model Inspector Drawer Modal */}
      {isInspectorOpen && (
        <div className="absolute bottom-3 left-3 right-3 z-40 p-3 rounded-2xl bg-[#0C0F14]/95 backdrop-blur-xl border border-[#2A3442] shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#202832] pb-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-sm">🧪 3D MODEL INSPECTOR</span>
              <span className="text-[11px] text-[#84919D]">Drag board to orbit (360°) • Scroll to zoom</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsInspectorOpen(false)
                handleSetInspectorMode('match')
              }}
              className="text-[#84919D] hover:text-white text-xs px-2 py-0.5 rounded-md hover:bg-white/10"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Asset Manifest Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[#84919D] font-medium">Model Kit:</span>
              <div className="flex gap-1 bg-[#141A22] p-0.5 rounded-lg border border-[#242E3B]">
                <button
                  type="button"
                  onClick={() => handleSwitchManifest('production')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    manifestId === 'production'
                      ? 'bg-[#2A3748] text-white shadow'
                      : 'text-[#84919D] hover:text-white'
                  }`}
                >
                  Production (Astra)
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchManifest('astra-dev-v01')}
                  className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                    manifestId === 'astra-dev-v01'
                      ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50 shadow'
                      : 'text-[#84919D] hover:text-amber-300'
                  }`}
                >
                  <span>⚠️ Dev Kit v0.1</span>
                </button>
              </div>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[#84919D] font-medium">View:</span>
              <div className="flex gap-1 bg-[#141A22] p-0.5 rounded-lg border border-[#242E3B]">
                <button
                  type="button"
                  onClick={() => handleSetInspectorMode('compare')}
                  className={`px-2 py-1 rounded-md ${
                    inspectorMode === 'compare' ? 'bg-[#2A3748] text-white' : 'text-[#84919D]'
                  }`}
                >
                  6-Class Lineup
                </button>
                <button
                  type="button"
                  onClick={() => handleSetInspectorMode('army')}
                  className={`px-2 py-1 rounded-md ${
                    inspectorMode === 'army' ? 'bg-[#2A3748] text-white' : 'text-[#84919D]'
                  }`}
                >
                  Full 16 Army
                </button>
                <button
                  type="button"
                  onClick={() => handleSetInspectorMode('turnaround')}
                  className={`px-2 py-1 rounded-md ${
                    inspectorMode === 'turnaround' ? 'bg-[#2A3748] text-white' : 'text-[#84919D]'
                  }`}
                >
                  Class Solo
                </button>
                <button
                  type="button"
                  onClick={() => handleSetInspectorMode('match')}
                  className={`px-2 py-1 rounded-md ${
                    inspectorMode === 'match' ? 'bg-[#2A3748] text-white' : 'text-[#84919D]'
                  }`}
                >
                  Live Game
                </button>
              </div>
            </div>

            {/* Class Switcher for Solo Turnaround */}
            {inspectorMode === 'turnaround' && (
              <div className="flex items-center gap-1">
                {(['P', 'R', 'N', 'B', 'Q', 'K'] as const).map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => handleSetInspectorMode('turnaround', cls)}
                    className={`px-2 py-1 rounded-md font-mono font-bold ${
                      selectedClass === cls
                        ? 'bg-amber-500 text-black'
                        : 'bg-[#141A22] text-[#84919D] hover:text-white'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
