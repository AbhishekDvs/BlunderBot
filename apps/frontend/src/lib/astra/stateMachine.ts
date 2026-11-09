/**
 * Astra Animation State Machine
 * Authoritative specification: docs/astra/ANIMATION.md
 * 
 * Strict lifecycle:
 * idle -> moving -> attacking -> impact -> destruction -> settling -> idle
 * 
 * Invariants:
 * - Chess rules and engine state remain authoritative
 * - Visual code never alters or delays chess state commits
 * - Every frame checks monotonic generation & revision; cancels obsolete work
 */

import type { AnimationState, VisualMoveEvent } from './types.ts'
import { getClassSpec } from './classSpecifications.ts'
import { astraDebris } from './debrisSystem.ts'

export interface VisualPieceTrack {
  id: string
  pieceCode: string
  fromSquare: string
  toSquare: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  currentX: number
  currentY: number
  scale: number
  opacity: number
}

export interface ActiveActionPlan {
  state: AnimationState
  event: VisualMoveEvent
  attackerTrack: VisualPieceTrack
  defenderTrack?: VisualPieceTrack
  squareSize: number
  startTime: number
  durationMs: number
  contactTime: number
  destructionTime: number
  hasTriggeredContact: boolean
  hasTriggeredDestruction: boolean
  onComplete?: () => void
}

export class AstraAnimationStateMachine {
  private currentState: AnimationState = 'idle'
  private activePlan: ActiveActionPlan | null = null
  private currentGeneration: number = 0
  private currentRevision: number = 0
  private listeners: Set<(state: AnimationState) => void> = new Set()

  public subscribe(fn: (state: AnimationState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentState)
      } catch {
        // Listener catch
      }
    })
  }

  public getState(): AnimationState {
    return this.currentState
  }

  public getActivePlan(): ActiveActionPlan | null {
    return this.activePlan
  }

  /**
   * Plans and triggers a visual animation sequence for an accepted chess move.
   */
  public planMove(
    event: VisualMoveEvent,
    fromCoords: { x: number; y: number },
    toCoords: { x: number; y: number },
    defenderCoords?: { x: number; y: number },
    squareSize: number = 60,
    motionPreference: 'system' | 'reduced' | 'off' = 'system',
    isReducedMotion: boolean = false
  ): ActiveActionPlan | null {
    // Monotonic generation/revision check
    if (event.generation < this.currentGeneration || event.revision < this.currentRevision) {
      return null
    }

    this.currentGeneration = event.generation
    this.currentRevision = event.revision

    // Motion 'off' or instant fallback: no visual plan, immediate idle
    if (motionPreference === 'off') {
      this.cancel()
      return null
    }

    const isCapture = !!event.captured
    const spec = getClassSpec(event.piece)
    const isReduced = motionPreference === 'reduced' || isReducedMotion

    // Reduced motion: compressed straight slide, no combat/debris
    const duration =
      isReduced
        ? 100
        : isCapture
        ? spec.totalDurationMs
        : Math.min(350, Math.max(200, spec.totalDurationMs * 0.5))

    const contactTime = isCapture && !isReduced ? spec.contactFrameMs : 0
    const destructionTime = isCapture && !isReduced ? spec.contactFrameMs + 100 : 0

    const attackerTrack: VisualPieceTrack = {
      id: `piece_${event.from}_${event.piece}`,
      pieceCode: event.piece,
      fromSquare: event.from,
      toSquare: event.to,
      fromX: fromCoords.x,
      fromY: fromCoords.y,
      toX: toCoords.x,
      toY: toCoords.y,
      currentX: fromCoords.x,
      currentY: fromCoords.y,
      scale: 1.0,
      opacity: 1.0,
    }

    let defenderTrack: VisualPieceTrack | undefined
    if (isCapture && event.captured && defenderCoords) {
      defenderTrack = {
        id: `victim_${event.to}_${event.captured}`,
        pieceCode: event.captured,
        fromSquare: event.isEnPassant ? `${event.to[0]}${event.from[1]}` : event.to,
        toSquare: event.to,
        fromX: defenderCoords.x,
        fromY: defenderCoords.y,
        toX: defenderCoords.x,
        toY: defenderCoords.y,
        currentX: defenderCoords.x,
        currentY: defenderCoords.y,
        scale: 1.0,
        opacity: 1.0,
      }
    }

    const plan: ActiveActionPlan = {
      state: isCapture && !isReducedMotion ? 'moving' : 'moving',
      event,
      attackerTrack,
      defenderTrack,
      squareSize,
      startTime: performance.now(),
      durationMs: duration,
      contactTime,
      destructionTime,
      hasTriggeredContact: false,
      hasTriggeredDestruction: false,
    }

    this.activePlan = plan
    this.currentState = 'moving'
    this.notify()

    return plan
  }

  /**
   * Advances the animation state machine along time.
   * Called by requestAnimationFrame loop. Returns true if actively animating.
   */
  public tick(now: number, squareSize: number): boolean {
    if (!this.activePlan) return false

    const plan = this.activePlan
    const elapsed = now - plan.startTime
    const progress = Math.min(1.0, elapsed / plan.durationMs)

    // Ease-in-out movement interpolation
    const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2

    // 1. Attacker translation
    plan.attackerTrack.currentX =
      plan.attackerTrack.fromX + (plan.attackerTrack.toX - plan.attackerTrack.fromX) * easeProgress
    plan.attackerTrack.currentY =
      plan.attackerTrack.fromY + (plan.attackerTrack.toY - plan.attackerTrack.fromY) * easeProgress

    // 2. Capture choreography progression
    if (plan.defenderTrack && plan.durationMs > 150) {
      // Transition to 'attacking'
      if (elapsed < plan.contactTime && this.currentState !== 'attacking') {
        this.currentState = 'attacking'
        this.notify()
      }

      // Synchronize contact frame
      if (elapsed >= plan.contactTime && !plan.hasTriggeredContact) {
        plan.hasTriggeredContact = true
        this.currentState = 'impact'
        this.notify()
      }

      // Synchronize destruction & debris
      if (elapsed >= plan.destructionTime && !plan.hasTriggeredDestruction) {
        plan.hasTriggeredDestruction = true
        this.currentState = 'destruction'
        this.notify()

        // Spawn destruction debris
        astraDebris.spawnCaptureDebris(
          plan.defenderTrack.currentX,
          plan.defenderTrack.currentY,
          squareSize,
          plan.defenderTrack.pieceCode
        )

        // Fade out defender
        plan.defenderTrack.opacity = 0
      }

      // Settling into square (after destruction phase finishes)
      const settleThreshold = plan.destructionTime + 30
      if (elapsed >= settleThreshold && progress < 1.0 && this.currentState !== 'settling') {
        this.currentState = 'settling'
        this.notify()
      }
    }

    // 3. Complete and return to idle
    if (progress >= 1.0) {
      this.currentState = 'idle'
      this.activePlan = null
      this.notify()
      return false
    }

    return true
  }

  /**
   * Immediately cancels active animation, clears tracks, and restores idle state.
   */
  public cancel() {
    this.activePlan = null
    this.currentState = 'idle'
    astraDebris.clear()
    this.notify()
  }

  /**
   * Bumps generation to invalidate any in-flight asynchronous operations.
   */
  public bumpGeneration(): number {
    this.cancel()
    this.currentGeneration++
    return this.currentGeneration
  }
}

export const astraStateMachine = new AstraAnimationStateMachine()
