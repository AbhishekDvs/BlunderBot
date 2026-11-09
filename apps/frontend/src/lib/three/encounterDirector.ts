/**
 * Two-Piece Cinematic Encounter Director
 * Authoritative specification: docs/astra/ANIMATION.md
 * 
 * CRITICAL REQUIREMENT: BOTH pieces actively participate in captures.
 * 
 * 11-Step Choreographed Lifecycle:
 * 1. Attacker Anticipation (stance coil, weapon lift)
 * 2. Defender Awareness (detects incoming attack, rotates to face attacker)
 * 3. Dynamic Camera Framing (focuses on the 2 clashing squares)
 * 4. Attacker Approach / Charge
 * 5. Defender Defense / Parry / Shield Block
 * 6. Synchronized Weapon Impact
 * 7. Defender Physical Stagger & Recoil
 * 8. Structural Shell Fracture & Dissolution
 * 9. Residual Debris Ballistics & Settle
 * 10. Attacker Occupation & Victory Posture
 * 11. Camera Restoration to Tactical/Cinematic View
 */

import * as THREE from 'three'
import type { Piece3DNode, AnimationPacing, CombatEncounterParams } from './types.ts'
import { DebrisSystem3D } from './debris3D.ts'
import { CameraController3D } from './cameraController.ts'

export type EncounterPhase =
  | 'idle'
  | 'anticipation'     // 0 - 20%
  | 'approach'         // 20% - 50%
  | 'defense_reaction' // 35% - 55%
  | 'impact'           // 55%
  | 'stagger_break'    // 55% - 80%
  | 'settling'         // 80% - 100%

export class EncounterDirector3D {
  public currentPhase: EncounterPhase = 'idle'
  public isActive = false

  private attackerNode: Piece3DNode | null = null
  private defenderNode: Piece3DNode | null = null
  private attackerStartPos = new THREE.Vector3()
  private defenderPos = new THREE.Vector3()
  private destinationPos = new THREE.Vector3()

  private startTime = 0
  private durationMs = 1800
  private pacing: AnimationPacing = 'cinematic'
  private hasTriggeredImpact = false
  private onCompleteCallback?: () => void
  private onContactCallback?: () => void
  private debris: DebrisSystem3D
  private cameraCtrl: CameraController3D

  constructor(
    debris: DebrisSystem3D,
    cameraCtrl: CameraController3D
  ) {
    this.debris = debris
    this.cameraCtrl = cameraCtrl
  }

  /**
   * Initiates a full two-piece cinematic capture sequence
   */
  public startCapture(
    attacker: Piece3DNode,
    defender: Piece3DNode,
    params: CombatEncounterParams
  ) {
    this.attackerNode = attacker
    this.defenderNode = defender
    this.pacing = params.pacing
    this.onContactCallback = params.onContact
    this.onCompleteCallback = params.onComplete

    this.attackerStartPos.copy(attacker.group.position)
    this.defenderPos.copy(defender.group.position)
    this.destinationPos.copy(defender.group.position)

    attacker.isAnimating = true
    defender.isAnimating = true

    // Pacing adjustments
    switch (this.pacing) {
      case 'cinematic':
        this.durationMs = 1900
        break
      case 'fast':
        this.durationMs = 700
        break
      case 'reduced':
        this.durationMs = 250
        break
      case 'off':
        this.durationMs = 0
        break
    }

    if (this.durationMs === 0) {
      // Instant resolution for motion off
      attacker.group.position.copy(this.destinationPos)
      defender.group.visible = false
      attacker.isAnimating = false
      defender.isAnimating = false
      this.isActive = false
      this.currentPhase = 'idle'
      this.onCompleteCallback?.()
      return
    }

    // Orient combatants towards each other
    const attackDir = new THREE.Vector3().subVectors(this.defenderPos, this.attackerStartPos).normalize()
    const attackerTargetYaw = Math.atan2(attackDir.x, attackDir.z)
    const defenderTargetYaw = Math.atan2(-attackDir.x, -attackDir.z)

    attacker.group.rotation.y = attackerTargetYaw
    defender.group.rotation.y = defenderTargetYaw

    // Frame camera on combatants (if not reduced)
    if (this.pacing === 'cinematic') {
      this.cameraCtrl.frameCombatEncounter(this.attackerStartPos, this.defenderPos)
    }

    this.startTime = performance.now()
    this.hasTriggeredImpact = false
    this.isActive = true
    this.currentPhase = 'anticipation'
  }

