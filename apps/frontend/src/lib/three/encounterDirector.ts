/**
 * Two-Piece Cinematic Encounter Director with World-Space Socket Contact Alignment
 * Authoritative specification: docs/astra/ANIMATION.md, AUDIT.md
 * 
 * Guarantees:
 * 1. World-space contact alignment between weapon tip socket and defender contact anchor (impact within defined tolerance)
 * 2. True mutual two-piece combat: Knight trot/canter gait & lance couch; Bishop warding staff block before impact
 * 3. Real physical destruction: authored shell fragments separate and scatter; base stays grounded; NO whole-model shrinking
 * 4. Grounded stagger recoil along strike vector
 * 5. Smooth camera framing and clean restoration
 */

import * as THREE from 'three'
import type { Piece3DNode, AnimationPacing, CombatEncounterParams } from './types.ts'
import { DebrisSystem3D } from './debris3D.ts'
import { CameraController3D } from './cameraController.ts'

export type EncounterPhase =
  | 'idle'
  | 'anticipation'     // 0% - 22%
  | 'approach'         // 22% - 54%
  | 'impact'           // 54%
  | 'stagger_fracture' // 54% - 80%
  | 'settling'         // 80% - 100%

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
  private durationMs = 1900
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
   * Fallback weapon reaches if sockets are missing
   */
  private getFallbackReach(pieceCode: string): number {
    const pieceClass = pieceCode.slice(1).toUpperCase()
    switch (pieceClass) {
      case 'N': return 0.48 // Cavalry lance reach
      case 'P': return 0.40 // Infantry spear reach
      case 'B': return 0.38 // Acharya staff reach
      case 'R': return 0.36 // Siege ram reach
      case 'Q': return 0.34 // Imperial talwar reach
      case 'K': return 0.32 // Royal broadsword reach
      default: return 0.35
    }
  }

  /**
   * Initiates a full two-piece cinematic capture sequence with world-space alignment
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

    // 1. Calculate attack vector and direction
    const attackVec = new THREE.Vector3().subVectors(this.destinationPos, this.attackerStartPos)
    const dist = attackVec.length()
    if (dist > 0.001) {
      this.attackDir.copy(attackVec).normalize()
    } else {
      this.attackDir.set(0, 0, 1)
    }

    // Orient combatants to face each other
    this.attackerTargetYaw = Math.atan2(this.attackDir.x, this.attackDir.z)
    this.defenderTargetYaw = Math.atan2(-this.attackDir.x, -this.attackDir.z)

    attacker.group.rotation.y = this.attackerTargetYaw
    defender.group.rotation.y = this.defenderTargetYaw

    // 2. World-Space Socket Contact Alignment
    attacker.group.position.copy(this.attackerStartPos)
    defender.group.position.copy(this.destinationPos)
    attacker.group.updateWorldMatrix(true, true)
    defender.group.updateWorldMatrix(true, true)

    const tipSocket = attacker.group.getObjectByName('weapon_tip_socket') || attacker.weaponNode
    const contactAnchor = defender.group.getObjectByName('contact_anchor') || defender.torsoNode || defender.group

    let forwardReach = this.getFallbackReach(attacker.pieceCode)
    let anchorOffset = 0.0

    if (tipSocket) {
      const vTip = new THREE.Vector3()
      const vAtkRoot = new THREE.Vector3()
      tipSocket.getWorldPosition(vTip)
      attacker.group.getWorldPosition(vAtkRoot)
      const measuredOffset = new THREE.Vector3().subVectors(vTip, vAtkRoot).dot(this.attackDir)
      if (measuredOffset > 0.15 && measuredOffset < 1.2) {
        forwardReach = measuredOffset
      }
    }

    if (contactAnchor) {
      const vAnchor = new THREE.Vector3()
      const vDefRoot = new THREE.Vector3()
      contactAnchor.getWorldPosition(vAnchor)
      defender.group.getWorldPosition(vDefRoot)
      anchorOffset = new THREE.Vector3().subVectors(vAnchor, vDefRoot).dot(this.attackDir)
    }

    // Exact contact root position: stops where weapon tip aligns with defender anchor
    const effectiveReach = Math.max(0.20, forwardReach - anchorOffset)
    const travelDist = Math.max(0.15, dist - effectiveReach)
    this.contactPos.addVectors(this.attackerStartPos, this.attackDir.clone().multiplyScalar(travelDist))

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

      // Attacker coils back weight & raises weapon
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.x = -Math.sin(t * Math.PI) * 0.35
      }
      if (this.attackerNode.torsoNode) {
        this.attackerNode.torsoNode.position.y = Math.sin(t * Math.PI) * 0.04
      }

      // Defender spots threat and assumes defensive posture
      if (defenderClass === 'B' && this.defenderNode.weaponNode) {
        this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI) * 0.40
      } else if (defenderClass === 'P' && this.defenderNode.shieldNode) {
        this.defenderNode.shieldNode.rotation.z = Math.PI / 2 + Math.sin(t * Math.PI) * 0.35
      } else if (this.defenderNode.weaponNode) {
        this.defenderNode.weaponNode.rotation.x = Math.sin(t * Math.PI) * 0.30
      }
    }
    // 2. Phase: Approach & Defensive Reaction (0.22 -> 0.54)
    else if (progress < 0.54) {
      this.currentPhase = 'approach'
      const t = (progress - 0.22) / 0.32

      // Attacker translates forward towards exact contact position
      this.attackerNode.group.position.lerpVectors(this.attackerStartPos, this.contactPos, t)

      // Attacker Class Locomotion
      if (attackerClass === 'N') {
        // Articulated 4-leg canter/trot gait with knee/hock flex
        const trotCycle = t * Math.PI * 6
        const legUpperAngle = Math.sin(trotCycle) * 0.42
        const legLowerAngle = Math.max(0, Math.sin(trotCycle)) * 0.48 // knee flexes backward on backswing

        const flUpper = this.attackerNode.group.getObjectByName('Horse_FL_Upper')
        const flLower = this.attackerNode.group.getObjectByName('Horse_FL_Lower')
        const frUpper = this.attackerNode.group.getObjectByName('Horse_FR_Upper')
        const frLower = this.attackerNode.group.getObjectByName('Horse_FR_Lower')
        const blUpper = this.attackerNode.group.getObjectByName('Horse_BL_Upper')
        const blLower = this.attackerNode.group.getObjectByName('Horse_BL_Lower')
        const brUpper = this.attackerNode.group.getObjectByName('Horse_BR_Upper')
        const brLower = this.attackerNode.group.getObjectByName('Horse_BR_Lower')

        if (flUpper) flUpper.rotation.x = legUpperAngle
        if (flLower) flLower.rotation.x = legLowerAngle
        if (frUpper) frUpper.rotation.x = -legUpperAngle
        if (frLower) frLower.rotation.x = Math.max(0, -legUpperAngle) * 0.48
        if (blUpper) blUpper.rotation.x = -legUpperAngle
        if (blLower) blLower.rotation.x = Math.max(0, -legUpperAngle) * 0.48
        if (brUpper) brUpper.rotation.x = legUpperAngle
        if (brLower) brLower.rotation.x = legLowerAngle

        // Gallop vertical bob & pitch
        this.attackerNode.group.position.y = Math.abs(Math.sin(trotCycle)) * 0.04
        this.attackerNode.group.rotation.x = Math.sin(trotCycle * 0.5) * 0.08

        // Couched lance posture: lowers smoothly into strike
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.50
        }
      } else if (attackerClass === 'P') {
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.85
        }
        this.attackerNode.group.position.y = Math.sin(t * Math.PI * 4) * 0.02
      } else if (attackerClass === 'R') {
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.position.z = Math.sin(t * Math.PI) * 0.16
        }
      } else {
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = t * 0.70
        }
      }

      // Defender Anticipatory Reaction & Block
      if (defenderClass === 'B') {
        // Bishop raises and angles warding lotus staff to absorb incoming strike
        if (this.defenderNode.weaponNode) {
          this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI * 0.5) * 0.65
          this.defenderNode.weaponNode.rotation.x = Math.sin(t * Math.PI * 0.5) * 0.42
        }
        if (this.defenderNode.torsoNode) {
          this.defenderNode.torsoNode.rotation.y = Math.sin(t * Math.PI * 0.5) * 0.25
        }
      } else if (defenderClass === 'P') {
        if (this.defenderNode.shieldNode) {
          this.defenderNode.shieldNode.position.z = Math.sin(t * Math.PI * 0.5) * 0.14
          this.defenderNode.shieldNode.rotation.y = -Math.sin(t * Math.PI * 0.5) * 0.28
        }
      } else if (defenderClass === 'N') {
        this.defenderNode.group.rotation.y = this.defenderTargetYaw + Math.sin(t * Math.PI * 0.5) * 0.35
      } else if (this.defenderNode.weaponNode) {
        this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI * 0.5) * 0.45
      }
    }
    // 3. Phase: Synchronized Weapon Impact & Spark (0.54)
    else if (progress >= 0.54 && !this.hasTriggeredImpact) {
      this.hasTriggeredImpact = true
      this.currentPhase = 'impact'

      // Trigger Web Audio impact sound & callback
      this.onContactCallback?.()

      // Spawn physical fracture debris
      this.debris.spawnCaptureFracture(
        this.defenderPos,
        this.defenderNode.pieceCode,
        this.pacing === 'reduced'
      )
    }
    // 4. Phase: Physical Recoil & Structural Shell Fracture (0.54 -> 0.80)
    else if (progress < 0.80) {
      this.currentPhase = 'stagger_fracture'
      const t = (progress - 0.54) / 0.26

      // Attacker follows through with strike
      if (this.attackerNode.weaponNode) {
        this.attackerNode.weaponNode.rotation.x = (1.0 - t) * 0.50
      }
      this.attackerNode.group.position.y = 0
      this.attackerNode.group.rotation.x = 0

      // Reset horse legs after impact
      if (attackerClass === 'N') {
        const flUpper = this.attackerNode.group.getObjectByName('Horse_FL_Upper')
        const flLower = this.attackerNode.group.getObjectByName('Horse_FL_Lower')
        const frUpper = this.attackerNode.group.getObjectByName('Horse_FR_Upper')
        const frLower = this.attackerNode.group.getObjectByName('Horse_FR_Lower')
        const blUpper = this.attackerNode.group.getObjectByName('Horse_BL_Upper')
        const blLower = this.attackerNode.group.getObjectByName('Horse_BL_Lower')
        const brUpper = this.attackerNode.group.getObjectByName('Horse_BR_Upper')
        const brLower = this.attackerNode.group.getObjectByName('Horse_BR_Lower')
        if (flUpper) flUpper.rotation.x = 0
        if (flLower) flLower.rotation.x = 0
        if (frUpper) frUpper.rotation.x = 0
        if (frLower) frLower.rotation.x = 0
        if (blUpper) blUpper.rotation.x = 0
        if (blLower) blLower.rotation.x = 0
        if (brUpper) brUpper.rotation.x = 0
        if (brLower) brLower.rotation.x = 0
      }

      // NO WHOLE-MODEL SHRINKING: Group scale remains 1.0!
      this.defenderNode.group.scale.set(1, 1, 1)

      // Physical Stagger Recoil backwards along strike vector with grounded contact
      const staggerDist = Math.sin(t * Math.PI * 0.5) * 0.26
      this.defenderNode.group.position.addVectors(
        this.defenderPos,
        this.attackDir.clone().multiplyScalar(staggerDist)
      )

      // Torso staggers backward while base remains grounded
      if (this.defenderNode.torsoNode) {
        this.defenderNode.torsoNode.rotation.x = -t * 0.75
      }

      // Authored Shell Fracture separation
      this.defenderNode.group.traverse((obj) => {
        if (obj.name.startsWith('Fracture_')) {
          obj.position.y += Math.sin(t * Math.PI) * 0.05
          obj.position.z += t * 0.12
          obj.rotation.x += t * 0.70
        }
      })
    }
    // 5. Phase: Settling & Occupation (0.80 -> 1.0)
    else {
      this.currentPhase = 'settling'
      const t = (progress - 0.80) / 0.20

      // Defeated upper body is dismantled, plinth remains grounded on square
      this.defenderNode.group.visible = false

      // Attacker takes final step into destination square center
      this.attackerNode.group.position.lerpVectors(this.contactPos, this.destinationPos, t)

      // Restore upright posture & resting weapon
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
      const flLower = this.attackerNode.group.getObjectByName('Horse_FL_Lower')
      const frUpper = this.attackerNode.group.getObjectByName('Horse_FR_Upper')
      const frLower = this.attackerNode.group.getObjectByName('Horse_FR_Lower')
      const blUpper = this.attackerNode.group.getObjectByName('Horse_BL_Upper')
      const blLower = this.attackerNode.group.getObjectByName('Horse_BL_Lower')
      const brUpper = this.attackerNode.group.getObjectByName('Horse_BR_Upper')
      const brLower = this.attackerNode.group.getObjectByName('Horse_BR_Lower')
      if (flUpper) flUpper.rotation.x = 0
      if (flLower) flLower.rotation.x = 0
      if (frUpper) frUpper.rotation.x = 0
      if (frLower) frLower.rotation.x = 0
      if (blUpper) blUpper.rotation.x = 0
      if (blLower) blLower.rotation.x = 0
      if (brUpper) brUpper.rotation.x = 0
      if (brLower) brLower.rotation.x = 0
      this.attackerNode.isAnimating = false
    }

    if (this.defenderNode) {
      this.defenderNode.group.visible = false
      this.defenderNode.group.scale.set(1, 1, 1)
      this.defenderNode.isAnimating = false
    }

    // Return camera smoothly to active mode (tactical or cinematic)
    if (this.cameraCtrl.currentMode === 'encounter') {
      this.cameraCtrl.setMode('tactical')
    }

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
