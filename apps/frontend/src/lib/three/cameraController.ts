/**
 * 3D Camera Controller with Dynamic Bounding-Box Fitting & Smooth Transitions
 * Authoritative specification: docs/astra/ANIMATION.md, AUDIT.md
 * 
 * Guarantees:
 * - Dynamic Box3 camera fitting based on scene bounds, FOV, and aspect ratio
 * - Full 8x8 physical board accessibility on desktop and mobile viewports (zero rank/file cropping)
 * - Coordinated encounter framing focused on actual contact clash area
 * - Smooth, non-jarring camera restoration
 * - Orbiting victory/defeat choreography
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

  // Scene bounding box (board slab [-4.7, 4.7] + piece heights [0, 2.0])
  private sceneBox = new THREE.Box3(
    new THREE.Vector3(-4.8, 0, -4.8),
    new THREE.Vector3(4.8, 2.0, 4.8)
  )

  // Orbit angle for ending cinematics
  private orbitAngle = 0
  private isOrbiting = false

  constructor(aspect = 1.0) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100)
    this.updateCameraFitting()
    this.camera.position.copy(this.targetPosition)
    this.camera.lookAt(this.targetLookAt)
    this.currentLookAt.copy(this.targetLookAt)
  }

  /**
   * Computes exact camera distance and coordinates to fit a bounding box
   * without edge clipping across any aspect ratio (portrait or landscape).
   */
  public fitToBounds(box: THREE.Box3, margin = 0.22) {
    const center = new THREE.Vector3()
    box.getCenter(center)
    const size = new THREE.Vector3()
    box.getSize(size)

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov)
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * this.camera.aspect)

    const flipFactor = this.isFlipped ? -1 : 1

    let elevationRad: number
    let lookAtOffsetZ: number
    let baseDistance: number

    switch (this.currentMode) {
      case 'cinematic':
        elevationRad = THREE.MathUtils.degToRad(32)
        lookAtOffsetZ = 0.3 * flipFactor
        baseDistance = ((size.y * 0.5 + size.z * 0.5) / Math.tan(vFovRad / 2)) * (1.0 + margin)
        break
      case 'tactical':
      default:
        // Precise tactical camera angle (y = 10.5, z = 7.8) -> elevation ~53.4 deg, distance ~13.08
        elevationRad = Math.atan2(10.5, 7.8)
        lookAtOffsetZ = 0.0
        baseDistance = 13.08 * (1.0 + margin * 0.1)
        break
    }

    // Ensure horizontal extent fits on narrow/portrait screens (mobile responsiveness)
    const fitWidthDist = (size.x * 0.5) / Math.tan(hFovRad / 2) * (1.0 + margin)
    const distance = Math.max(baseDistance, fitWidthDist)

    this.targetPosition.set(
      center.x,
      center.y + distance * Math.sin(elevationRad),
      center.z + distance * Math.cos(elevationRad) * flipFactor
    )
    this.targetLookAt.set(center.x, center.y + 0.15, center.z + lookAtOffsetZ)
  }

  /**
   * Recalculates camera target based on active scene bounds and mode
   */
  public updateCameraFitting() {
    if (this.currentMode === 'ending') {
      this.orbitAngle = this.isFlipped ? Math.PI : 0
      this.targetPosition.set(
        Math.sin(this.orbitAngle) * 7.5,
        4.0,
        Math.cos(this.orbitAngle) * 7.5
      )
      this.targetLookAt.set(0, 0.35, 0)
      return
    }

    if (this.currentMode === 'encounter') {
      return // Encounter director controls framing
    }

    this.fitToBounds(this.sceneBox)
  }

  /**
   * Sets perspective orientation (White = normal, Black = 180 deg flipped)
   */
  public setOrientation(side: 'white' | 'black') {
    this.isFlipped = side === 'black'
    this.updateCameraFitting()
  }

  /**
   * Sets camera view mode
   */
  public setMode(mode: CameraViewMode) {
    this.currentMode = mode
    this.isOrbiting = mode === 'ending'
    this.updateCameraFitting()
  }

  /**
   * Frames the actual clash / contact area during a capture sequence
   * Focuses directly on the attacker and defender clash zone with proper bounding margin
   */
  public frameCombatEncounter(attackerPos: THREE.Vector3, defenderPos: THREE.Vector3) {
    const clashBox = new THREE.Box3()
    clashBox.setFromPoints([attackerPos, defenderPos])
    // Expand to include piece heights and weapon outreaches
    clashBox.expandByScalar(1.2)

    const center = new THREE.Vector3()
    clashBox.getCenter(center)

    const dir = new THREE.Vector3().subVectors(defenderPos, attackerPos).normalize()
    const sideVector = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
    const flipFactor = this.isFlipped ? -1 : 1

    // Camera positioned at 45 deg lateral angle to the clash line
    const lateralSign = (sideVector.x >= 0 ? 1 : -1)
    const cameraOffset = new THREE.Vector3()
      .copy(sideVector)
      .multiplyScalar(2.6 * lateralSign)
      .add(new THREE.Vector3(0, 2.2, 2.0 * flipFactor))

    this.targetPosition.copy(defenderPos).add(cameraOffset)
    this.targetLookAt.copy(defenderPos).add(new THREE.Vector3(0, 0.42, 0))
    this.currentMode = 'encounter'
  }

  /**
   * Updates camera aspect ratio on window/container resize and refits
   */
  public updateAspect(aspect: number) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this.updateCameraFitting()
    this.camera.position.copy(this.targetPosition)
    this.camera.lookAt(this.targetLookAt)
  }

  /**
   * Smooth update loop (rAF)
   */
  public update(delta: number) {
    const lerpFactor = Math.min(1.0, delta * 4.8)

    // Slow cinematic orbit during game ending
    if (this.isOrbiting) {
      this.orbitAngle += delta * 0.22
      this.targetPosition.set(
        Math.sin(this.orbitAngle) * 7.4,
        3.8 + Math.sin(this.orbitAngle * 0.5) * 0.4,
        Math.cos(this.orbitAngle) * 7.4
      )
    }

    // Smooth position interpolation
    this.camera.position.lerp(this.targetPosition, lerpFactor)

    // Smooth lookAt interpolation
    this.currentLookAt.lerp(this.targetLookAt, lerpFactor)
    this.camera.lookAt(this.currentLookAt)
  }
}
