'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ThreeChessRenderer } from '@/lib/three/ThreeChessRenderer'
import { PieceBuilder3D } from '@/lib/three/pieceBuilder'
import { IndianArmiesRuntime } from '@/lib/three/indianArmiesRuntime'
import { useTheme } from '@/theme/ThemeContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'
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
  boardOnlyRef?: React.RefObject<HTMLDivElement | null>
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
  boardOnlyRef,
}: ThreeBoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportHeight=Math.round(boardWidth*.85)
  const rendererRef = useRef<ThreeChessRenderer | null>(null)
  const { activePreset, settings } = useTheme()
  const systemReducedMotion = useReducedMotion()

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('tactical')
  const [pacing, setPacing] = useState<AnimationPacing>('cinematic')
  const [hasUserSetPacing, setHasUserSetPacing] = useState(false)
  const [manifestId, setManifestId] = useState<string>('2p5d-stylized')
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [showDevTools, setShowDevTools] = useState(false)
  const [isCombatOrEndingActive, setIsCombatOrEndingActive] = useState(false)
  const [assetErrors, setAssetErrors] = useState<string[]>([])
  const [isViewportReady, setIsViewportReady] = useState(false)

  const isInspectorOpenRef = useRef(isInspectorOpen)
  isInspectorOpenRef.current = isInspectorOpen

  const onSquareClickRef = useRef(onSquareClick)
  onSquareClickRef.current = onSquareClick

  const fenRef = useRef(fen)
  fenRef.current = fen

  const activePresetRef = useRef(activePreset)
  activePresetRef.current = activePreset

  const sideRef = useRef(side)
  sideRef.current = side

  const [inspectorMode, setInspectorMode] = useState<InspectorViewMode>('match')
  const [selectedClass, setSelectedClass] = useState<'P' | 'N' | 'B' | 'R' | 'Q' | 'K'>('N')

  // Enable dev tools only in development when ?dev=1 is present & subscribe to 2.5D asset errors
  useEffect(() => {
    setAssetErrors(IndianArmiesRuntime.getAssetLoadErrors())
    const unsubErrors = IndianArmiesRuntime.onErrorsChange(setAssetErrors)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const params = new URLSearchParams(window.location.search)
      setShowDevTools(params.get('dev') === '1')
    }
    return () => unsubErrors()
  }, [])

  // Effective pacing honoring reduced motion (unless user explicitly chooses) & animations-off setting
  const effectivePacing: AnimationPacing =
    settings.animationDuration === 0
      ? 'off'
      : !hasUserSetPacing && systemReducedMotion
      ? 'reduced'
      : pacing

  // Astra event subscriptions (Capture, Move, GameEnd, Reset)
  useEffect(() => {
    const unsubCapture = astraHub.onCapture((event) => {
      if (rendererRef.current) {
        const attackerClass = event.attackerPiece.slice(1)
        setIsCombatOrEndingActive(true)
        rendererRef.current.triggerCapture(
          event.attackerSquare,
          event.victimSquare,
          event.attackerPiece,
          event.victimPiece,
          () => {
            soundService.playCombatImpact(attackerClass, settings.soundEnabled)
          },
          () => {
            event.onAnimationComplete?.()
          },
          {
            isEnPassant: event.isEnPassant,
            capturedSquare: event.capturedSquare,
            beforeFen: event.beforeFen,
            afterFen: event.afterFen,
            moveId: event.moveId,
            promotion: event.promotion,
            onAnticipation: () => {
              soundService.playCombatAnticipation(attackerClass, settings.soundEnabled)
            },
          }
        )
      }
    })

    const unsubMove = astraHub.onMove((from, to, piece, meta) => {
      if (rendererRef.current) {
        rendererRef.current.triggerMove(from, to, piece, undefined, meta)
      }
    })

    const unsubEnd = astraHub.onGameEnd((outcome,onComplete) => {
      if (rendererRef.current) {
        setIsCombatOrEndingActive(true)
        rendererRef.current.triggerGameEnding(outcome,onComplete)
      }
    })

    const unsubReset = astraHub.onGameReset(() => {
      setIsCombatOrEndingActive(false)
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
  }, [settings.soundEnabled])

  // Initialize ThreeChessRenderer ONCE on mount (never destroy WebGL on clicks, theme, or side flips!)
  useEffect(() => {
    if (!containerRef.current) return

    let isMounted = true

    const renderer = new ThreeChessRenderer({
      container: containerRef.current,
      preset: activePresetRef.current,
      side: sideRef.current,
      onSquareClick: (sq) => {
        if (!isInspectorOpenRef.current) {
          onSquareClickRef.current(sq)
        }
      },
    })

    rendererRef.current = renderer
    renderer.onPresentationChange=setIsCombatOrEndingActive
    renderer.setFen(fenRef.current)
    if (typeof window !== 'undefined') {
      (window as unknown as { __THREE_RENDERER__: unknown }).__THREE_RENDERER__ = renderer
    }

    // Preload 2.5D animated textures and refresh board pieces
    PieceBuilder3D.preloadArmyModels('2p5d-stylized', sideRef.current).then(() => {
      if (isMounted && rendererRef.current) {
        rendererRef.current.setFen(fenRef.current)
        setIsViewportReady(true)
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
  }, [])

  // Sync Board Material Preset live without tearing down WebGL
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setBoardPreset(activePreset)
    }
  }, [activePreset])

  // Sync FEN changes
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.setFen(fen)
    }
  }, [fen, isInspectorOpen])

  // Sync Last Move
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen && !rendererRef.current.presentation.busy) {
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
      rendererRef.current.board.showLegalMoves(settings.showMoveHints ? legalMoves : [])
    }
  }, [legalMoves, isInspectorOpen, settings.showMoveHints])

  // Sync In-Check Square
  useEffect(() => {
    if (rendererRef.current && !isInspectorOpen) {
      rendererRef.current.board.setInCheckSquare(inCheckSquare)
    }
  }, [inCheckSquare, isInspectorOpen])

  // Sync Orientation (Side) cleanly without WebGL teardown
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setOrientation(side)
    }
  }, [side])

  // Sync Experimental 3D vs Animated 2.5D setting cleanly (never loads 3D GLBs unless explicitly chosen)
  useEffect(() => {
    const desiredManifest = settings.experimental3d ? 'astra-dev-v02' : '2p5d-stylized'
    if (desiredManifest !== manifestId && !isInspectorOpen) {
      setManifestId(desiredManifest)
      if (rendererRef.current) {
        rendererRef.current.setAssetManifest(desiredManifest)
      }
    }
  }, [settings.experimental3d, manifestId, isInspectorOpen])

  // Sync Pacing
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPacing(effectivePacing)
    }
  }, [effectivePacing])

  // Handle Resize
  useEffect(() => {
    if (rendererRef.current && boardWidth > 0) {
      rendererRef.current.resize(boardWidth, viewportHeight)
    }
  }, [boardWidth,viewportHeight])

  // Manifest switcher (dev-only)
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

  // Skip active combat or ending sequence
  const handleSkipCombat = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    // Completing the final capture may synchronously start the queued ending.
    // One input belongs only to the presentation that was active when clicked.
    if (renderer.endingDirector.isActive) renderer.skipEnding()
    else renderer.cancelActiveAnimations()
  }, [])

  // Inspector Mode Setup (dev-only)
  const handleSetInspectorMode = useCallback(
    (mode: InspectorViewMode, pieceChar: 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' = selectedClass) => {
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
          rendererRef.current.setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
          break
        case 'compare':
          rendererRef.current.setFen('8/8/8/1prnbqk1/1PRNBQK1/8/8/8 w - - 0 1')
          break
        case 'turnaround':
          rendererRef.current.setFen(`8/8/8/8/3${pieceChar}4/8/8/8 w - - 0 1`)
          break
      }
    },
    [fen, selectedClass]
  )

  // Keyboard shortcut: Escape to skip combat/ending or close inspector
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

  const isDevKit = manifestId === 'astra-dev-v01' || manifestId === 'astra-dev-v02'
  const isV02 = manifestId === 'astra-dev-v02'

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* 2.5D/3D Viewport Container */}
      <div
        data-testid="animated-board"
        aria-busy={!isViewportReady}
        ref={(el) => {
          containerRef.current = el
          if (boardOnlyRef) {
            boardOnlyRef.current = el
          }
        }}
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#283341] bg-[#0A0D12]"
        style={{
          width: `${boardWidth}px`,
          height: `${viewportHeight}px`,
        }}
      />

      {/* Experimental Geometry Notice Banner (Dev Only) */}
      {showDevTools && isDevKit && (
        <div
          className={`absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium backdrop-blur-md shadow-lg ${
            isV02
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isV02 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          <span>
            {isV02
              ? 'Candidate Geometry — Complete White Army v0.2'
              : 'Experimental Geometry — Development Kit v0.1'}
          </span>
        </div>
      )}

      {/* Clean Tactical Camera & Pacing Bar */}
      <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 p-1 rounded-xl bg-[#0C0F14]/85 backdrop-blur-md border border-[#202832] shadow-lg text-[11px]">
        {showDevTools && <button
          type="button"
          onClick={handleToggleCamera}
          className="px-2 py-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition font-medium flex items-center gap-1"
          title="Toggle between Tactical Elevation (48°) and Cinematic Angle (34°)"
        >
          <span className="font-semibold text-[#F5F6F8]">
            {cameraMode === 'tactical' ? 'Tactical 48°' : 'Cinematic 34°'}
          </span>
        </button>}

        <button
          type="button"
          onClick={handleResetCamera}
          className="px-2 py-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#DDAA57] transition font-mono"
          title="Reset Camera to Default Tactical Framing (Double-click board)"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={() => {
            const pacings: AnimationPacing[] = ['cinematic', 'fast', 'reduced']
            const nextPacing = pacings[(pacings.indexOf(effectivePacing === 'off' ? 'cinematic' : effectivePacing) + 1) % pacings.length]
            setHasUserSetPacing(true)
            setPacing(nextPacing)
          }}
          className="px-2 py-1 rounded-lg hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8] transition font-medium flex items-center gap-1"
          title="Animation pacing: Cinematic, Fast, or Reduced"
        >
          <span className="capitalize font-semibold text-[#DDAA57]">{effectivePacing}</span>
        </button>

        {isCombatOrEndingActive && (
          <button
            type="button"
            onClick={handleSkipCombat}
            className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition font-mono font-semibold"
            title="Skip active combat or ending sequence (Esc)"
          >
            Skip
          </button>
        )}

        {showDevTools && (
          <button
            type="button"
            onClick={() => {
              const next = !isInspectorOpen
              setIsInspectorOpen(next)
              handleSetInspectorMode(next ? 'compare' : 'match')
            }}
            className={`px-2 py-1 rounded-lg transition font-medium ${
              isInspectorOpen
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'hover:bg-[#1C232D] text-[#84919D] hover:text-[#F5F6F8]'
            }`}
            title="Open Model Inspector (Dev Only)"
          >
            Inspector
          </button>
        )}
      </div>

      {/* Model Inspector Drawer Modal (Dev Only) */}
      {showDevTools && isInspectorOpen && (
        <div className="absolute bottom-3 left-3 right-3 z-40 p-3 rounded-2xl bg-[#0C0F14]/95 backdrop-blur-xl border border-[#2A3442] shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#202832] pb-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-sm">MODEL INSPECTOR (DEV)</span>
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
            <div className="flex items-center gap-2">
              <span className="text-[#84919D] font-medium">Model Kit:</span>
              <div className="flex gap-1 bg-[#141A22] p-0.5 rounded-lg border border-[#242E3B]">
                <button
                  type="button"
                  onClick={() => handleSwitchManifest('2p5d-stylized')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    manifestId === '2p5d-stylized'
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50 shadow'
                      : 'text-[#84919D] hover:text-amber-300'
                  }`}
                >
                  2.5D Stylized
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchManifest('astra-dev-v02')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    manifestId === 'astra-dev-v02'
                      ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50 shadow'
                      : 'text-[#84919D] hover:text-emerald-300'
                  }`}
                >
                  3D v0.2
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchManifest('production')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    manifestId === 'production'
                      ? 'bg-[#2A3748] text-white shadow'
                      : 'text-[#84919D] hover:text-white'
                  }`}
                >
                  Legacy 3D
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#84919D] font-medium">View:</span>
              <div className="flex gap-1 bg-[#141A22] p-0.5 rounded-lg border border-[#242E3B]">
                {(['compare', 'army', 'turnaround', 'match'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSetInspectorMode(m)}
                    className={`px-2 py-1 rounded-md capitalize ${
                      inspectorMode === m ? 'bg-[#2A3748] text-white' : 'text-[#84919D]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

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

      {/* Explicit 2.5D Asset Error Alert (never fail silently in development) */}
      {assetErrors.length > 0 && (
        <div
          role="alert"
          className="absolute top-3 left-3 right-3 z-50 px-3 py-2 rounded-lg bg-red-950/90 border border-red-500/70 text-red-100 text-xs shadow-xl"
        >
          <div className="font-semibold">2.5D Asset Load Failure ({assetErrors.length})</div>
          <div className="truncate opacity-90">{assetErrors[0]}</div>
        </div>
      )}
    </div>
  )
}
