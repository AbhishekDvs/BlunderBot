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

export class DebrisSystem3D {
  public group: THREE.Group
  private fragments: DebrisParticle3D[] = []
  private maxGlobalFragments = 12

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
   * Spawns physical fracture shards and dust burst at capture impact location
   */
  public spawnCaptureFracture(
    origin: THREE.Vector3,
    pieceCode: string,
    isReducedMotion = false
  ) {
    if (isReducedMotion) return

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
  }

  /**
   * Clears all fragments immediately
   */
  public clear() {
    for (const frag of this.fragments) {
      this.group.remove(frag.mesh)
    }
    this.fragments = []
  }
}
