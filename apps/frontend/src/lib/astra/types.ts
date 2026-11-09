/**
 * Astra Royal War Miniatures — Type Definitions
 * Authoritative specification: docs/astra/README.md, DESIGN.md, ANIMATION.md, PRODUCTION.md
 */

export type AstraPieceClass =
  | 'Raja' // King (wK)
  | 'Samrajni' // Queen (wQ)
  | 'Acharya' // Bishop (wB)
  | 'AshvaSenani' // Knight (wN)
  | 'Durg' // Rook (wR)
  | 'Padati' // Pawn (wP)

export type PieceCode = 'wK' | 'wQ' | 'wB' | 'wN' | 'wR' | 'wP' | 'bK' | 'bQ' | 'bB' | 'bN' | 'bR' | 'bP'

export type AnimationState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'impact'
  | 'destruction'
  | 'settling'

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface AtlasManifest {
  schemaVersion: number
  image: string
  sha256: string
  bytes: number
  decodedBytes: number
  cell: 128 | 256
  columns: number
  frameCount: number
  fps: number
  contactFrame?: number | null
  anchor: [number, number] // normalized [0.5, 0.86]
  frames: string[]
}

export interface ClassDesignSpec {
  classId: AstraPieceClass
  code: PieceCode
  nameEn: string
  nameSanskrit: string
  heightMultiplier: number // Relative to square size S (e.g. .87S, .94S)
  baseDiameter: number // .68S
  baseHeight: number // .07S
  primaryMaterial: string // '#E8DDC5' Warm ivory
  accentMaterial: string
  trimMaterial: string
  weapon: string
  attackDurationMs: number
  contactFrameMs: number
  recoveryMs: number
  totalDurationMs: number
}

export interface DebrisFragment {
  id: string
  material: 'stone' | 'bronze' | 'wood' | 'cloth' | 'dust'
  x: number // Screen pixels relative to board
  y: number
  vx: number
  vy: number
  rotation: number
  vRot: number
  scale: number
  opacity: number
  birthTime: number
  lifespanMs: number
  color: string
}

export interface VisualMoveEvent {
  from: string
  to: string
  piece: string
  captured?: string | null
  isCastling?: boolean
  isEnPassant?: boolean
  promotion?: string | null
  generation: number
  revision: number
}
