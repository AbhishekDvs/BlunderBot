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
  | 'anticipation'     // 0 - 22%
  | 'approach'         // 22% - 54%
  | 'impact'           // 54%
  | 'stagger_break'    // 54% - 78%
  | 'settling'         // 78% - 100%

export class EncounterDirector3D {
  public currentPhase: EncounterPhase = 'idle'
  public isActive = false

  private attackerNode: Piece3DNode | null = null
  private defenderNode: Piece3DNode | null = null
  private attackerStartPos = new THREE.Vector3()
  private defenderPos = new THREE.Vector3()
  private destinationPos = new THREE.Vector3()
  private contactPos = new THREE.Vector3()
  private attackDir = new THREE.Vector3()
  private attackerTargetYaw = 0
  private defenderTargetYaw = 0

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
   * Weapon contact reaches based on Astra physical model specifications
   */
  private getWeaponReach(pieceCode: string): number {
    const pieceClass = pieceCode.slice(1).toUpperCase()
    switch (pieceClass) {
      case 'N': return 0.46 // Cavalry lance reach
      case 'P': return 0.40 // Infantry spear reach
      case 'B': return 0.38 // Acharya staff reach
      case 'R': return 0.36 // Siege ram reach
      case 'Q': return 0.32 // Imperial talwar reach
      case 'K': return 0.30 // Royal broadsword reach
      default: return 0.35
    }
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

    // Compute attack direction vector
    const attackVec = new THREE.Vector3().subVectors(this.destinationPos, this.attackerStartPos)
    const dist = attackVec.length()
    if (dist > 0.001) {
      this.attackDir.copy(attackVec).normalize()
    } else {
      this.attackDir.set(0, 0, 1)
    }

    // Exact contact alignment based on attacker weapon reach
    const reach = this.getWeaponReach(attacker.pieceCode)
    const stopDist = Math.min(reach, dist * 0.75)
    this.contactPos.subVectors(this.destinationPos, this.attackDir.clone().multiplyScalar(stopDist))

    // Orient combatants towards each other
    this.attackerTargetYaw = Math.atan2(this.attackDir.x, this.attackDir.z)
    this.defenderTargetYaw = Math.atan2(-this.attackDir.x, -this.attackDir.z)

    attacker.group.rotation.y = this.attackerTargetYaw
    defender.group.rotation.y = this.defenderTargetYaw

    // Frame camera on combat encounter
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

      // Defender spots incoming threat and assumes defensive posture
      if (defenderClass === 'P' && this.defenderNode.shieldNode) {
        this.defenderNode.shieldNode.rotation.z = Math.PI / 2 + Math.sin(t * Math.PI) * 0.3
      } else if (defenderClass === 'B' && this.defenderNode.weaponNode) {
        this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI) * 0.35
      } else if (this.defenderNode.weaponNode) {
        this.defenderNode.weaponNode.rotation.x = Math.sin(t * Math.PI) * 0.25
      }
    }
    // 2. Phase: Approach & Defense Reaction (0.22 -> 0.54)
    else if (progress < 0.54) {
      this.currentPhase = 'approach'
      const t = (progress - 0.22) / 0.32

      // Attacker translates forward towards exact contact position (weapon reach alignment)
      this.attackerNode.group.position.lerpVectors(this.attackerStartPos, this.contactPos, t)

      // Class-specific attacker locomotion & weapon articulation
      if (attackerClass === 'N') {
        // Articulated canter/trot gait across approach
        const trotCycle = t * Math.PI * 6
        const legSwing = Math.sin(trotCycle) * 0.38
        const forelegSwing = Math.sin(trotCycle + Math.PI * 0.3) * 0.35

        const flUpper = this.attackerNode.group.getObjectByName('Horse_FL_Upper')
        const frUpper = this.attackerNode.group.getObjectByName('Horse_FR_Upper')
        const blUpper = this.attackerNode.group.getObjectByName('Horse_BL_Upper')
        const brUpper = this.attackerNode.group.getObjectByName('Horse_BR_Upper')

        if (flUpper) flUpper.rotation.x = forelegSwing
        if (frUpper) frUpper.rotation.x = -forelegSwing
        if (blUpper) blUpper.rotation.x = -legSwing
        if (brUpper) brUpper.rotation.x = legSwing

        // Dynamic vertical gallop bob and pitch
        this.attackerNode.group.position.y = Math.abs(Math.sin(trotCycle)) * 0.04
        this.attackerNode.group.rotation.x = Math.sin(trotCycle * 0.5) * 0.12 - (t > 0.7 ? (t - 0.7) * 0.4 : 0)

        // Couch cavalry lance forward as approaching victim
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.45
        }
      } else if (attackerClass === 'P') {
        // Pawn thrusts spear forward into target
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.85
        }
        this.attackerNode.group.position.y = Math.sin(t * Math.PI * 4) * 0.02
      } else if (attackerClass === 'R') {
        // Rook battering ram charges forward
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.position.z = Math.sin(t * Math.PI) * 0.15
        }
      } else {
        // Queen / King sword strike arc
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.7
        }
      }

      // Defender anticipatory reaction & warding
      if (defenderClass === 'B') {
        // Bishop raises and angles warding lotus staff to block incoming attack
        if (this.defenderNode.weaponNode) {
          this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI * 0.5) * 0.55
          this.defenderNode.weaponNode.rotation.x = Math.sin(t * Math.PI * 0.5) * 0.35
        }
        if (this.defenderNode.torsoNode) {
          this.defenderNode.torsoNode.rotation.y = Math.sin(t * Math.PI * 0.5) * 0.2
        }
      } else if (defenderClass === 'P') {
        // Pawn braces dhal shield forward into incoming attack
        if (this.defenderNode.shieldNode) {
          this.defenderNode.shieldNode.position.z = Math.sin(t * Math.PI * 0.5) * 0.14
          this.defenderNode.shieldNode.rotation.y = -Math.sin(t * Math.PI * 0.5) * 0.25
        }
      } else if (defenderClass === 'N') {
        // Knight horse turns flank defensively
        this.defenderNode.group.rotation.y = this.defenderTargetYaw + Math.sin(t * Math.PI * 0.5) * 0.35
      } else if (this.defenderNode.weaponNode) {
        // Queen/King/Rook defensive stance
        this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI * 0.5) * 0.45
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
        this.attackerNode.weaponNode.rotation.x = (1.0 - t) * 0.5
      }
      this.attackerNode.group.position.y = 0
      this.attackerNode.group.rotation.x = 0

      // Reset knight legs after impact
      if (attackerClass === 'N') {
        const flUpper = this.attackerNode.group.getObjectByName('Horse_FL_Upper')
        const frUpper = this.attackerNode.group.getObjectByName('Horse_FR_Upper')
        const blUpper = this.attackerNode.group.getObjectByName('Horse_BL_Upper')
        const brUpper = this.attackerNode.group.getObjectByName('Horse_BR_Upper')
        if (flUpper) flUpper.rotation.x = 0
        if (frUpper) frUpper.rotation.x = 0
        if (blUpper) blUpper.rotation.x = 0
        if (brUpper) brUpper.rotation.x = 0
      }

      // Defender physically staggers backwards away from strike vector before shell fracture
      const recoilDist = Math.sin(t * Math.PI * 0.5) * 0.28
      const recoilPos = new THREE.Vector3().addVectors(
        this.defenderPos,
        this.attackDir.clone().multiplyScalar(recoilDist)
      )
      this.defenderNode.group.position.copy(recoilPos)
      this.defenderNode.group.position.y = Math.sin(t * Math.PI) * 0.08 // lifted by force of strike
      this.defenderNode.group.rotation.x = -t * 1.1 // collapsing backwards
      this.defenderNode.group.scale.setScalar(Math.max(0.01, 1.0 - t * 0.9)) // collapsing shell
    }
    // 5. Phase: Settling & Occupation (0.78 -> 1.0)
    else {
      this.currentPhase = 'settling'
      const t = (progress - 0.78) / 0.22

      // Defender is dismantled
      this.defenderNode.group.visible = false

      // Attacker takes final step into destination square from contact position
      this.attackerNode.group.position.lerpVectors(this.contactPos, this.destinationPos, t)

      // Restore upright posture & clean weapon
      this.attackerNode.group.position.y = 0
      this.attackerNode.group.rotation.x = 0
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.set(0, 0, 0)
        this.attackerNode.weaponNode.position.set(0, 0, 0)
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
      this.attackerNode.group.position.y = 0
      this.attackerNode.group.rotation.x = 0
      this.attackerNode.group.scale.set(1, 1, 1)
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.set(0, 0, 0)
        this.attackerNode.weaponNode.position.set(0, 0, 0)
      }
      const flUpper = this.attackerNode.group.getObjectByName('Horse_FL_Upper')
      const frUpper = this.attackerNode.group.getObjectByName('Horse_FR_Upper')
      const blUpper = this.attackerNode.group.getObjectByName('Horse_BL_Upper')
      const brUpper = this.attackerNode.group.getObjectByName('Horse_BR_Upper')
      if (flUpper) flUpper.rotation.x = 0
      if (frUpper) frUpper.rotation.x = 0
      if (blUpper) blUpper.rotation.x = 0
      if (brUpper) brUpper.rotation.x = 0
      this.attackerNode.isAnimating = false
    }

    if (this.defenderNode) {
      this.defenderNode.group.visible = false
      this.defenderNode.group.scale.set(1, 1, 1)
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
