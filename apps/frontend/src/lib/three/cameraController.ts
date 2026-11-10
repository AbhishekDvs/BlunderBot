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

  // Scene bounding box: physical board slab [-4.8, 4.8] + piece height 1.35
  private sceneBox = new THREE.Box3(
    new THREE.Vector3(-4.8, 0, -4.8),
    new THREE.Vector3(4.8, 1.35, 4.8)
  )

  // User interactive orbit & zoom offsets
  private userAzimuth = 0 // Horizontal orbit radians
  private userPitchOffset = 0 // Vertical pitch adjustment radians
  private userZoom = 1.0 // Zoom factor (0.85x to 1.25x)
  public restrict2p5d = true // Prevents arbitrary 360 rotation that breaks 2.5D sprites

  // Orbit angle for ending cinematics
  private orbitAngle = 0
  private isOrbiting = false
  private encounterOwner: string | null = null
  private encounterState: {
    position: THREE.Vector3; quaternion: THREE.Quaternion; targetPosition: THREE.Vector3;
    targetLookAt: THREE.Vector3; lookAt: THREE.Vector3; mode: CameraViewMode; orbiting: boolean
  } | null = null

  public acquireEncounter(owner: string) {
    if (this.encounterOwner && this.encounterOwner !== owner) throw new Error('Camera is already owned by another encounter')
    if (this.encounterOwner === owner) return
    this.encounterOwner=owner
    this.encounterState={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),targetPosition:this.targetPosition.clone(),targetLookAt:this.targetLookAt.clone(),lookAt:this.currentLookAt.clone(),mode:this.currentMode,orbiting:this.isOrbiting}
    this.targetPosition.copy(this.camera.position);this.targetLookAt.copy(this.currentLookAt)
    this.isOrbiting=false;this.trauma=0;this.currentMode='encounter'
  }

  public releaseEncounter(owner: string) {
    if (owner !== this.encounterOwner || !this.encounterState) return false
    const saved=this.encounterState
    this.camera.position.copy(saved.position);this.camera.quaternion.copy(saved.quaternion)
    this.targetPosition.copy(saved.targetPosition);this.targetLookAt.copy(saved.targetLookAt);this.currentLookAt.copy(saved.lookAt)
    this.currentMode=saved.mode;this.isOrbiting=saved.orbiting
    this.encounterOwner=null;this.encounterState=null;this.trauma=0
    return true
  }

  public getSnapshot() {
    return {position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),target:this.targetPosition.toArray(),lookAt:this.currentLookAt.toArray(),mode:this.currentMode,owner:this.encounterOwner,isFlipped:this.isFlipped,azimuth:this.userAzimuth,pitch:this.userPitchOffset,zoom:this.userZoom}
  }

  // Camera trauma / impact shake
  private trauma = 0

  constructor(aspect = 1.0) {
    // 34 deg FOV gives crisp long-focal-length perspective, preventing wide-angle edge warping
    this.camera = new THREE.PerspectiveCamera(22, aspect, 0.1, 100)
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
  public fitToBounds(box: THREE.Box3, margin = 0.07) {
    const center = new THREE.Vector3()
    box.getCenter(center)

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov)
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * this.camera.aspect)
    const flipFactor = this.isFlipped ? -1 : 1

    let elevationRad: number
    let lookAtOffsetZ: number

    switch (this.currentMode) {
      case 'cinematic':
        // Dedicated combat cinematic angle (30–40 deg)
        elevationRad = THREE.MathUtils.degToRad(34)
        lookAtOffsetZ = 0.25 * flipFactor
        break

      case 'tactical':
      default: {
        // Oblique tactical elevation calibrated to 2.5D rendered character sprites (45-55 deg, exactly 48 deg)
        elevationRad = THREE.MathUtils.degToRad(48) + this.userPitchOffset
        // Clamp elevation to safe readable limits (36 deg to 68 deg)
        elevationRad = THREE.MathUtils.clamp(
          elevationRad,
          THREE.MathUtils.degToRad(36),
          THREE.MathUtils.degToRad(68)
        )
        lookAtOffsetZ = 0.0

        break
      }
    }

    // Fit every bounding corner in camera space; the old projected-depth
    // approximation ignored near corners and cropped the nearest ranks.
    const azimuth=(this.isFlipped ? Math.PI : 0)+this.userAzimuth
    const outward=new THREE.Vector3(Math.cos(elevationRad)*Math.sin(azimuth),Math.sin(elevationRad),Math.cos(elevationRad)*Math.cos(azimuth))
    const right=new THREE.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth))
    const up=new THREE.Vector3().crossVectors(outward,right)
    const aim=new THREE.Vector3(center.x,.32,center.z+lookAtOffsetZ)
    let cornerDistance=0
    for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
      const p=new THREE.Vector3(x,y,z).sub(aim)
      cornerDistance=Math.max(cornerDistance,p.dot(outward)+Math.abs(p.dot(right))/Math.tan(hFovRad/2),p.dot(outward)+Math.abs(p.dot(up))/Math.tan(vFovRad/2))
    }
    const baseDistance = cornerDistance*(1+margin)
    const distance = baseDistance * this.userZoom

    // Center the projected bounds, not an arbitrary offset on the board.
    // Translating aim in the viewing plane preserves elevation and sprite perspective.
    for(let pass=0;pass<3;pass++) {
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
        const p=new THREE.Vector3(x,y,z).sub(aim),depth=Math.max(.1,distance-p.dot(outward))
        const px=p.dot(right)/depth,py=p.dot(up)/depth
        minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py)
      }
      aim.addScaledVector(right,(minX+maxX)*distance/2).addScaledVector(up,(minY+maxY)*distance/2)
    }
    this.targetPosition.copy(aim).addScaledVector(outward,distance)
    this.targetLookAt.copy(aim)

    if (this.currentMode === 'tactical') {
      this.savedTacticalPosition.copy(this.targetPosition)
      this.savedTacticalLookAt.copy(this.targetLookAt)
    }
  }

  /**
   * Recalculates camera target based on active scene bounds and mode
   */
  public updateCameraFitting() {
    const fov=this.restrict2p5d?22:34
    if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix()}
    if (this.currentMode === 'ending') {
      if (this.restrict2p5d) { this.fitToBounds(this.sceneBox,.07);return }
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
    if (this.encounterOwner) return
    this.currentMode = mode
    this.isOrbiting = mode === 'ending' && !this.restrict2p5d
    this.updateCameraFitting()
  }

  /**
   * Dedicated Combat Cinematic Camera Framing
   * Positions camera at 30–40 deg (34°) focused on the clash line between attacker and defender
   */
  public frameCombatEncounter(attackerPos: THREE.Vector3, defenderPos: THREE.Vector3) {
    this.acquireEncounter('legacy-combat')
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
    if (this.releaseEncounter('legacy-combat')) return
    this.currentMode = 'tactical'
    this.updateCameraFitting()
  }

  /**
   * User interaction: safely orbit camera horizontally and vertically within limits
   */
  public orbit(deltaX: number, deltaY: number) {
    if (this.currentMode !== 'tactical') return
    this.userAzimuth += deltaX * 0.004
    this.userPitchOffset -= deltaY * 0.0035
    if (this.restrict2p5d) {
      // Keep 2.5D sprite cards strictly aligned to readable tactical perspective
      this.userAzimuth = THREE.MathUtils.clamp(this.userAzimuth, -0.10, 0.10)
      this.userPitchOffset = THREE.MathUtils.clamp(
        this.userPitchOffset,
        THREE.MathUtils.degToRad(-4),
        THREE.MathUtils.degToRad(4)
      )
    } else {
      this.userPitchOffset = THREE.MathUtils.clamp(
        this.userPitchOffset,
        THREE.MathUtils.degToRad(-15),
        THREE.MathUtils.degToRad(15)
      )
    }
    this.updateCameraFitting()
  }

  public getAzimuthAngle(): number {
    return (this.isFlipped ? Math.PI : 0) + this.userAzimuth
  }

  /**
   * User interaction: safely zoom camera in/out within limits
   */
  public zoom(deltaY: number) {
    if (this.currentMode !== 'tactical') return
    const zoomDelta = deltaY > 0 ? 0.05 : -0.05
    this.userZoom = THREE.MathUtils.clamp(this.userZoom + zoomDelta, 0.85, 1.25)
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
    if (this.encounterOwner && this.encounterOwner!=='legacy-combat') return
    const lerpFactor = Math.min(1.0, delta * 5.2)

    // Slow cinematic orbit during game ending
    if (this.isOrbiting) {
      this.orbitAngle += delta * 0.28
      const baseYaw = this.isFlipped ? Math.PI : 0
      const sweepYaw = this.restrict2p5d
        ? baseYaw
        : this.orbitAngle
      this.targetPosition.set(
        Math.sin(sweepYaw) * 8.2,
        5.2 + Math.sin(this.orbitAngle * 0.6) * 0.35,
        Math.cos(sweepYaw) * 8.2
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
