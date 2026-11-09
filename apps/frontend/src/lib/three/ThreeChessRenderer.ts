/**
 * Master 3D Chessboard Renderer
 * Orchestrates Scene, WebGLRenderer, Lights, Shadows, Board, Pieces,
 * Two-Piece Combat Director, Debris System, Camera, and Raycasting.
 */

import * as THREE from 'three'
import type { BoardPreset } from '../../theme/themeTypes.ts'
import type { Piece3DNode, CameraViewMode, AnimationPacing } from './types.ts'
import { PhysicalBoard3D } from './boardGeometry.ts'
import { PieceBuilder3D } from './pieceBuilder.ts'
import { DebrisSystem3D } from './debris3D.ts'
import { CameraController3D } from './cameraController.ts'
import { EncounterDirector3D } from './encounterDirector.ts'
import { GameEndingDirector3D, EndingOutcome } from './gameEndingDirector.ts'

export interface ThreeRendererOptions {
  container: HTMLDivElement
  preset: BoardPreset
  side: 'white' | 'black'
  onSquareClick: (square: string) => void
  onPieceMove?: (from: string, to: string) => void
}

export class ThreeChessRenderer {
  public scene: THREE.Scene
  public renderer: THREE.WebGLRenderer
  public board: PhysicalBoard3D
  public cameraCtrl: CameraController3D
  public debris: DebrisSystem3D
  public encounterDirector: EncounterDirector3D
  public endingDirector: GameEndingDirector3D

  private pieceNodes: Map<string, Piece3DNode> = new Map() // key: square 'e4'
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private animFrameId: number | null = null
  private lastTime = performance.now()
  private isDisposed = false

  public side: 'white' | 'black' = 'white'
  public pacing: AnimationPacing = 'cinematic'
  public onSquareClick: (square: string) => void
  private options: ThreeRendererOptions

  constructor(options: ThreeRendererOptions) {
    this.options = options
    this.side = options.side
    this.onSquareClick = options.onSquareClick

    // 1. Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0c0e12) // Dark cinematic void

    // 2. Camera setup
    const rect = options.container.getBoundingClientRect()
    const aspect = rect.width / (rect.height || rect.width || 1)
    this.cameraCtrl = new CameraController3D(aspect)
    this.cameraCtrl.setOrientation(this.side)

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.setSize(rect.width, rect.height || rect.width)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.22
    options.container.appendChild(this.renderer.domElement)

    // 4. Lighting & Shadows
    this.setupLighting()

    // 5. Board & Subsystems
    this.board = new PhysicalBoard3D(options.preset)
    this.scene.add(this.board.group)

    this.debris = new DebrisSystem3D()
    this.scene.add(this.debris.group)

    this.encounterDirector = new EncounterDirector3D(this.debris, this.cameraCtrl)
    this.endingDirector = new GameEndingDirector3D(this.cameraCtrl)

    // 6. Interaction Event Listeners
    this.setupEventListeners()

    // 7. Start render loop
    this.startRenderLoop()
  }

  /**
   * Cinematic lighting setup: Key directional sun, ambient bounce, and rim light
   */
  private setupLighting() {
    // Ambient / Hemisphere fill (lifted floor bounce for dark basalt pieces)
    const hemiLight = new THREE.HemisphereLight(0xfffaed, 0x2c2620, 1.15)
    this.scene.add(hemiLight)

    // Directional Key Sun (Upper-left screen space as per Astra spec)
    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.2)
    dirLight.position.set(-6, 12, 6)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 30
    dirLight.shadow.camera.left = -6
    dirLight.shadow.camera.right = 6
    dirLight.shadow.camera.top = 6
    dirLight.shadow.camera.bottom = -6
    dirLight.shadow.bias = -0.0005
    dirLight.shadow.radius = 2.5
    dirLight.shadow.blurSamples = 16
    this.scene.add(dirLight)

    // Neutral frontal fill to lift dark basalt shadows and reveal armor plate engravings
    const frontalFill = new THREE.DirectionalLight(0xffffff, 0.85)
    frontalFill.position.set(0, 8, 10)
    this.scene.add(frontalFill)

