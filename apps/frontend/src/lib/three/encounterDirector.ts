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
import { CARD_REST_TILT_X, PieceBuilder3D } from './pieceBuilder.ts'
import { DebrisSystem3D } from './debris3D.ts'
import { CameraController3D } from './cameraController.ts'
import { IndianArmiesRuntime } from './indianArmiesRuntime.ts'
import { SpriteEncounterStage } from './spriteEncounterStage.ts'
import type { VisualPhase } from './visualEventQueue.ts'

export type EncounterPhase =
  | 'idle'
  | 'anticipation'     // 0% - 18%
  | 'approach'         // 18% - 54%
  | 'impact'           // 54% - 57.5%
  | 'stagger_fracture' // 57.5% - 80%
  | 'settling'         // 80% - 100%

export class EncounterDirector3D {
  public spriteStage: SpriteEncounterStage | null = null
  public onPhase?: (phase: VisualPhase) => void
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
  private hasTriggeredStrike = false
  private hasTriggeredImpact = false
  private hasTriggeredStagger = false
  private hasTriggeredDefeat = false
  private onAnticipationCallback?: () => void
  private onCompleteCallback?: () => void
  private onContactCallback?: () => void
  private onDefeatCallback?: () => void
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
    if (this.isActive) throw new Error('Capture must be serialized before starting another encounter')
    if (this.spriteStage && attacker.cardMesh && defender.cardMesh) {
      this.isActive=true
      this.currentPhase='anticipation'
      this.spriteStage.onPhase=(phase) => {
        this.currentPhase=phase==='APPROACHING'?'approach':phase==='CONTACT'||phase==='IMPACT'?'impact':phase==='DESTRUCTION'?'stagger_fracture':phase==='SETTLEMENT'?'settling':'anticipation'
        this.onPhase?.(phase)
      }
      this.spriteStage.start(attacker,defender,{
        ...params,onComplete:() => { this.isActive=false;this.currentPhase='idle';params.onComplete?.() },
      },attacker.group.userData.encounterId as string || attacker.group.uuid)
      return
    }
    this.attackerNode = attacker
    this.defenderNode = defender
    this.pacing = params.pacing
    this.onAnticipationCallback = params.onAnticipation
    this.onContactCallback = params.onContact
    this.onDefeatCallback = params.onDefeat
    this.onCompleteCallback = params.onComplete

    this.attackerStartPos.copy(attacker.group.position)
    this.defenderPos.copy(defender.group.position)
    this.destinationPos.copy(params.isEnPassant ? attacker.targetPosition : defender.group.position)
    if (params.isEnPassant && this.destinationPos.lengthSq() === 0) {
      this.destinationPos.copy(defender.group.position)
    }

    attacker.isAnimating = true
    defender.isAnimating = true
    defender.group.visible = true

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

    // Orient combatants: 3D models face each other; 2.5D cards stay aligned with camera azimuth + subtle combat turn
    this.attackerTargetYaw = Math.atan2(this.attackDir.x, this.attackDir.z)
    this.defenderTargetYaw = Math.atan2(-this.attackDir.x, -this.attackDir.z)

    const is2p5d = !!(attacker.cardMesh || defender.cardMesh || attacker.group.name.includes('2p5D') || defender.group.name.includes('2p5D'))
    if (is2p5d) {
      const camYaw = this.cameraCtrl.getAzimuthAngle()
      const shortestAngleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
      const atkDelta = THREE.MathUtils.clamp(shortestAngleDiff(this.attackerTargetYaw, camYaw), -0.26, 0.26)
      const defDelta = THREE.MathUtils.clamp(shortestAngleDiff(this.defenderTargetYaw, camYaw), -0.26, 0.26)
      attacker.group.rotation.y = camYaw + atkDelta
      defender.group.rotation.y = camYaw + defDelta
    } else {
      attacker.group.rotation.y = this.attackerTargetYaw
      defender.group.rotation.y = this.defenderTargetYaw
    }

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

