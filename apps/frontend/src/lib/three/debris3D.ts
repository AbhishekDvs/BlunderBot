/**
 * 3D Physical Debris & Fracture System
 * Authoritative specification: docs/astra/ANIMATION.md
 * 
 * Strict constraints:
 * - <= 6 fragments per capture
 * - <= 12 fragments globally on the board
 * - <= 8 dust sprites
 * - Zero debris in reduced motion or motion off
 * - Fades by 1.2s, hard-clears by 1.8s
 * - Purely visual: pointer-events none, never obscures legal moves
 */

import * as THREE from 'three'
import type { DebrisParticle3D } from './types.ts'

interface ImpactBurstSprite {
  mesh: THREE.Mesh
  texture: THREE.Texture
  cols: number
  rows: number
  count: number
  fps: number
  birthTime: number
  lifespanMs: number
}

export class DebrisSystem3D {
  public group: THREE.Group
  private fragments: DebrisParticle3D[] = []
  private effectBursts: ImpactBurstSprite[] = []
  private maxGlobalFragments = 12
  private maxEffectBursts = 8

  // Shared shard geometries
  private shardGeos = [
    new THREE.DodecahedronGeometry(0.06, 0),
    new THREE.TetrahedronGeometry(0.08, 0),
    new THREE.BoxGeometry(0.05, 0.08, 0.04),
    new THREE.CylinderGeometry(0.015, 0.02, 0.12, 5),
  ]

  // Shared materials
  private whiteMat = new THREE.MeshStandardMaterial({
    color: 0xe8ddc5, // Warm ivory
    roughness: 0.65,
    metalness: 0.1,
  })

  private blackMat = new THREE.MeshStandardMaterial({
    color: 0x261c14, // Dark basalt
    roughness: 0.7,
    metalness: 0.15,
  })

