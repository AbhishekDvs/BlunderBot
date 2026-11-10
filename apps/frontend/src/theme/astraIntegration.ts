/**
 * Astra Medieval War Chess Integration Layer
 * 
 * This module provides clean extension points, event hooks, and asset loading
 * interfaces for Astra's ancient Indian medieval war chess army (Chaturanga / Rajput era).
 * 
 * Features:
 * - Graceful fallback to neoclassical/artisan 2D pieces while 3D assets load
 * - Capture event emitter for battlefield debris and destruction sequences
 * - Movement event emitter for custom physical animation arcs
 * - Mount points for WebGL / Three.js battlefield canvas overlays
 */

import { AstraCaptureEvent, AstraMoveMeta, AstraPieceModelProvider } from './themeTypes'

type CaptureListener = (event: AstraCaptureEvent) => void
type MoveListener = (from: string, to: string, piece: string, meta?: AstraMoveMeta) => void
type GameEndListener = (outcome: 'white_wins' | 'black_wins' | 'draw',onPresentationComplete?:()=>void) => void
type GameResetListener = () => void

class AstraIntegrationHub {
  private captureListeners: Set<CaptureListener> = new Set()
  private moveListeners: Set<MoveListener> = new Set()
  private gameEndListeners: Set<GameEndListener> = new Set()
  private gameResetListeners: Set<GameResetListener> = new Set()
  private provider: AstraPieceModelProvider = {
    isLoaded: false,
    version: '1.0.0-preview',
    supportedPieces: ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'],
  }

  /**
   * Register a custom piece model provider (e.g. from Astra's 3D engine)
   */
  public registerProvider(provider: Partial<AstraPieceModelProvider>) {
    this.provider = { ...this.provider, ...provider }
  }

  public getProvider(): AstraPieceModelProvider {
    return this.provider
  }

  /**
   * Dispatches a capture event to Astra's animation/destruction system
   */
  public notifyCapture(event: AstraCaptureEvent) {
    this.captureListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (err) {
        console.error('[AstraIntegration] Capture listener error:', err)
      }
    })
    if (this.provider.onCapture) {
      this.provider.onCapture(event)
    }
  }

  /**
   * Dispatches a move event to Astra's movement animation system
   */
  public notifyMove(from: string, to: string, piece: string, meta?: AstraMoveMeta) {
    this.moveListeners.forEach((listener) => {
      try {
        listener(from, to, piece, meta)
      } catch (err) {
        console.error('[AstraIntegration] Move listener error:', err)
      }
    })
    if (this.provider.onMove) {
      this.provider.onMove(from, to, piece, meta)
    }
  }

  /**
   * Dispatches game end outcome to Astra's 3D cinematic ending director
   */
  public notifyGameEnd(outcome: 'white_wins' | 'black_wins' | 'draw',onPresentationComplete?:()=>void) {
    this.gameEndListeners.forEach((listener) => {
      try {
        listener(outcome,onPresentationComplete)
      } catch (err) {
        console.error('[AstraIntegration] Game end listener error:', err)
      }
    })
    return this.gameEndListeners.size>0
  }

  public notifyGameReset() {
    this.gameResetListeners.forEach((listener) => {
      try {
        listener()
      } catch (err) {
        console.error('[AstraIntegration] Game reset listener error:', err)
      }
    })
  }

  public onCapture(listener: CaptureListener): () => void {
    this.captureListeners.add(listener)
    return () => this.captureListeners.delete(listener)
  }

  public onMove(listener: MoveListener): () => void {
    this.moveListeners.add(listener)
    return () => this.moveListeners.delete(listener)
  }

  public onGameEnd(listener: GameEndListener): () => void {
    this.gameEndListeners.add(listener)
    return () => this.gameEndListeners.delete(listener)
  }

  public onGameReset(listener: GameResetListener): () => void {
    this.gameResetListeners.add(listener)
    return () => this.gameResetListeners.delete(listener)
  }
}

export const astraHub = new AstraIntegrationHub()
if (typeof window !== 'undefined') {
  (window as unknown as { __ASTRA_HUB__: AstraIntegrationHub }).__ASTRA_HUB__ = astraHub
}