    // Warm Rim light for piece silhouette definition
    const rimLight = new THREE.DirectionalLight(0xb68a3e, 0.8)
    rimLight.position.set(6, 4, -8)
    this.scene.add(rimLight)
  }

  /**
   * Synchronizes 3D piece nodes with authoritative chess FEN
   */
  public setFen(fen: string) {
    if (this.encounterDirector.isActive) return // Let combat finish first

    const positionPart = fen.split(' ')[0]
    const rows = positionPart.split('/')
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const newOccupancy = new Map<string, string>()

    for (let r = 0; r < 8; r++) {
      const row = rows[r]
      const rank = 8 - r
      let f = 0
      for (const char of row) {
        if (/\d/.test(char)) {
          f += parseInt(char, 10)
        } else {
          const color = char === char.toUpperCase() ? 'w' : 'b'
          const code = `${color}${char.toUpperCase()}`
          const square = `${files[f]}${rank}`
          newOccupancy.set(square, code)
          f++
        }
      }
    }

    // Remove pieces no longer on board
    this.pieceNodes.forEach((node, sq) => {
      if (!newOccupancy.has(sq) || newOccupancy.get(sq) !== node.pieceCode) {
        this.scene.remove(node.group)
        this.pieceNodes.delete(sq)
      }
    })

    // Spawn / update pieces
    newOccupancy.forEach((code, sq) => {
      let node = this.pieceNodes.get(sq)
      if (!node || node.pieceCode !== code) {
        if (node) {
          this.scene.remove(node.group)
        }
        node = PieceBuilder3D.createPieceNode(code, sq)
        const pos = this.board.squareToWorld(sq)
        node.group.position.copy(pos)
        node.currentPosition.copy(pos)
        this.scene.add(node.group)
        this.pieceNodes.set(sq, node)
      }
    })
  }

  /**
   * Clears all piece nodes to allow rebuild with cached GLB models
   */
  public clearPieces() {
    this.pieceNodes.forEach((node) => {
      this.scene.remove(node.group)
    })
    this.pieceNodes.clear()
  }

  /**
   * Executes two-piece capture combat
   */
  public triggerCapture(
    from: string,
    to: string,
    attackerCode: string,
    defenderCode: string,
    onContact?: () => void,
    onComplete?: () => void
  ) {
    let attacker = this.pieceNodes.get(from)
    const defender = this.pieceNodes.get(to)

    if (!attacker) {
      attacker = PieceBuilder3D.createPieceNode(attackerCode, from)
      attacker.group.position.copy(this.board.squareToWorld(from))
      this.scene.add(attacker.group)
      this.pieceNodes.set(from, attacker)
    }

    if (!defender) {
      // If defender mesh is missing, normal translation
      this.triggerMove(from, to, attackerCode, onComplete)
      return
    }

    // Re-index pieceNodes: attacker will occupy 'to'
    this.pieceNodes.delete(from)
    this.pieceNodes.set(to, attacker)
    attacker.square = to

    this.encounterDirector.startCapture(attacker, defender, {
      attackerCode,
      attackerSquare: from,
      defenderCode,
      defenderSquare: to,
      pacing: this.pacing,
      onContact,
      onComplete: () => {
        onComplete?.()
      },
    })
  }

  /**
   * Executes normal piece movement without capture
   */
  public triggerMove(
    from: string,
    to: string,
    pieceCode: string,
    onComplete?: () => void
  ) {
    let piece = this.pieceNodes.get(from)
    if (!piece) {
      piece = PieceBuilder3D.createPieceNode(pieceCode, from)
      piece.group.position.copy(this.board.squareToWorld(from))
      this.scene.add(piece.group)
    }

    this.pieceNodes.delete(from)
    this.pieceNodes.set(to, piece)
    piece.square = to

    const targetPos = this.board.squareToWorld(to)
    const startPos = piece.group.position.clone()

    if (this.pacing === 'off' || this.pacing === 'reduced') {
      piece.group.position.copy(targetPos)
      onComplete?.()
      return
    }

    const duration = this.pacing === 'cinematic' ? 380 : 220
    const startTime = performance.now()

    const step = () => {
      const now = performance.now()
      const t = Math.min(1.0, (now - startTime) / duration)
      const ease = 0.5 - Math.cos(t * Math.PI) / 2

      piece!.group.position.lerpVectors(startPos, targetPos, ease)

      // Slight hop arch
      piece!.group.position.y = 0.06 + Math.sin(t * Math.PI) * 0.18

      if (t < 1.0) {
        requestAnimationFrame(step)
      } else {
        piece!.group.position.copy(targetPos)
        onComplete?.()
      }
    }
    requestAnimationFrame(step)
  }

  /**
   * Triggers game-ending presentation
   */
  public triggerGameEnding(outcome: EndingOutcome) {
    this.endingDirector.triggerEnding(outcome, this.pieceNodes)
  }

  public resetGame() {
    this.endingDirector.reset(this.pieceNodes)
    this.debris.clear()
    this.board.setSelectedSquare(null)
    this.board.setInCheckSquare(null)
    this.board.clearLegalMoves()
  }

  /**
   * Event handlers for 3D mouse/touch interaction
   */
  private setupEventListeners() {
    const dom = this.renderer.domElement

    const handleClick = (e: MouseEvent | TouchEvent) => {
      const rect = dom.getBoundingClientRect()
      let clientX = 0
      let clientY = 0

      if (e instanceof MouseEvent) {
        clientX = e.clientX
        clientY = e.clientY
      } else if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      }

      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

      this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera)
      const intersects = this.raycaster.intersectObjects(this.scene.children, true)

      for (const hit of intersects) {
        // Check tile userData
        let obj: THREE.Object3D | null = hit.object
        while (obj) {
          if (obj.userData?.square) {
            this.onSquareClick(obj.userData.square)
            return
          }
          obj = obj.parent
        }

        // Check world position on board plane
        const sq = this.board.worldToSquare(hit.point)
        if (sq) {
          this.onSquareClick(sq)
          return
        }
      }
    }

    dom.addEventListener('click', handleClick)
    dom.addEventListener('touchend', handleClick)
  }

  /**
   * Main rAF animation loop
   */
  private startRenderLoop() {
    const loop = (now: number) => {
      if (this.isDisposed) return

      const delta = Math.min(0.1, (now - this.lastTime) / 1000)
      this.lastTime = now

      // Update Camera transitions
      this.cameraCtrl.update(delta)

      // Update Two-Piece Encounter
      this.encounterDirector.update(now)

      // Update Game Ending
      this.endingDirector.update(now)

      // Update Debris ballistics
      this.debris.update(delta, now)

      // Render Scene
      this.renderer.render(this.scene, this.cameraCtrl.camera)

      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  public resize(width: number, height: number) {
    this.renderer.setSize(width, height)
    this.cameraCtrl.updateAspect(width / height)
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraCtrl.setMode(mode)
  }

  public setOrientation(side: 'white' | 'black') {
    this.side = side
    this.cameraCtrl.setOrientation(side)
  }

  public setPacing(pacing: AnimationPacing) {
    this.pacing = pacing
  }

  public dispose() {
    this.isDisposed = true
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
    }
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }
}
