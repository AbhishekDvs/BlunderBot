/**
 * Three.js 3D Chessboard & Cinematic Encounter Types
 * Authoritative specification: docs/astra/README.md, DESIGN.md, ANIMATION.md
 */

import * as THREE from 'three'

export type CameraViewMode = 'tactical' | 'cinematic' | 'encounter' | 'ending'

export type AnimationPacing = 'cinematic' | 'fast' | 'reduced' | 'off'

export interface SquareCoordinates {
  file: string // 'a'-'h'
  rank: number // 1-8
  square: string // 'e4'
  worldX: number
  worldZ: number
}

export interface Piece3DNode {
  pieceCode: string // 'wP', 'bK', etc.
  square: string // 'e4'
  group: THREE.Group
  torsoNode?: THREE.Object3D
  weaponNode?: THREE.Object3D
  shieldNode?: THREE.Object3D
  plinthNode?: THREE.Object3D
  initialScale: THREE.Vector3
  currentPosition: THREE.Vector3
  targetPosition: THREE.Vector3
  isAnimating: boolean
}

export interface CombatEncounterParams {
  attackerCode: string
  attackerSquare: string
  defenderCode: string
  defenderSquare: string
  isEnPassant?: boolean
  pacing: AnimationPacing
  onContact?: () => void
  onComplete?: () => void
}

export interface DebrisParticle3D {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  angularVelocity: THREE.Vector3
  birthTime: number
  lifespanMs: number
  bounces: number
}
