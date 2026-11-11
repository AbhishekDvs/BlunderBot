/**
 * Astra Debris & Destruction Particle System
 * Authoritative specification: docs/astra/ANIMATION.md
 * 
 * Rules:
 * - Cap at 6 fragments per capture
 * - Cap at 12 fragments globally
 * - Cap at 8 dust sprites globally
 * - Fade out starting at 1.2s, hard-removed at 1.8s
 * - Max fragment edge <= 0.12S
 * - Pointer-events: none, aria-hidden
 * - Zero debris in reduced-motion or animation-off mode
 */

import type { DebrisFragment } from './types.ts'
import { ASTRA_PALETTE } from './classSpecifications.ts'

export class DebrisSystem {
  private fragments: DebrisFragment[] = []
  private dustSprites: DebrisFragment[] = []

  /**
   * Spawns miniature destruction debris for a defeated piece.
   */
  public spawnCaptureDebris(
    centerX: number,
    centerY: number,
    squareSize: number,
    victimPieceCode: string,
    motionPreference: 'system' | 'reduced' | 'off' = 'system',
    isReducedMotion: boolean = false
  ) {
    if (motionPreference === 'off' || motionPreference === 'reduced' || isReducedMotion) {
      return // Zero debris in reduced/off modes
    }

    const now = performance.now()
    const maxDimension = squareSize * 0.11

    // Evict oldest if global capacity reached
    while (this.fragments.length + 4 > 12) {
      this.fragments.shift()
    }
    while (this.dustSprites.length + 2 > 8) {
      this.dustSprites.shift()
    }

    // Material characteristics based on class
    const isRook = victimPieceCode.endsWith('R')
    const isPawn = victimPieceCode.endsWith('P')

    const fragmentColors = isRook
      ? [ASTRA_PALETTE.sandstone, ASTRA_PALETTE.darkBasalt, ASTRA_PALETTE.agedBronze]
      : isPawn
      ? [ASTRA_PALETTE.agedBronze, ASTRA_PALETTE.warmIvory, ASTRA_PALETTE.steel, '#523420']
      : [ASTRA_PALETTE.warmIvory, ASTRA_PALETTE.brushedGold, ASTRA_PALETTE.agedBronze, ASTRA_PALETTE.crimson]

    // Create 3 to 5 physical fragments (capped <= 6 per capture)
    const count = isRook ? 5 : isPawn ? 3 : 4
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
      const speed = squareSize * (0.0015 + Math.random() * 0.002)

      this.fragments.push({
        id: `frag_${now}_${i}`,
        material: i === 0 ? 'stone' : i === 1 ? 'bronze' : 'cloth',
        x: centerX + (Math.random() - 0.5) * (squareSize * 0.2),
        y: centerY + (Math.random() - 0.5) * (squareSize * 0.2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.08, // initial slight upward kick
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.08,
        scale: Math.max(3, maxDimension * (0.5 + Math.random() * 0.5)),
        opacity: 1.0,
        birthTime: now,
        lifespanMs: 1800,
        color: fragmentColors[i % fragmentColors.length],
      })
    }

    // Create 2 small chalk/stone dust puffs (capped <= 8 globally)
    for (let j = 0; j < 2; j++) {
      this.dustSprites.push({
        id: `dust_${now}_${j}`,
        material: 'dust',
        x: centerX + (Math.random() - 0.5) * (squareSize * 0.15),
        y: centerY + (Math.random() - 0.5) * (squareSize * 0.15),
        vx: (Math.random() - 0.5) * 0.02,
        vy: -0.03 - Math.random() * 0.02,
        rotation: 0,
        vRot: 0,
        scale: squareSize * 0.18,
        opacity: 0.6,
        birthTime: now,
        lifespanMs: 900,
        color: 'rgba(232, 221, 197, 0.45)',
      })
    }
  }

  /**
   * Advances simulation time. Returns true if active fragments remain.
   */
  public update(now: number, squareSize: number): boolean {
    const gravity = 0.003
    const groundDamping = 0.4

    // Update physical fragments
    this.fragments = this.fragments.filter((f) => {
      const age = now - f.birthTime
      if (age >= f.lifespanMs) return false

      // Physics integration
      f.x += f.vx
      f.y += f.vy
      f.vy += gravity
      f.rotation += f.vRot

      // Single ground bounce damping
      if (f.vy > 0 && f.y > f.birthTime + squareSize * 0.35) {
        f.vy = -f.vy * groundDamping
        f.vx *= groundDamping
        f.vRot *= 0.5
      }

      // Fade out from 1.2s to 1.8s
      if (age > 1200) {
        f.opacity = Math.max(0, 1 - (age - 1200) / 600)
      }

      return true
    })

    // Update dust puffs
    this.dustSprites = this.dustSprites.filter((d) => {
      const age = now - d.birthTime
      if (age >= d.lifespanMs) return false

      d.y += d.vy
      d.scale *= 1.015 // expand
      d.opacity = Math.max(0, 0.6 * (1 - age / d.lifespanMs)) // fade

      return true
    })

    return this.fragments.length > 0 || this.dustSprites.length > 0
  }

  /**
   * Renders settled and active fragments to Canvas2D context.
   */
  public draw(ctx: CanvasRenderingContext2D) {
    // 1. Draw dust puffs
    this.dustSprites.forEach((d) => {
      ctx.save()
      ctx.globalAlpha = d.opacity
      ctx.fillStyle = d.color
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.scale / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    // 2. Draw physical fragments
    this.fragments.forEach((f) => {
      ctx.save()
      ctx.globalAlpha = f.opacity
      ctx.translate(f.x, f.y)
      ctx.rotate(f.rotation)
      ctx.fillStyle = f.color
      ctx.strokeStyle = '#1A1108'
      ctx.lineWidth = 1

      // Draw small carved stone / armor polygon
      const half = f.scale / 2
      ctx.beginPath()
      ctx.moveTo(-half, -half * 0.7)
      ctx.lineTo(half * 0.8, -half)
      ctx.lineTo(half, half * 0.8)
      ctx.lineTo(-half * 0.6, half)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      ctx.restore()
    })
  }

  /**
   * Instantly purges all fragments on reset, flip, or unmount.
   */
  public clear() {
    this.fragments = []
    this.dustSprites = []
  }

  public getCount(): { fragments: number; dust: number } {
    return {
      fragments: this.fragments.length,
      dust: this.dustSprites.length,
    }
  }
}

export const astraDebris = new DebrisSystem()
