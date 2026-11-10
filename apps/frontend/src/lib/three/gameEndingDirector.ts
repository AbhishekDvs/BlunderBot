/**
 * 3D Cinematic Game-Ending Director
 * Authoritative specification: docs/astra/ANIMATION.md
 * 
 * Checkmate & Draw sequences:
 * - King is NEVER captured: checkmate concludes with royal bow / blade lowering
 * - Winning army performs disciplined triumph salute (weapons raised)
 * - Orbiting victory/defeat camera choreography
 * - Theme-appropriate accents (Ivory/Gold for White, Basalt/Bronze for Black)
 */

import type { Piece3DNode } from './types.ts'
import { CameraController3D } from './cameraController.ts'

export type EndingOutcome = 'white_wins' | 'black_wins' | 'draw'

export class GameEndingDirector3D {
  public isActive = false
  private startTime = 0
  private outcome: EndingOutcome = 'draw'
  private durationMs = 4500
  private cameraCtrl: CameraController3D

  constructor(cameraCtrl: CameraController3D) {
    this.cameraCtrl = cameraCtrl
  }

  /**
   * Starts game-ending cinematic presentation
   */
  public triggerEnding(
    outcome: EndingOutcome,
    pieceNodes: Map<string, Piece3DNode>
  ) {
    this.outcome = outcome
    this.startTime = performance.now()
    this.isActive = true

    // Trigger slow camera orbit
    this.cameraCtrl.setMode('ending')

    // Find kings
    let whiteKing: Piece3DNode | undefined
    let blackKing: Piece3DNode | undefined

    pieceNodes.forEach((node) => {
      if (node.pieceCode === 'wK') whiteKing = node
      if (node.pieceCode === 'bK') blackKing = node
    })

    if (outcome === 'white_wins') {
      // White victory salute
      pieceNodes.forEach((node) => {
        if (node.pieceCode.startsWith('w')) {
          node.animator?.playClip('victory', true)
          if (node.weaponNode) {
            node.weaponNode.rotation.x = -0.5 // Raise weapon in salute
          }
        } else if (node.pieceCode !== 'bK') {
          node.animator?.playClip('defend', false)
        }
      })
      // Black King bows in submission (never captured or removed)
      if (blackKing) {
        blackKing.group.visible = true
        blackKing.group.rotation.x = 0.35 // Lower posture
        blackKing.animator?.playClip('defeat', false)
        if (blackKing.weaponNode) {
          blackKing.weaponNode.rotation.x = 0.7 // Lower sword to ground
        }
      }
    } else if (outcome === 'black_wins') {
      // Black victory salute
      pieceNodes.forEach((node) => {
        if (node.pieceCode.startsWith('b')) {
          node.animator?.playClip('victory', true)
          if (node.weaponNode) {
            node.weaponNode.rotation.x = -0.5
          }
        } else if (node.pieceCode !== 'wK') {
          node.animator?.playClip('defend', false)
        }
      })
      // White King bows in submission (never captured or removed)
      if (whiteKing) {
        whiteKing.group.visible = true
        whiteKing.group.rotation.x = -0.35
        whiteKing.animator?.playClip('defeat', false)
        if (whiteKing.weaponNode) {
          whiteKing.weaponNode.rotation.x = 0.7
        }
      }
    } else {
      // Draw: mutual respect, lower weapons and disengage
      pieceNodes.forEach((node) => {
        node.animator?.playClip('draw', false)
        if (node.weaponNode) {
          node.weaponNode.rotation.x = 0.2
        }
      })
    }
  }

  public update(now: number) {
    if (!this.isActive) return
    const elapsed = now - this.startTime
    if (elapsed >= this.durationMs) {
      this.isActive = false
    }
  }

  public skip(pieceNodes: Map<string, Piece3DNode>) {
    this.reset(pieceNodes)
  }

  public reset(pieceNodes: Map<string, Piece3DNode>) {
    this.isActive = false
    pieceNodes.forEach((node) => {
      const is2p5d = !!node.cardMesh || node.group.name.includes('2p5D')
      const baseYaw = is2p5d
        ? (this.cameraCtrl.isFlipped ? Math.PI : 0)
        : (node.pieceCode.startsWith('b') ? Math.PI : 0)
      node.group.rotation.set(0, baseYaw, 0)
      if (node.weaponNode) node.weaponNode.rotation.set(0, 0, 0)
      node.animator?.playClip('idle', true)
    })
    this.cameraCtrl.setMode('tactical')
  }
}