  private bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x82613d, // Aged bronze
    roughness: 0.45,
    metalness: 0.8,
  })

  private goldMat = new THREE.MeshStandardMaterial({
    color: 0xb68a3e, // Gold
    roughness: 0.35,
    metalness: 0.9,
  })

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'DebrisSystem3D'
  }

  /**
   * Spawns physical fracture shards and optional 2.5D dust/chip burst at capture impact location
   */
  public spawnCaptureFracture(
    origin: THREE.Vector3,
    pieceCode: string,
    isReducedMotion = false,
    effectOptions?: { texture?: THREE.Texture; cols?: number; rows?: number; count?: number; fps?: number; tiltRad?: number }
  ) {
    if (isReducedMotion) return

    if (effectOptions?.texture && typeof document !== 'undefined') {
      while (this.effectBursts.length >= this.maxEffectBursts) {
        const oldest = this.effectBursts.shift()
        if (oldest) {
          this.group.remove(oldest.mesh)
          oldest.mesh.geometry.dispose()
          ;(oldest.mesh.material as THREE.Material).dispose()
          oldest.texture.dispose()
        }
      }
      const cols = effectOptions.cols ?? 8
      const rows = effectOptions.rows ?? 2
      const count = effectOptions.count ?? 16
      const fps = effectOptions.fps ?? 24
      const tex = effectOptions.texture
      tex.repeat.set(1 / cols, 1 / rows)
      tex.offset.set(0, (rows - 1) / rows)
      const geo = new THREE.PlaneGeometry(0.95, 0.95)
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const burstMesh = new THREE.Mesh(geo, mat)
      burstMesh.name = `ImpactBurst_${pieceCode}`
      burstMesh.position.set(origin.x, origin.y + 0.42, origin.z + 0.12)
      burstMesh.rotation.x = effectOptions.tiltRad ?? -0.58
      this.group.add(burstMesh)
      this.effectBursts.push({
        mesh: burstMesh,
        texture: tex,
        cols,
        rows,
        count,
        fps,
        birthTime: performance.now(),
        lifespanMs: (count / fps) * 1000 + 180,
      })
    }

    const isWhite = pieceCode.startsWith('w')
    const primaryMat = isWhite ? this.whiteMat : this.blackMat

    // 4-6 fragments per capture
    const count = 5

    // Evict oldest fragments if exceeding global limit
    while (this.fragments.length + count > this.maxGlobalFragments) {
      const oldest = this.fragments.shift()
      if (oldest) {
        this.group.remove(oldest.mesh)
      }
    }

    const now = performance.now()

    for (let i = 0; i < count; i++) {
      const geo = this.shardGeos[i % this.shardGeos.length]
      const mat = (i === 1) ? this.bronzeMat : (i === 3 ? this.goldMat : primaryMat).clone()
      mat.transparent = true

      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Spawn near the victim's center of mass
      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.15,
        origin.y + 0.15 + Math.random() * 0.25,
        origin.z + (Math.random() - 0.5) * 0.15
      )

      // Random ballistic velocity with upward pop
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const speed = 1.2 + Math.random() * 1.5
      const vx = Math.cos(angle) * speed
      const vz = Math.sin(angle) * speed
      const vy = 2.0 + Math.random() * 1.8

      const velocity = new THREE.Vector3(vx, vy, vz)
      const angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      )

      this.group.add(mesh)
      this.fragments.push({
        mesh,
        velocity,
        angularVelocity,
        birthTime: now,
        lifespanMs: 1800,
        bounces: 0,
      })
    }
  }

  /**
   * Advances physics step on rAF loop
   */
  public update(delta: number, now: number) {
    const gravity = -18.0
    const floorY = 0.06

    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const frag = this.fragments[i]
      const age = now - frag.birthTime

      // Hard removal after lifespan
      if (age >= frag.lifespanMs) {
        this.group.remove(frag.mesh)
        this.fragments.splice(i, 1)
        continue
      }

      // Fade out starting at 1.2s (1200ms)
      if (age > 1200) {
        const fadeProgress = (age - 1200) / 600
        const mat = frag.mesh.material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 1.0 - fadeProgress)
      }

      // Ballistic motion
      frag.velocity.y += gravity * delta
      frag.mesh.position.x += frag.velocity.x * delta
      frag.mesh.position.y += frag.velocity.y * delta
      frag.mesh.position.z += frag.velocity.z * delta

      // Tumble rotation
      frag.mesh.rotation.x += frag.angularVelocity.x * delta
      frag.mesh.rotation.y += frag.angularVelocity.y * delta
      frag.mesh.rotation.z += frag.angularVelocity.z * delta

      // Floor collision & bounce damping
      if (frag.mesh.position.y <= floorY) {
        frag.mesh.position.y = floorY
        if (frag.bounces < 2 && Math.abs(frag.velocity.y) > 0.4) {
          frag.velocity.y = -frag.velocity.y * 0.35 // Restitution
          frag.velocity.x *= 0.6 // Friction
          frag.velocity.z *= 0.6
          frag.angularVelocity.multiplyScalar(0.5)
          frag.bounces++
        } else {
          // Settled on board
          frag.velocity.set(0, 0, 0)
          frag.angularVelocity.set(0, 0, 0)
        }
      }
    }

    // Update 2.5D animated impact dust/material bursts
    for (let i = this.effectBursts.length - 1; i >= 0; i--) {
      const burst = this.effectBursts[i]
      const age = now - burst.birthTime
      if (age >= burst.lifespanMs) {
        this.group.remove(burst.mesh)
        burst.mesh.geometry.dispose()
        ;(burst.mesh.material as THREE.Material).dispose()
        burst.texture.dispose()
        this.effectBursts.splice(i, 1)
        continue
      }
      const frame = Math.min(burst.count - 1, Math.floor((age / 1000) * burst.fps))
      const col = frame % burst.cols
      const row = Math.floor(frame / burst.cols)
      burst.texture.offset.x = col / burst.cols
      burst.texture.offset.y = (burst.rows - 1 - row) / burst.rows
      const mat = burst.mesh.material as THREE.MeshBasicMaterial
      const activeDuration = (burst.count / burst.fps) * 1000
      if (age > activeDuration) {
        mat.opacity = Math.max(0, 1 - (age - activeDuration) / 180)
      }
    }
  }

  /**
   * Clears all fragments immediately
   */
  public clear() {
    for (const frag of this.fragments) {
      this.group.remove(frag.mesh)
    }
    this.fragments = []
    for (const burst of this.effectBursts) {
      this.group.remove(burst.mesh)
      burst.mesh.geometry.dispose()
      ;(burst.mesh.material as THREE.Material).dispose()
      burst.texture.dispose()
    }
    this.effectBursts = []
  }
}
