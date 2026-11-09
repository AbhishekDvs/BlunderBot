/**
 * 3D Camera Controller with Smooth Constrained Transitions
 * Manages Tactical (top-down angled), Cinematic (low-angle), Encounter (combat focus),
 * and Ending (victory orbit) camera behaviors.
 */

import * as THREE from 'three'
import type { CameraViewMode } from './types.ts'

export class CameraController3D {
  public camera: THREE.PerspectiveCamera
  public currentMode: CameraViewMode = 'tactical'
  public isFlipped = false // True if Black perspective

  private targetPosition = new THREE.Vector3()
  private targetLookAt = new THREE.Vector3(0, 0, 0)
  private currentLookAt = new THREE.Vector3(0, 0, 0)

  // Camera presets tuned for complete 8x8 battlefield coverage with generous margins
  private readonly TACTICAL_POS = new THREE.Vector3(0, 11.8, 9.6)
  private readonly CINEMATIC_POS = new THREE.Vector3(0, 6.8, 8.6)
  private readonly TACTICAL_LOOK = new THREE.Vector3(0, 0.1, 0)
  private readonly CINEMATIC_LOOK = new THREE.Vector3(0, 0.35, 0.3)

  // Orbit angle for ending cinematics
  private orbitAngle = 0
  private isOrbiting = false

  constructor(aspect = 1.0) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100)
    this.targetPosition.copy(this.TACTICAL_POS)
    this.camera.position.copy(this.TACTICAL_POS)
    this.camera.lookAt(this.TACTICAL_LOOK)
    this.currentLookAt.copy(this.TACTICAL_LOOK)
  }

  /**
   * Sets perspective orientation (White = normal, Black = 180 deg flipped)
   */
  public setOrientation(side: 'white' | 'black') {
    this.isFlipped = side === 'black'
    this.applyMode(this.currentMode)
  }

  /**
   * Toggles or sets camera view mode
   */
  public setMode(mode: CameraViewMode) {
    this.currentMode = mode
    this.isOrbiting = mode === 'ending'
    this.applyMode(mode)
  }

  private applyMode(mode: CameraViewMode) {
    const flipFactor = this.isFlipped ? -1 : 1

    switch (mode) {
      case 'tactical':
        this.targetPosition.set(0, this.TACTICAL_POS.y, this.TACTICAL_POS.z * flipFactor)
        this.targetLookAt.copy(this.TACTICAL_LOOK)
        break

      case 'cinematic':
        this.targetPosition.set(0, this.CINEMATIC_POS.y, this.CINEMATIC_POS.z * flipFactor)
        this.targetLookAt.set(0, this.CINEMATIC_LOOK.y, this.CINEMATIC_LOOK.z * flipFactor)
        break

      case 'ending':
        this.orbitAngle = this.isFlipped ? Math.PI : 0
        this.targetPosition.set(
          Math.sin(this.orbitAngle) * 7.5,
          4.0,
          Math.cos(this.orbitAngle) * 7.5
        )
        this.targetLookAt.set(0, 0.3, 0)
        break

      default:
        break
    }
  }

  /**
   * Frames the actual clash / contact area during a capture sequence
   * (Focuses directly on the defender's destination square rather than a faraway midpoint)
   */
  public frameCombatEncounter(attackerPos: THREE.Vector3, defenderPos: THREE.Vector3) {
    const dir = new THREE.Vector3().subVectors(defenderPos, attackerPos).normalize()
    const sideVector = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
    const flipFactor = this.isFlipped ? -1 : 1

    // Camera offset angled towards the strike zone
    const cameraOffset = new THREE.Vector3()
      .copy(sideVector)
      .multiplyScalar(2.8 * (sideVector.x >= 0 ? 1 : -1))
      .add(new THREE.Vector3(0, 2.4, 2.2 * flipFactor))

    this.targetPosition.copy(defenderPos).add(cameraOffset)
    this.targetLookAt.copy(defenderPos).add(new THREE.Vector3(0, 0.45, 0))
    this.currentMode = 'encounter'
  }

  /**
   * Smooth update loop (rAF)
   */
  public update(delta: number) {
    const lerpFactor = Math.min(1.0, delta * 4.5)

    // Slow cinematic orbit during game ending
    if (this.isOrbiting) {
      this.orbitAngle += delta * 0.25
      this.targetPosition.set(
        Math.sin(this.orbitAngle) * 7.2,
        3.8 + Math.sin(this.orbitAngle * 0.5) * 0.5,
        Math.cos(this.orbitAngle) * 7.2
      )
    }

    // Smooth position interpolation
    this.camera.position.lerp(this.targetPosition, lerpFactor)

    // Smooth lookAt interpolation
    this.currentLookAt.lerp(this.targetLookAt, lerpFactor)
    this.camera.lookAt(this.currentLookAt)
  }

  public updateAspect(aspect: number) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }
}
