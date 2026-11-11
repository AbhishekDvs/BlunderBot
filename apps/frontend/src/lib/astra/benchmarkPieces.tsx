/**
 * RETIRED vector placeholders. These do not meet the ASTRA art direction.
 * Kept only as historical prototype source; do not expose in gameplay or previews.
 */

import React from 'react'
import { ASTRA_PALETTE } from './classSpecifications'

interface PieceSvgProps {
  size: number
  color?: 'w' | 'b'
  className?: string
}

// Shared carved circular plinth (.68S diameter, .07S height)
function Plinth({ width, y, color = 'w' }: { width: number; y: number; color?: 'w' | 'b' }) {
  const baseColor = color === 'w' ? ASTRA_PALETTE.warmIvory : '#2D2218'
  const rimColor = color === 'w' ? ASTRA_PALETTE.agedBronze : '#18120C'
  const goldColor = color === 'w' ? ASTRA_PALETTE.brushedGold : '#8A6A2E'

  return (
    <g>
      {/* Plinth Shadow */}
      <ellipse cx={width / 2} cy={y + 4} rx={width * 0.34} ry={width * 0.06} fill="rgba(0,0,0,0.35)" />
      {/* Base Tier 1 */}
      <ellipse cx={width / 2} cy={y + 2} rx={width * 0.32} ry={width * 0.05} fill={rimColor} />
      {/* Base Tier 2 with Lotus Carving Line */}
      <ellipse cx={width / 2} cy={y} rx={width * 0.30} ry={width * 0.045} fill={baseColor} stroke={goldColor} strokeWidth="1" />
    </g>
  )
}

// 1. Padati (Pawn) — .69S height
export function AstraPadati({ size, color = 'w', className = '' }: PieceSvgProps) {
  const ivory = color === 'w' ? ASTRA_PALETTE.warmIvory : '#423325'
  const bronze = color === 'w' ? ASTRA_PALETTE.agedBronze : '#2A1F16'
  const saffron = color === 'w' ? ASTRA_PALETTE.saffron : '#9E5B18'
  const steel = ASTRA_PALETTE.steel
  const plinthY = size * 0.86

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <Plinth width={size} y={plinthY} color={color} />
      {/* Torso & Robes */}
      <path
        d={`M ${size * 0.38} ${size * 0.84} L ${size * 0.42} ${size * 0.50} L ${size * 0.58} ${size * 0.50} L ${size * 0.62} ${size * 0.84} Z`}
        fill={ivory}
        stroke={bronze}
        strokeWidth="1.2"
      />
      {/* Scale Armor Vest */}
      <path
        d={`M ${size * 0.42} ${size * 0.50} L ${size * 0.58} ${size * 0.50} L ${size * 0.56} ${size * 0.68} L ${size * 0.44} ${size * 0.68} Z`}
        fill={bronze}
      />
      {/* Saffron Sash */}
      <rect x={size * 0.43} y={size * 0.68} width={size * 0.14} height={size * 0.04} fill={saffron} rx="1" />
      {/* Head & Turban */}
      <circle cx={size * 0.50} cy={size * 0.42} r={size * 0.08} fill={ivory} />
      <path
        d={`M ${size * 0.42} ${size * 0.42} Q ${size * 0.50} ${size * 0.30} ${size * 0.58} ${size * 0.42} Z`}
        fill={saffron}
      />
      {/* Round Shield (Left) */}
      <circle cx={size * 0.38} cy={size * 0.62} r={size * 0.12} fill={bronze} stroke={ASTRA_PALETTE.brushedGold} strokeWidth="1.5" />
      <circle cx={size * 0.38} cy={size * 0.62} r={size * 0.04} fill={saffron} />
      {/* Upright Spear (Right) */}
      <line x1={size * 0.64} y1={size * 0.28} x2={size * 0.64} y2={size * 0.85} stroke="#3D2B1F" strokeWidth="2" />
      {/* Steel Spearhead */}
      <polygon points={`${size * 0.64},${size * 0.22} ${size * 0.61},${size * 0.28} ${size * 0.67},${size * 0.28}`} fill={steel} />
    </svg>
  )
}

