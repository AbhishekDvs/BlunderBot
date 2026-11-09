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
        if (node.pieceCode.startsWith('w') && node.weaponNode) {
          node.weaponNode.rotation.x = -0.5 // Raise weapon in salute
        }
      })
      // Black King bows in submission
      if (blackKing) {
        blackKing.group.rotation.x = 0.35 // Lower posture
        if (blackKing.weaponNode) {
          blackKing.weaponNode.rotation.x = 0.7 // Lower sword to ground
        }
      }
    } else if (outcome === 'black_wins') {
      // Black victory salute
      pieceNodes.forEach((node) => {
        if (node.pieceCode.startsWith('b') && node.weaponNode) {
          node.weaponNode.rotation.x = -0.5
        }
      })
      // White King bows in submission
      if (whiteKing) {
        whiteKing.group.rotation.x = -0.35
        if (whiteKing.weaponNode) {
          whiteKing.weaponNode.rotation.x = 0.7
        }
      }
    } else {
      // Draw: mutual respect, lower weapons
      pieceNodes.forEach((node) => {
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

  public reset(pieceNodes: Map<string, Piece3DNode>) {
    this.isActive = false
    pieceNodes.forEach((node) => {
      node.group.rotation.set(0, node.pieceCode.startsWith('b') ? Math.PI : 0, 0)
      if (node.weaponNode) node.weaponNode.rotation.set(0, 0, 0)
    })
    this.cameraCtrl.setMode('tactical')
  }
}