  /**
   * Advances the two-piece encounter step
   */
  public update(now: number) {
    if (!this.isActive || !this.attackerNode || !this.defenderNode) return

    const elapsed = now - this.startTime
    const progress = Math.min(1.0, elapsed / this.durationMs)

    const attackerClass = this.attackerNode.pieceCode.slice(1).toUpperCase()
    const defenderClass = this.defenderNode.pieceCode.slice(1).toUpperCase()

    // 1. Phase: Anticipation (0.0 -> 0.22)
    if (progress < 0.22) {
      this.currentPhase = 'anticipation'
      const t = progress / 0.22

      // Attacker coils back and raises weapon
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.x = -Math.sin(t * Math.PI) * 0.4
      }
      if (this.attackerNode.torsoNode) {
        this.attackerNode.torsoNode.position.y = Math.sin(t * Math.PI) * 0.05
      }

      // Defender spots threat and assumes defensive posture
      if (this.defenderNode.shieldNode) {
        this.defenderNode.shieldNode.rotation.z = Math.PI / 2 + Math.sin(t * Math.PI) * 0.3
      }
      if (this.defenderNode.weaponNode) {
        this.defenderNode.weaponNode.rotation.x = Math.sin(t * Math.PI) * 0.25
      }
    }
    // 2. Phase: Approach & Defense Reaction (0.22 -> 0.54)
    else if (progress < 0.54) {
      this.currentPhase = 'approach'
      const t = (progress - 0.22) / 0.32

      // Attacker translates forward towards combat engagement point
      const stopDistance = 0.42 // Stop just outside defender
      const targetPos = new THREE.Vector3().lerpVectors(this.attackerStartPos, this.destinationPos, 1.0 - stopDistance)
      this.attackerNode.group.position.lerpVectors(this.attackerStartPos, targetPos, t)

      // Class-specific attack prep
      if (attackerClass === 'N') { // Knight horse rears before charge
        this.attackerNode.group.rotation.x = -Math.sin(t * Math.PI) * 0.35
      } else if (attackerClass === 'P') { // Pawn thrusts spear forward
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.8
        }
      }

      // Class-specific defender reaction
      if (defenderClass === 'P') { // Pawn braces shield forward
        if (this.defenderNode.shieldNode) {
          this.defenderNode.shieldNode.position.z = Math.sin(t * Math.PI) * 0.08
        }
      } else if (defenderClass === 'B') { // Bishop plants warding staff
        if (this.defenderNode.weaponNode) {
          this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI) * 0.4
        }
      } else if (defenderClass === 'N') { // Knight turns horse defensively
        this.defenderNode.group.rotation.z = Math.sin(t * Math.PI) * 0.2
      }
    }
    // 3. Phase: Synchronized Weapon Impact & Spark (0.54)
    else if (progress >= 0.54 && !this.hasTriggeredImpact) {
      this.hasTriggeredImpact = true
      this.currentPhase = 'impact'

      // Trigger Web Audio impact sound & screen callback
      this.onContactCallback?.()

      // Spawn physical fracture debris
      this.debris.spawnCaptureFracture(
        this.defenderPos,
        this.defenderNode.pieceCode,
        this.pacing === 'reduced'
      )
    }
    // 4. Phase: Defender Stagger & Shell Fracture (0.54 -> 0.78)
    else if (progress < 0.78) {
      this.currentPhase = 'stagger_break'
      const t = (progress - 0.54) / 0.24

      // Attacker follows through with strike
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.x = (1.0 - t) * 0.6
      }

      // Defender physically staggers backwards, tilts, and collapses
      this.defenderNode.group.position.y = Math.max(0, (1.0 - t * t) * 0.06)
      this.defenderNode.group.rotation.x = t * 0.9 // Falling back
      this.defenderNode.group.scale.setScalar(Math.max(0.01, 1.0 - t * 0.85)) // Collapsing shell
    }
    // 5. Phase: Settling & Occupation (0.78 -> 1.0)
    else {
      this.currentPhase = 'settling'
      const t = (progress - 0.78) / 0.22

      // Defender is now dismantled
      this.defenderNode.group.visible = false

      // Attacker takes final step into destination square
      const currentPos = this.attackerNode.group.position.clone()
      this.attackerNode.group.position.lerpVectors(currentPos, this.destinationPos, t)

      // Restore attacker upright posture
      this.attackerNode.group.rotation.x = 0
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.set(0, 0, 0)
      }
    }

    // Encounter Finished
    if (progress >= 1.0) {
      this.finish()
    }
  }

  /**
   * Finalizes encounter, restores camera, and signals game completion
   */
  public finish() {
    if (this.attackerNode) {
      this.attackerNode.group.position.copy(this.destinationPos)
      this.attackerNode.group.rotation.x = 0
      this.attackerNode.isAnimating = false
    }

    if (this.defenderNode) {
      this.defenderNode.group.visible = false
      this.defenderNode.isAnimating = false
    }

    // Return camera to active mode (tactical or cinematic)
    this.cameraCtrl.setMode(this.cameraCtrl.currentMode === 'encounter' ? 'tactical' : this.cameraCtrl.currentMode)

    this.isActive = false
    this.currentPhase = 'idle'
    this.onCompleteCallback?.()
  }

  /**
   * Immediately cancels active encounter and settles pieces
   */
  public cancel() {
    if (this.isActive) {
      this.finish()
    }
  }
}