// 2. Ashva Senani (Knight) — .86S height
export function AstraAshvaSenani({ size, color = 'w', className = '' }: PieceSvgProps) {
  const ivory = color === 'w' ? ASTRA_PALETTE.warmIvory : '#423325'
  const bronze = color === 'w' ? ASTRA_PALETTE.agedBronze : '#2A1F16'
  const crimson = color === 'w' ? ASTRA_PALETTE.crimson : '#5E1B17'
  const steel = ASTRA_PALETTE.steel
  const plinthY = size * 0.86

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <Plinth width={size} y={plinthY} color={color} />
      {/* Horse Body & Hindquarters */}
      <path
        d={`M ${size * 0.30} ${size * 0.84} Q ${size * 0.32} ${size * 0.62} ${size * 0.46} ${size * 0.56} L ${size * 0.66} ${size * 0.62} L ${size * 0.68} ${size * 0.84} Z`}
        fill={ivory}
        stroke={bronze}
        strokeWidth="1.2"
      />
      {/* Crimson Saddle Cloth */}
      <path
        d={`M ${size * 0.44} ${size * 0.60} L ${size * 0.62} ${size * 0.60} L ${size * 0.60} ${size * 0.72} L ${size * 0.46} ${size * 0.72} Z`}
        fill={crimson}
      />
      {/* Arched Horse Neck & Head */}
      <path
        d={`M ${size * 0.46} ${size * 0.56} Q ${size * 0.40} ${size * 0.32} ${size * 0.32} ${size * 0.30} Q ${size * 0.26} ${size * 0.34} ${size * 0.32} ${size * 0.42} Q ${size * 0.38} ${size * 0.44} ${size * 0.42} ${size * 0.52} Z`}
        fill={ivory}
        stroke={bronze}
        strokeWidth="1.2"
      />
      {/* Bronze Chamfron (Horse Armor) */}
      <polygon points={`${size * 0.33},${size * 0.32} ${size * 0.37},${size * 0.33} ${size * 0.33},${size * 0.42}`} fill={bronze} />
      {/* Horse Ear */}
      <polygon points={`${size * 0.38},${size * 0.28} ${size * 0.41},${size * 0.32} ${size * 0.36},${size * 0.32}`} fill={ivory} />
      {/* Low Seated Rider Silhouette */}
      <circle cx={size * 0.54} cy={size * 0.46} r={size * 0.07} fill={ivory} />
      <path d={`M ${size * 0.48} ${size * 0.46} Q ${size * 0.54} ${size * 0.36} ${size * 0.60} ${size * 0.46} Z`} fill={bronze} />
      {/* Cavalry Lance */}
      <line x1={size * 0.68} y1={size * 0.16} x2={size * 0.48} y2={size * 0.74} stroke="#3D2B1F" strokeWidth="2" />
      <polygon points={`${size * 0.68},${size * 0.14} ${size * 0.65},${size * 0.20} ${size * 0.71},${size * 0.18}`} fill={steel} />
    </svg>
  )
}

// 3. Durg (Rook) — .72S height
export function AstraDurg({ size, color = 'w', className = '' }: PieceSvgProps) {
  const sandstone = color === 'w' ? ASTRA_PALETTE.sandstone : '#3B2C20'
  const bronze = color === 'w' ? ASTRA_PALETTE.agedBronze : '#241B13'
  const basalt = color === 'w' ? '#3C2C1D' : '#140E0A'
  const plinthY = size * 0.86

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <Plinth width={size} y={plinthY} color={color} />
      {/* Lower Carriage & Corner Rollers */}
      <rect x={size * 0.28} y={size * 0.80} width={size * 0.44} height={size * 0.05} fill={bronze} rx="2" />
      <circle cx={size * 0.31} cy={size * 0.83} r={size * 0.025} fill="#111" />
      <circle cx={size * 0.69} cy={size * 0.83} r={size * 0.025} fill="#111" />
      {/* Stepped Fortress Wall */}
      <path
        d={`M ${size * 0.30} ${size * 0.80} L ${size * 0.34} ${size * 0.42} L ${size * 0.66} ${size * 0.42} L ${size * 0.70} ${size * 0.80} Z`}
        fill={sandstone}
        stroke={basalt}
        strokeWidth="1.2"
      />
      {/* Central Gate Relief */}
      <path
        d={`M ${size * 0.44} ${size * 0.80} L ${size * 0.44} ${size * 0.60} Q ${size * 0.50} ${size * 0.54} ${size * 0.56} ${size * 0.60} L ${size * 0.56} ${size * 0.80} Z`}
        fill={basalt}
      />
      {/* Crenellated Battlements (Merlons) */}
      <path
        d={`M ${size * 0.32} ${size * 0.42} L ${size * 0.32} ${size * 0.32} L ${size * 0.38} ${size * 0.32} L ${size * 0.38} ${size * 0.36} L ${size * 0.46} ${size * 0.36} L ${size * 0.46} ${size * 0.32} L ${size * 0.54} ${size * 0.32} L ${size * 0.54} ${size * 0.36} L ${size * 0.62} ${size * 0.36} L ${size * 0.62} ${size * 0.32} L ${size * 0.68} ${size * 0.32} L ${size * 0.68} ${size * 0.42} Z`}
        fill={sandstone}
        stroke={basalt}
        strokeWidth="1.2"
      />
      {/* Crimson Pennant */}
      <polygon points={`${size * 0.50},${size * 0.32} ${size * 0.50},${size * 0.24} ${size * 0.56},${size * 0.28}`} fill={ASTRA_PALETTE.crimson} />
    </svg>
  )
}

