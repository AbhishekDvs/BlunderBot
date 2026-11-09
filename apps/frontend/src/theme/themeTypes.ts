/**
 * BlunderBot Theme & Customization Architecture
 * Designed for extensible, theme-neutral separation of:
 * - Application UI appearance
 * - Chessboard physical materials & colorways
 * - Piece sets (2D vector, animated, and Astra 3D/medieval pieces)
 * - Sound packs
 * - Board perspective (Flat 2D vs Raised 2.5D)
 */

export type BoardPresetId =
  | 'classic-tournament'
  | 'royal-walnut'
  | 'marble-brass'
  | 'obsidian-gold'
  | 'minimal-modern'
  | 'ancient-battlefield'

export type PieceSetId =
  | 'default'
  | 'pirouetti'
  | 'chestnut'
  | 'astra-medieval'

export type SoundPackId = 'wood' | 'marble' | 'stone' | 'soft' | 'silent'

export type BoardPerspective = 'flat-2d' | 'elevated-2.5d'

export interface BoardPreset {
  id: BoardPresetId
  name: string
  subtitle: string
  description: string
  lightSquare: string
  darkSquare: string
  lightSquareText: string
  darkSquareText: string
  // Styling for physical board bevel & frame
  frameBackground: string
  frameBorder: string
  frameShadow: string
  innerBorder: string
  accentGlow: string
  coordinateColor: string
  // Square interaction colors
  moveIndicatorColor: string
  captureIndicatorColor: string
  lastMoveColor: string
  checkAuraColor: string
  defaultSoundPack: SoundPackId
  // Aesthetic metadata
  materialTag: string
  badgeBg: string
}

export interface PieceSet {
  id: PieceSetId
  name: string
  author: string
  description: string
  type: 'vector-svg' | 'astra-3d-model'
  isAvailable: boolean
  previewPieceCode: string // e.g. 'wN'
  tag?: string
}

export interface ThemeSettings {
  boardPresetId: BoardPresetId
  pieceSetId: PieceSetId
  soundPackId: SoundPackId
  perspective: BoardPerspective
  showCoordinates: boolean
  soundEnabled: boolean
  animationDuration: number
  showMoveHints: boolean
}

/**
 * Clean integration contract for Astra's medieval Indian war chess pieces,
 * animation triggers, and capture destruction sequences.
 */
export interface AstraCaptureEvent {
  victimSquare: string
  attackerSquare: string
  victimPiece: string // e.g. 'bP'
  attackerPiece: string // e.g. 'wN'
  timestamp: number
  onAnimationComplete?: () => void
}

export interface AstraPieceModelProvider {
  isLoaded: boolean
  version: string
  supportedPieces: string[]
  onCapture?: (event: AstraCaptureEvent) => void
  onMove?: (from: string, to: string, piece: string) => void
}