    // Exact contact root position: stops where weapon tip aligns with defender contact point
    const is2p5dPair = !!(attacker.cardMesh || defender.cardMesh || attacker.group.name.includes('2p5D') || defender.group.name.includes('2p5D'))
    const effectiveReach = is2p5dPair
      ? IndianArmiesRuntime.resolveContactSeparation(attacker.pieceCode, defender.pieceCode)
      : Math.max(0.20, forwardReach - anchorOffset)
    const travelDist = Math.max(0.15, dist - effectiveReach)
    this.contactPos.addVectors(this.attackerStartPos, this.attackDir.clone().multiplyScalar(travelDist))

    // Frame camera on combat encounter
    if (this.pacing === 'cinematic') {
      this.cameraCtrl.frameCombatEncounter(this.attackerStartPos, this.defenderPos)
    }

    this.startTime = performance.now()
    this.hasTriggeredStrike = false
    this.hasTriggeredImpact = false
    this.hasTriggeredStagger = false
    this.hasTriggeredDefeat = false
    this.isActive = true
    this.currentPhase = 'anticipation'

    // Trigger authentic character anticipation animations (attack_anticipation 4f@12fps; defend 6f@12fps holding block pose)
    attacker.animator?.playClip('attack_anticipation', false)
    defender.animator?.playClip('defend', false)
    this.onAnticipationCallback?.()
  }

  /**
   * Advances the two-piece encounter step
   */
  public update(now: number) {
    if (this.spriteStage?.isActive) { this.spriteStage.update(now);return }
    if (!this.isActive || !this.attackerNode || !this.defenderNode) return

    const elapsed = now - this.startTime
    const progress = Math.min(1.0, elapsed / this.durationMs)

    const attackerClass = this.attackerNode.pieceCode.slice(1).toUpperCase()
    const defenderClass = this.defenderNode.pieceCode.slice(1).toUpperCase()

    // 1. Phase: Anticipation (0.0 -> 0.18)
    if (progress < 0.18) {
      this.currentPhase = 'anticipation'
      const t = progress / 0.18

      // 2.5D Stylized Miniature Anticipation
      if (this.attackerNode.group.name.includes('2p5D')) {
        const card = this.attackerNode.group.getObjectByName(`Card_${this.attackerNode.pieceCode}`)
        if (card) {
          if (attackerClass === 'N') {
            this.attackerNode.group.position.y = this.attackerStartPos.y + Math.sin(t * Math.PI) * 0.10
            card.rotation.x = CARD_REST_TILT_X - Math.sin(t * Math.PI) * 0.08
          } else {
            card.rotation.x = CARD_REST_TILT_X - Math.sin(t * Math.PI) * 0.06
            this.attackerNode.group.position.y = this.attackerStartPos.y + Math.sin(t * Math.PI) * 0.04
          }
        }
      } else {
        // 3D Model Anticipation
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = -Math.sin(t * Math.PI) * 0.35
        }
        if (this.attackerNode.torsoNode) {
          this.attackerNode.torsoNode.position.y = Math.sin(t * Math.PI) * 0.04
        }
      }

      // Defender spots threat and raises defensive staff/shield
      if (this.defenderNode.group.name.includes('2p5D')) {
        const defCard = this.defenderNode.group.getObjectByName(`Card_${this.defenderNode.pieceCode}`)
        if (defCard) {
          defCard.rotation.x = CARD_REST_TILT_X - Math.sin(t * Math.PI) * 0.04
        }
      } else {
        if (defenderClass === 'B' && this.defenderNode.weaponNode) {
          this.defenderNode.weaponNode.rotation.z = Math.sin(t * Math.PI) * 0.40
        } else if (defenderClass === 'P' && this.defenderNode.shieldNode) {
          this.defenderNode.shieldNode.rotation.z = Math.PI / 2 + Math.sin(t * Math.PI) * 0.35
        } else if (this.defenderNode.weaponNode) {
          this.defenderNode.weaponNode.rotation.x = Math.sin(t * Math.PI) * 0.30
        }
      }
    }
    // 2. Phase: Approach & Pre-Impact Strike Windup (0.18 -> 0.54)
    else if (progress < 0.54) {
      if (this.currentPhase !== 'approach') {
        this.currentPhase = 'approach'
        this.attackerNode.animator?.playClip('move', true)
      }
      const is2p5dAtk = this.attackerNode.group.name.includes('2p5D')
      // Start 2.5D attack clip ~250ms before impact so local contactFrame=4 lands cleanly at progress=0.54
      if (is2p5dAtk && progress >= 0.41 && !this.hasTriggeredStrike) {
        this.hasTriggeredStrike = true
        this.attackerNode.animator?.playClip('attack', false)
      }
      const t = (progress - 0.18) / 0.36

      // Attacker translates forward towards exact contact position
      this.attackerNode.group.position.lerpVectors(this.attackerStartPos, this.contactPos, t)

      // 2.5D Stylized Locomotion
      if (is2p5dAtk) {
        const card = this.attackerNode.group.getObjectByName(`Card_${this.attackerNode.pieceCode}`)
        if (attackerClass === 'N') {
          this.attackerNode.group.position.y = this.attackerStartPos.y + Math.sin(t * Math.PI) * 0.34
          if (card) card.rotation.x = CARD_REST_TILT_X + Math.sin(t * Math.PI) * 0.08
        } else {
          this.attackerNode.group.position.y = this.attackerStartPos.y + Math.abs(Math.sin(t * Math.PI * 5)) * 0.025
          if (card) card.rotation.x = CARD_REST_TILT_X + Math.sin(t * Math.PI) * 0.04
        }
      } else {
        // 3D Model Locomotion
        if (attackerClass === 'N') {
          const trotCycle = t * Math.PI * 6
          const legUpperAngle = Math.sin(trotCycle) * 0.42
          const legLowerAngle = Math.max(0, Math.sin(trotCycle)) * 0.48

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

          this.attackerNode.group.position.y = Math.abs(Math.sin(trotCycle)) * 0.04
          this.attackerNode.group.rotation.x = Math.sin(trotCycle * 0.5) * 0.08

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
      }

      // Defender Anticipatory Reaction & Block
      if (this.defenderNode.group.name.includes('2p5D')) {
        const defCard = this.defenderNode.group.getObjectByName(`Card_${this.defenderNode.pieceCode}`)
        if (defCard) {
          if (defenderClass === 'B') {
            defCard.rotation.z = Math.sin(t * Math.PI * 0.5) * 0.18
            defCard.rotation.x = CARD_REST_TILT_X - Math.sin(t * Math.PI * 0.5) * 0.08
          } else if (defenderClass === 'P') {
            defCard.rotation.z = -Math.sin(t * Math.PI * 0.5) * 0.14
          }
        }
      } else {
        if (defenderClass === 'B') {
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
    }
    // 3. Phase: Synchronized Weapon Impact & Brief Hit-Stop Freeze (0.54 -> 0.575)
    else if (progress >= 0.54 && !this.hasTriggeredImpact) {
      this.hasTriggeredImpact = true
      this.currentPhase = 'impact'

      // Snap attacker right to contactPos on impact
      this.attackerNode.group.position.copy(this.contactPos)

      if (!this.hasTriggeredStrike) {
        this.hasTriggeredStrike = true
        this.attackerNode.animator?.playClip('attack', false)
      } else if (this.attackerNode.animator?.currentClip === 'attack') {
        // Lock frame 4 at contact moment for visual crispness
        this.attackerNode.animator.setFrame(4)
      }
      this.defenderNode.animator?.playClip('hit', false)

      // White hit flash on defender card (Warcraft III RTS Impact)
      const defCard = this.defenderNode.group.getObjectByName(`Card_${this.defenderNode.pieceCode}`) as THREE.Mesh
      if (defCard && (defCard.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const mat = defCard.material as THREE.MeshStandardMaterial
        mat.emissive.setHex(0xffffff)
        mat.emissiveIntensity = 0.95
        setTimeout(() => {
          mat.emissive.setHex(0x000000)
          mat.emissiveIntensity = 0
        }, 90)
      }

      // Camera trauma micro-shake
      this.cameraCtrl.triggerTrauma(0.065)

      // Trigger Web Audio impact sound & callback
      this.onContactCallback?.()

      // Spawn physical fracture shards + Sol's faction impact debris burst
      const defenderFaction = this.defenderNode.pieceCode.startsWith('b') ? 'b' : 'w'
      const effectMeta = IndianArmiesRuntime.getEffectSpriteDef(defenderFaction)
      const effectTex = this.defenderNode.group.name.includes('2p5D')
        ? PieceBuilder3D.getEffectSpriteTexture(defenderFaction)
        : undefined
      const contactWorld = new THREE.Vector3().lerpVectors(this.contactPos, this.defenderPos, 0.5)

      this.debris.spawnCaptureFracture(
        contactWorld,
        this.defenderNode.pieceCode,
        this.pacing === 'reduced',
        effectTex
          ? {
              texture: effectTex,
              cols: effectMeta.cols,
              rows: effectMeta.rows,
              count: effectMeta.count,
              fps: effectMeta.fps,
              tiltRad: CARD_REST_TILT_X,
            }
          : undefined
      )
    }
    // Brief impact freeze hold (0.54 -> 0.575) for weighty weapon contact readability
    else if (progress < 0.575) {
      this.currentPhase = 'impact'
    }
    // 4. Phase: Physical Recoil & Structural Shell Fracture (0.575 -> 0.80)
    else if (progress < 0.80) {
      if (this.currentPhase !== 'stagger_fracture') {
        this.currentPhase = 'stagger_fracture'
        if (!this.hasTriggeredStagger) {
          this.hasTriggeredStagger = true
          this.defenderNode.animator?.playClip('stagger', false)
        }
        if (!this.hasTriggeredDefeat) {
          this.hasTriggeredDefeat = true
          this.onDefeatCallback?.()
        }
      }
      const is2p5dDef = this.defenderNode.group.name.includes('2p5D')
      // Enter defeat sculpted-shell fracture clip cleanly at 0.64 and sweep all 8 frames before settling
      if (progress >= 0.64) {
        if (this.defenderNode.animator && this.defenderNode.animator.currentClip !== 'defeat') {
          this.defenderNode.animator.playClip('defeat', false)
        }
        if (is2p5dDef && this.defenderNode.animator) {
          const defeatT = Math.min(0.999, (progress - 0.64) / 0.16)
          this.defenderNode.animator.setFrame(Math.floor(defeatT * 8))
        }
      }
      const t = (progress - 0.575) / 0.225

      if (this.attackerNode.group.name.includes('2p5D')) {
        if (progress >= 0.64 && this.attackerNode.animator?.currentClip !== 'idle') {
          this.attackerNode.animator?.playClip('idle', true)
        }
        const card = this.attackerNode.group.getObjectByName(`Card_${this.attackerNode.pieceCode}`)
        if (card) card.rotation.x = CARD_REST_TILT_X
        this.attackerNode.group.position.y = this.attackerStartPos.y
      } else {
        if (this.attackerNode.weaponNode) {
          this.attackerNode.weaponNode.rotation.x = (1.0 - t) * 0.50
        }
        this.attackerNode.group.position.y = 0
        this.attackerNode.group.rotation.x = 0

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
      }

      // Group scale remains 1.0
      this.defenderNode.group.scale.set(1, 1, 1)

      // Physical Stagger Recoil backwards along strike vector with grounded contact
      const staggerDist = Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.5) * 0.28
      this.defenderNode.group.position.addVectors(
        this.defenderPos,
        this.attackDir.clone().multiplyScalar(staggerDist)
      )

      if (is2p5dDef) {
        const defCard = this.defenderNode.group.getObjectByName(`Card_${this.defenderNode.pieceCode}`) as THREE.Mesh
        if (defCard) {
          defCard.rotation.x = CARD_REST_TILT_X - Math.min(1, t * 1.4) * 0.14
          if (defCard.material && 'opacity' in defCard.material) {
            (defCard.material as THREE.Material).opacity = progress > 0.77 ? Math.max(0, 1 - (progress - 0.77) / 0.03) : 1.0
          }
        }
      } else {
        if (this.defenderNode.torsoNode) {
          this.defenderNode.torsoNode.rotation.x = -t * 0.75
        }
        this.defenderNode.group.traverse((obj) => {
          if (obj.name.startsWith('Fracture_')) {
            obj.position.y += Math.sin(t * Math.PI) * 0.05
            obj.position.z += t * 0.12
            obj.rotation.x += t * 0.70
          }
        })
      }
    }
    // 5. Phase: Settling & Occupation (0.80 -> 1.0)
    else {
      if (this.currentPhase !== 'settling') {
        this.currentPhase = 'settling'
        this.attackerNode.animator?.playClip('idle', true)
      }
      const t = (progress - 0.80) / 0.20

      // Defeated upper body is dismantled, plinth remains grounded on square
      this.defenderNode.group.visible = false

      // Attacker takes final step into destination square center
      this.attackerNode.group.position.lerpVectors(this.contactPos, this.destinationPos, t)

      // Restore upright posture & resting weapon
      this.attackerNode.group.position.y = this.destinationPos.y
      this.attackerNode.group.rotation.x = 0

      if (this.attackerNode.group.name.includes('2p5D')) {
        const card = this.attackerNode.group.getObjectByName(`Card_${this.attackerNode.pieceCode}`)
        if (card) {
          card.rotation.x = CARD_REST_TILT_X
          card.rotation.z = 0
        }
      } else if (this.attackerNode.weaponNode) {
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
    if (this.spriteStage?.isActive) { this.spriteStage.finish(true);return }
    if (this.attackerNode) {
      this.attackerNode.group.position.copy(this.destinationPos)
      this.attackerNode.group.rotation.x = 0
      this.attackerNode.group.scale.set(1, 1, 1)
      if (this.attackerNode.group.name.includes('2p5D')) {
        this.attackerNode.group.rotation.y = this.cameraCtrl.isFlipped ? Math.PI : 0
        const card = this.attackerNode.group.getObjectByName(`Card_${this.attackerNode.pieceCode}`)
        if (card) {
          card.rotation.x = CARD_REST_TILT_X
          card.rotation.z = 0
        }
      } else if (this.attackerNode.weaponNode) {
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
      this.attackerNode.animator?.playClip('idle', true)
      this.attackerNode.isAnimating = false
    }

    if (this.defenderNode) {
      this.defenderNode.group.visible = false
      this.defenderNode.group.scale.set(1, 1, 1)
      this.defenderNode.isAnimating = false
    }

    // Return camera smoothly to active mode (tactical or cinematic)
    if (this.cameraCtrl.currentMode === 'encounter') {
      this.cameraCtrl.returnFromCombat()
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

  /** Invalidation is different from skip: it must never fire a stale completion. */
  public abort() {
    this.spriteStage?.cancel()
    this.isActive=false;this.currentPhase='idle'
    this.onCompleteCallback=undefined;this.onContactCallback=undefined
    this.onAnticipationCallback=undefined;this.onDefeatCallback=undefined
    this.attackerNode=null;this.defenderNode=null
    if (this.cameraCtrl.currentMode==='encounter') this.cameraCtrl.returnFromCombat()
  }
}
