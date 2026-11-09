/**
 * 3D Camera Controller with Long-Focal-Length Tactical Fitting & Dedicated Cinematic Framing
 * Authoritative specifications: FLASH — BLUNDERBOT: ASSET KIT INTEGRATION, CAMERA & BOARD RECOVERY
 *
 * Guarantees:
 * 1. Default Tactical View: Elevation 65–70 degrees (67°), long-focal-length perspective (FOV 34°),
 *    eliminating rank occlusion, clipping, and excessive empty vertical canvas space.
 * 2. Dedicated Cinematic View: Elevation 30–40 degrees (34°), framing attacker & defender clash zone.
 * 3. Automatic Tactical State Preservation & Clean Restoration after combat encounters.
 * 4. User Interaction: Safe orbit and zoom within calibrated physical limits with instant snap-back.
 * 5. Full Mobile Responsiveness: Dynamic horizontal bounding fitting without desktop shrinking.
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

  // Saved tactical state for combat encounter return
  private savedTacticalPosition = new THREE.Vector3()
  private savedTacticalLookAt = new THREE.Vector3()

  // Scene bounding box: physical board slab [-4.7, 4.7] + maximum piece height 2.0
  private sceneBox = new THREE.Box3(
    new THREE.Vector3(-4.8, 0, -4.8),
    new THREE.Vector3(4.8, 2.0, 4.8)
  )

  // User interactive orbit & zoom offsets
  private userAzimuth = 0 // Horizontal orbit radians
  private userPitchOffset = 0 // Vertical pitch adjustment radians
  private userZoom = 1.0 // Zoom factor (0.75x to 1.35x)

  // Orbit angle for ending cinematics
  private orbitAngle = 0
  private isOrbiting = false

  // Camera trauma / impact shake
  private trauma = 0

  constructor(aspect = 1.0) {
    // 34 deg FOV gives crisp long-focal-length perspective, preventing wide-angle edge warping
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 100)
    this.updateCameraFitting()
    this.camera.position.copy(this.targetPosition)
    this.camera.lookAt(this.targetLookAt)
    this.currentLookAt.copy(this.targetLookAt)
    this.savedTacticalPosition.copy(this.targetPosition)
    this.savedTacticalLookAt.copy(this.targetLookAt)
  }

  /**
   * Fits camera based on projected bounding geometry, viewport aspect ratio,
   * board dimensions, and occupied piece bounds.
   */
  public fitToBounds(box: THREE.Box3, margin = 0.08) {
    const center = new THREE.Vector3()
    box.getCenter(center)
    const size = new THREE.Vector3()
    box.getSize(size)

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov)
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * this.camera.aspect)
    const flipFactor = this.isFlipped ? -1 : 1

    let elevationRad: number
    let lookAtOffsetZ: number
    let fitHeightDist: number

    switch (this.currentMode) {
      case 'cinematic':
        // Dedicated combat cinematic angle (30–40 deg)
        elevationRad = THREE.MathUtils.degToRad(34)
        lookAtOffsetZ = 0.25 * flipFactor
        fitHeightDist = ((size.y * 0.5 + size.z * 0.5) / Math.tan(vFovRad / 2)) * (1.0 + margin)
        break

      case 'tactical':
      default: {
        // High tactical elevation (65–70 deg, exactly 67 deg)
        elevationRad = THREE.MathUtils.degToRad(67) + this.userPitchOffset
        // Clamp elevation to safe readable limits (52 deg to 82 deg)
        elevationRad = THREE.MathUtils.clamp(
          elevationRad,
          THREE.MathUtils.degToRad(52),
          THREE.MathUtils.degToRad(82)
        )
        lookAtOffsetZ = 0.0

        // Projected vertical extent in camera plane: board depth * cos(elev) + piece height * sin(elev)
        const projDepth = size.z * Math.cos(elevationRad) + size.y * Math.sin(elevationRad)
        fitHeightDist = ((projDepth * 0.5) / Math.tan(vFovRad / 2)) * (1.0 + margin)
        break
      }
    }

    // Horizontal extent distance to prevent left/right board cropping across aspect ratios
    const fitWidthDist = ((size.x * 0.5) / Math.tan(hFovRad / 2)) * (1.0 + margin)

    // Base distance fitted tightly to whichever axis constrains the viewport
    const baseDistance = Math.max(fitHeightDist, fitWidthDist)
    const distance = baseDistance * this.userZoom

    // Base azimuth based on board orientation + user drag offset
    const baseAzimuth = (this.isFlipped ? Math.PI : 0) + this.userAzimuth

    const horizontalDist = distance * Math.cos(elevationRad)
    const posX = center.x + horizontalDist * Math.sin(baseAzimuth)
    const posY = center.y + distance * Math.sin(elevationRad)
    const posZ = center.z + horizontalDist * Math.cos(baseAzimuth)

    this.targetPosition.set(posX, posY, posZ)
    this.targetLookAt.set(center.x, center.y + 0.15, center.z + lookAtOffsetZ)

    if (this.currentMode === 'tactical') {
      this.savedTacticalPosition.copy(this.targetPosition)
      this.savedTacticalLookAt.copy(this.targetLookAt)
    }
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
      return // Encounter director controls framing during combat
    }

    this.fitToBounds(this.sceneBox)
  }

  /**
   * Sets perspective orientation (White = normal, Black = 180 deg flipped)
   */
  public setOrientation(side: 'white' | 'black') {
    this.isFlipped = side === 'black'
    this.userAzimuth = 0 // Reset user rotation on orientation flip
    this.userPitchOffset = 0
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
   * Dedicated Combat Cinematic Camera Framing
   * Positions camera at 30–40 deg (34°) focused on the clash line between attacker and defender
   */
  public frameCombatEncounter(attackerPos: THREE.Vector3, defenderPos: THREE.Vector3) {
    // 1. Save tactical camera state for clean return
    this.savedTacticalPosition.copy(this.camera.position)
    this.savedTacticalLookAt.copy(this.currentLookAt)

    // 2. Identify midpoint and attack direction
    const midpoint = new THREE.Vector3().addVectors(attackerPos, defenderPos).multiplyScalar(0.5)
    const attackDir = new THREE.Vector3().subVectors(defenderPos, attackerPos).normalize()
    const sideVector = new THREE.Vector3(-attackDir.z, 0, attackDir.x).normalize()
    const flipFactor = this.isFlipped ? -1 : 1

    // 3. Position camera at 34 deg elevation, offset laterally to frame weapon contact & defender ward
    const lateralSign = (sideVector.x >= 0 ? 1 : -1)
    const combatElevationRad = THREE.MathUtils.degToRad(34)
    const cameraDistance = 3.6

    const camOffset = new THREE.Vector3()
      .copy(sideVector)
      .multiplyScalar(cameraDistance * Math.cos(combatElevationRad) * 0.75 * lateralSign)
      .add(new THREE.Vector3(0, cameraDistance * Math.sin(combatElevationRad), 1.2 * flipFactor))

    this.targetPosition.copy(midpoint).add(camOffset)
    this.targetLookAt.copy(midpoint).add(new THREE.Vector3(0, 0.45, 0))
    this.currentMode = 'encounter'
  }

  /**
   * Smoothly returns camera from combat encounter to tactical gameplay framing
   */
  public returnFromCombat() {
    this.currentMode = 'tactical'
    this.updateCameraFitting()
  }

  /**
   * User interaction: safely orbit camera horizontally and vertically within limits
   */
  public orbit(deltaX: number, deltaY: number) {
    if (this.currentMode !== 'tactical') return
    this.userAzimuth += deltaX * 0.005
    this.userPitchOffset -= deltaY * 0.004
    // Clamp pitch offset to stay within 52–82 deg range
    this.userPitchOffset = THREE.MathUtils.clamp(
      this.userPitchOffset,
      THREE.MathUtils.degToRad(-15),
      THREE.MathUtils.degToRad(15)
    )
    this.updateCameraFitting()
  }

  /**
   * User interaction: safely zoom camera in/out within limits
   */
  public zoom(deltaY: number) {
    if (this.currentMode !== 'tactical') return
    const zoomDelta = deltaY > 0 ? 0.05 : -0.05
    this.userZoom = THREE.MathUtils.clamp(this.userZoom + zoomDelta, 0.75, 1.35)
    this.updateCameraFitting()
  }

  /**
   * Resets camera to exact default tactical framing
   */
  public resetView() {
    this.userAzimuth = 0
    this.userPitchOffset = 0
    this.userZoom = 1.0
    this.currentMode = 'tactical'
    this.updateCameraFitting()
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
   * Triggers impact camera trauma micro-shake
   */
  public triggerTrauma(amount = 0.06) {
    this.trauma = Math.min(1.0, this.trauma + amount)
  }

  /**
   * Smooth update loop (rAF)
   */
  public update(delta: number) {
    const lerpFactor = Math.min(1.0, delta * 5.2)

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

    // Apply trauma shake decay
    if (this.trauma > 0.001) {
      const shakeFactor = this.trauma * this.trauma * 0.16
      this.camera.position.x += (Math.random() - 0.5) * shakeFactor
      this.camera.position.y += (Math.random() - 0.5) * shakeFactor
      this.trauma = Math.max(0, this.trauma - delta * 3.2)
    }
  }
}