// 4. Acharya (Bishop) — .81S height
export function AstraAcharya({ size, color = 'w', className = '' }: PieceSvgProps) {
  const ivory = color === 'w' ? ASTRA_PALETTE.warmIvory : '#423325'
  const bronze = color === 'w' ? ASTRA_PALETTE.agedBronze : '#2A1F16'
  const green = color === 'w' ? ASTRA_PALETTE.forestGreen : '#1B2E1F'
  const plinthY = size * 0.86

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <Plinth width={size} y={plinthY} color={color} />
      {/* Slender Robes */}
      <path
        d={`M ${size * 0.36} ${size * 0.84} L ${size * 0.43} ${size * 0.46} L ${size * 0.57} ${size * 0.46} L ${size * 0.64} ${size * 0.84} Z`}
        fill={ivory}
        stroke={bronze}
        strokeWidth="1.2"
      />
      {/* Forest Green Diagonal Sash */}
      <path
        d={`M ${size * 0.44} ${size * 0.48} L ${size * 0.56} ${size * 0.56} L ${size * 0.52} ${size * 0.84} L ${size * 0.40} ${size * 0.84} Z`}
        fill={green}
        opacity="0.9"
      />
      {/* Head & High Turban Topknot */}
      <circle cx={size * 0.50} cy={size * 0.38} r={size * 0.08} fill={ivory} />
      <ellipse cx={size * 0.50} cy={size * 0.33} rx={size * 0.07} ry={size * 0.06} fill={bronze} />
      {/* Sage Staff with Carved Cap (Left) */}
      <line x1={size * 0.35} y1={size * 0.20} x2={size * 0.35} y2={size * 0.85} stroke="#543A24" strokeWidth="2.5" />
      {/* Carved Lotus Geometric Staff Finial */}
      <polygon points={`${size * 0.35},${size * 0.16} ${size * 0.30},${size * 0.21} ${size * 0.40},${size * 0.21}`} fill={ASTRA_PALETTE.brushedGold} />
    </svg>
  )
}

// 5. Samrajni (Queen) — .94S height
export function AstraSamrajni({ size, color = 'w', className = '' }: PieceSvgProps) {
  const ivory = color === 'w' ? ASTRA_PALETTE.warmIvory : '#423325'
  const bronze = color === 'w' ? ASTRA_PALETTE.agedBronze : '#2A1F16'
  const gold = color === 'w' ? ASTRA_PALETTE.brushedGold : '#8A6A2E'
  const crimson = color === 'w' ? ASTRA_PALETTE.crimson : '#5E1B17'
  const steel = ASTRA_PALETTE.steel
  const plinthY = size * 0.86

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <Plinth width={size} y={plinthY} color={color} />
      {/* Layered Triangular Royal Robe */}
      <path
        d={`M ${size * 0.32} ${size * 0.84} L ${size * 0.44} ${size * 0.44} L ${size * 0.56} ${size * 0.44} L ${size * 0.68} ${size * 0.84} Z`}
        fill={ivory}
        stroke={bronze}
        strokeWidth="1.2"
      />
      {/* Crimson Royal Panel */}
      <polygon points={`${size * 0.46},${size * 0.50} ${size * 0.54},${size * 0.50} ${size * 0.58},${size * 0.84} ${size * 0.42},${size * 0.84}`} fill={crimson} />
      {/* Articulated Breastplate & Waist Accent */}
      <polygon points={`${size * 0.43},${size * 0.44} ${size * 0.57},${size * 0.44} ${size * 0.54},${size * 0.56} ${size * 0.46},${size * 0.56}`} fill={bronze} />
      <rect x={size * 0.45} y={size * 0.55} width={size * 0.10} height={size * 0.03} fill={gold} rx="1" />
      {/* Head */}
      <circle cx={size * 0.50} cy={size * 0.35} r={size * 0.08} fill={ivory} />
      {/* Tall Flared Fan Crown */}
      <path
        d={`M ${size * 0.40} ${size * 0.31} L ${size * 0.36} ${size * 0.18} L ${size * 0.44} ${size * 0.22} L ${size * 0.50} ${size * 0.14} L ${size * 0.56} ${size * 0.22} L ${size * 0.64} ${size * 0.18} L ${size * 0.60} ${size * 0.31} Z`}
        fill={gold}
        stroke={bronze}
        strokeWidth="1"
      />
      {/* Low Curved Scimitar Blade */}
      <path
        d={`M ${size * 0.62} ${size * 0.54} Q ${size * 0.74} ${size * 0.66} ${size * 0.68} ${size * 0.80}`}
        stroke={steel}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}

