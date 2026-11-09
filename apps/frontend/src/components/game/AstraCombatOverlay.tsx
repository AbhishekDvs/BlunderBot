'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { astraStateMachine } from '@/lib/astra/stateMachine'
import { astraDebris } from '@/lib/astra/debrisSystem'
import { astraHub } from '@/theme/astraIntegration'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useTheme } from '@/theme/ThemeContext'

interface AstraCombatOverlayProps {
  boardWidth: number
  side: 'white' | 'black'
}

export function AstraCombatOverlay({ boardWidth, side }: AstraCombatOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isReducedMotion = useReducedMotion()
  const { settings } = useTheme()

  const squareSize = boardWidth / 8

  // Helper to convert board square ('e4') to canvas pixels
  const squareToPixels = useCallback(
    (square: string): { x: number; y: number } => {
      const file = square.charCodeAt(0) - 97 // 'a' -> 0, 'h' -> 7
      const rank = parseInt(square[1], 10) - 1 // '1' -> 0, '8' -> 7

      const col = side === 'white' ? file : 7 - file
      const row = side === 'white' ? 7 - rank : rank

      return {
        x: col * squareSize + squareSize / 2,
        y: row * squareSize + squareSize / 2,
      }
    },
    [squareSize, side]
  )

  // Canvas drawing & rAF loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, boardWidth, boardWidth)

    const now = performance.now()

    // 1. Update & draw state machine action
    const isActionActive = astraStateMachine.tick(now, squareSize)

    // 2. Update & draw physical debris and dust
    const isDebrisActive = astraDebris.update(now, squareSize)
    astraDebris.draw(ctx)

    // 3. Draw combat impact flash if currently in 'impact' state
    const plan = astraStateMachine.getActivePlan()
    if (plan && plan.state === 'impact') {
      ctx.save()
      ctx.beginPath()
      ctx.arc(plan.attackerTrack.currentX, plan.attackerTrack.currentY, squareSize * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(234, 179, 8, 0.35)'
      ctx.fill()
      ctx.restore()
    }

    // Continue loop only if work remains
    if (isActionActive || isDebrisActive) {
      animFrameRef.current = requestAnimationFrame(draw)
    } else {
      animFrameRef.current = null
    }
  }, [boardWidth, squareSize])

  const scheduleLoop = useCallback(() => {
    if (!animFrameRef.current) {
      animFrameRef.current = requestAnimationFrame(draw)
    }
  }, [draw])

  // Subscribe to Astra capture events
  useEffect(() => {
    const unsubscribeCapture = astraHub.onCapture((event) => {
      if (settings.pieceSetId !== 'astra-medieval') return

      const victimCoords = squareToPixels(event.victimSquare)
      astraDebris.spawnCaptureDebris(
        victimCoords.x,
        victimCoords.y,
        squareSize,
        event.victimPiece,
        'system',
        isReducedMotion
      )
      scheduleLoop()
    })

    const unsubscribeMove = astraHub.onMove((from, to, piece) => {
      if (settings.pieceSetId !== 'astra-medieval') return
      const fromCoords = squareToPixels(from)
      const toCoords = squareToPixels(to)

      astraStateMachine.planMove(
        {
          from,
          to,
          piece: `w${piece.toUpperCase()}`,
          generation: 1,
          revision: 1,
        },
        fromCoords,
        toCoords,
        undefined,
        squareSize,
        'system',
        isReducedMotion
      )
      scheduleLoop()
    })

    return () => {
      unsubscribeCapture()
      unsubscribeMove()
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      astraDebris.clear()
      astraStateMachine.cancel()
    }
  }, [squareToPixels, squareSize, isReducedMotion, settings.pieceSetId, scheduleLoop])

  return (
    <canvas
      ref={canvasRef}
      width={boardWidth}
      height={boardWidth}
      className="absolute inset-0 z-20 pointer-events-none select-none"
      aria-hidden="true"
      style={{
        width: `${boardWidth}px`,
        height: `${boardWidth}px`,
      }}
    />
  )
}