// 6. Raja (King) — .87S height
export function AstraRaja({ size, color = 'w', className = '' }: PieceSvgProps) {
  const ivory = color === 'w' ? ASTRA_PALETTE.warmIvory : '#423325'
  const bronze = color === 'w' ? ASTRA_PALETTE.agedBronze : '#2A1F16'
  const gold = color === 'w' ? ASTRA_PALETTE.brushedGold : '#8A6A2E'
  const crimson = color === 'w' ? ASTRA_PALETTE.crimson : '#5E1B17'
  const steel = ASTRA_PALETTE.steel
  const plinthY = size * 0.86

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <Plinth width={size} y={plinthY} color={color} />
      {/* Broad Squared Royal Robe */}
      <path
        d={`M ${size * 0.30} ${size * 0.84} L ${size * 0.38} ${size * 0.42} L ${size * 0.62} ${size * 0.42} L ${size * 0.70} ${size * 0.84} Z`}
        fill={ivory}
        stroke={bronze}
        strokeWidth="1.2"
      />
      {/* Crimson Shoulder Mantle */}
      <path
        d={`M ${size * 0.36} ${size * 0.42} L ${size * 0.64} ${size * 0.42} L ${size * 0.60} ${size * 0.62} L ${size * 0.40} ${size * 0.62} Z`}
        fill={crimson}
      />
      {/* Engraved Bronze Breastplate */}
      <polygon points={`${size * 0.42},${size * 0.44} ${size * 0.58},${size * 0.44} ${size * 0.55},${size * 0.60} ${size * 0.45},${size * 0.60}`} fill={bronze} />
      {/* Straight Vertical Ceremonial Broadsword (Held in center) */}
      <line x1={size * 0.50} y1={size * 0.48} x2={size * 0.50} y2={size * 0.82} stroke={steel} strokeWidth="2.5" />
      <line x1={size * 0.46} y1={size * 0.52} x2={size * 0.54} y2={size * 0.52} stroke={gold} strokeWidth="2" />
      {/* Head */}
      <circle cx={size * 0.50} cy={size * 0.34} r={size * 0.08} fill={ivory} />
      {/* Tiered Royal Crown with Central Finial */}
      <path
        d={`M ${size * 0.42} ${size * 0.31} L ${size * 0.44} ${size * 0.22} L ${size * 0.50} ${size * 0.17} L ${size * 0.56} ${size * 0.22} L ${size * 0.58} ${size * 0.31} Z`}
        fill={gold}
        stroke={bronze}
        strokeWidth="1"
      />
      <circle cx={size * 0.50} cy={size * 0.16} r={size * 0.02} fill={ASTRA_PALETTE.vermilion} />
    </svg>
  )
}

export function renderAstraPiece(code: string, squareWidth: number): React.ReactElement {
  const color = (code[0] === 'w' ? 'w' : 'b') as 'w' | 'b'
  const type = code[1]

  switch (type) {
    case 'K':
      return <AstraRaja size={squareWidth} color={color} />
    case 'Q':
      return <AstraSamrajni size={squareWidth} color={color} />
    case 'B':
      return <AstraAcharya size={squareWidth} color={color} />
    case 'N':
      return <AstraAshvaSenani size={squareWidth} color={color} />
    case 'R':
      return <AstraDurg size={squareWidth} color={color} />
    case 'P':
      return <AstraPadati size={squareWidth} color={color} />
    default:
      return <AstraPadati size={squareWidth} color={color} />
  }
}
