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

interface ActiveMoveAnim {
  piece: Piece3DNode
  startPos: THREE.Vector3
  targetPos: THREE.Vector3
  startTime: number
  duration: number
  isKnight: boolean
  onComplete?: () => void
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
  private activeMoves: ActiveMoveAnim[] = []
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private animFrameId: number | null = null
  private lastTime = performance.now()
  private isDisposed = false
  private cleanupListeners: (() => void) | null = null

  public side: 'white' | 'black' = 'white'
  public pacing: AnimationPacing = 'cinematic'
  public onSquareClick: (square: string) => void
  private options: ThreeRendererOptions
  private currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

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
    const hemiLight = new THREE.HemisphereLight(0xfffaed, 0x302a24, 1.25)
    this.scene.add(hemiLight)

    // Directional Key Sun (Upper-left screen space as per Astra spec)
    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.3)
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
    dirLight.shadow.bias = -0.0004
    dirLight.shadow.radius = 2.0
    dirLight.shadow.blurSamples = 16
    this.scene.add(dirLight)

    // Neutral frontal fill to lift dark basalt shadows and reveal armor plate engravings
    const frontalFill = new THREE.DirectionalLight(0xffffff, 1.10)
    frontalFill.position.set(0, 9, 10)
    this.scene.add(frontalFill)

    // Warm Rim light for piece silhouette definition & specular sheen
    const rimLight = new THREE.DirectionalLight(0xd4af37, 1.05)
    rimLight.position.set(6, 5, -8)
    this.scene.add(rimLight)
  }

  /**
   * Aligns 2.5D card orientation & directional atlas facing to the active board side.
   * White pieces face up-board ('back' from White view, 'front' from Black view);
   * Black pieces face down-board ('front' from White view, 'back' from Black view).
   */
  private applyPieceOrientation(node: Piece3DNode) {
    const is2p5d = !!node.cardMesh || node.group.name.includes('2p5D')
    if (!is2p5d) {
      node.group.rotation.y = node.pieceCode.startsWith('b') ? Math.PI : 0
      return
    }
    node.group.rotation.y = this.cameraCtrl.isFlipped ? Math.PI : 0
    const isWhitePiece = node.pieceCode.startsWith('w')
    const facing: 'front' | 'back' =
      this.side === 'white'
        ? (isWhitePiece ? 'back' : 'front')
        : (isWhitePiece ? 'front' : 'back')
    node.animator?.setFacing?.(facing)
  }

  private updateAllPieceOrientations() {
    this.pieceNodes.forEach((node) => {
      if (!node.isAnimating) {
        this.applyPieceOrientation(node)
      }
    })
  }

  /**
   * Synchronizes 3D piece nodes with authoritative chess FEN
   */
  public setFen(fen: string) {
    this.currentFen = fen
    if (this.encounterDirector.isActive || this.activeMoves.length > 0) return // Sync after active animation completes

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
        PieceBuilder3D.disposeNodeResources(node)
        this.pieceNodes.delete(sq)
      }
    })

    // Spawn / update pieces
    newOccupancy.forEach((code, sq) => {
      let node = this.pieceNodes.get(sq)
      if (!node || node.pieceCode !== code) {
        if (node) {
          this.scene.remove(node.group)
          PieceBuilder3D.disposeNodeResources(node)
        }
        node = PieceBuilder3D.createPieceNode(code, sq)
        const pos = this.board.squareToWorld(sq)
        node.group.position.copy(pos)
        node.currentPosition.copy(pos)
        this.applyPieceOrientation(node)
        this.scene.add(node.group)
        this.pieceNodes.set(sq, node)
      }
    })
  }

  /**
   * Clears all piece nodes to allow rebuild with cached GLB models
   */
  public clearPieces() {
    this.cancelActiveAnimations()
    this.pieceNodes.forEach((node) => {
      this.scene.remove(node.group)
      PieceBuilder3D.disposeNodeResources(node)
    })
    this.pieceNodes.clear()
  }

  public cancelActiveAnimations() {
    for (const anim of this.activeMoves) {
      anim.piece.group.position.copy(anim.targetPos)
      anim.piece.isAnimating = false
      anim.piece.animator?.playClip('idle', true)
    }
    this.activeMoves = []
    if (this.encounterDirector.isActive) {
      this.encounterDirector.cancel()
    }
  }

  /**
   * Executes two-piece capture combat (handles normal captures, en passant, and promotion captures)
   */
  public triggerCapture(
    from: string,
    to: string,
    attackerCode: string,
    defenderCode: string,
    onContact?: () => void,
    onComplete?: () => void,
    options?: { isEnPassant?: boolean; capturedSquare?: string; onAnticipation?: () => void; onDefeat?: () => void }
  ) {
    // Settle any previous in-flight animations before starting the next move
    if (this.activeMoves.length > 0 || this.encounterDirector.isActive) {
      this.cancelActiveAnimations()
    }

    const victimSq = options?.isEnPassant && options?.capturedSquare ? options.capturedSquare : to
    let attacker = this.pieceNodes.get(from)
    const defender = this.pieceNodes.get(victimSq)

    if (!attacker) {
      attacker = PieceBuilder3D.createPieceNode(attackerCode, from)
      attacker.group.position.copy(this.board.squareToWorld(from))
      this.applyPieceOrientation(attacker)
      this.scene.add(attacker.group)
      this.pieceNodes.set(from, attacker)
    }

    if (!defender) {
      this.triggerMove(from, to, attackerCode, onComplete)
      return
    }

    // Re-index pieceNodes: remove defender square, attacker will occupy 'to'
    this.pieceNodes.delete(from)
    if (victimSq !== to) {
      this.pieceNodes.delete(victimSq)
    }
    this.pieceNodes.set(to, attacker)
    attacker.square = to
    attacker.targetPosition.copy(this.board.squareToWorld(to))

    this.encounterDirector.startCapture(attacker, defender, {
      attackerCode,
      attackerSquare: from,
      defenderCode,
      defenderSquare: victimSq,
      isEnPassant: options?.isEnPassant,
      capturedSquare: victimSq,
      pacing: this.pacing,
      onAnticipation: options?.onAnticipation,
      onContact,
      onDefeat: options?.onDefeat,
      onComplete: () => {
        if (defender.group.parent) {
          this.scene.remove(defender.group)
          PieceBuilder3D.disposeNodeResources(defender)
        }
        // Sync authoritative FEN (handles promotion captures cleanly)
        this.setFen(this.currentFen)
        onComplete?.()
      },
    })
  }

  /**
   * Executes normal piece movement without capture (handles castling rook slide & promotions)
   */
  public triggerMove(
    from: string,
    to: string,
    pieceCode: string,
    onComplete?: () => void,
    meta?: { isCastling?: boolean }
  ) {
    // Finish any prior move animation so rapid moves never race
    if (this.activeMoves.length > 0) {
      for (const prev of this.activeMoves) {
        prev.piece.group.position.copy(prev.targetPos)
        prev.piece.isAnimating = false
        prev.piece.animator?.playClip('idle', true)
      }
      this.activeMoves = []
    }

    let piece = this.pieceNodes.get(from)
    if (!piece) {
      piece = PieceBuilder3D.createPieceNode(pieceCode, from)
      piece.group.position.copy(this.board.squareToWorld(from))
      this.applyPieceOrientation(piece)
      this.scene.add(piece.group)
    }

    this.pieceNodes.delete(from)
    this.pieceNodes.set(to, piece)
    piece.square = to

    const targetPos = this.board.squareToWorld(to)
    const startPos = piece.group.position.clone()

    // Check castling rook accompaniment
    const classChar = pieceCode.slice(1).toUpperCase()
    const isKingCastle =
      classChar === 'K' &&
      (meta?.isCastling || Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2)
    let rookMove: { from: string; to: string } | null = null
    if (isKingCastle) {
      const rank = from[1]
      if (to[0] === 'g') rookMove = { from: `h${rank}`, to: `f${rank}` }
      else if (to[0] === 'c') rookMove = { from: `a${rank}`, to: `d${rank}` }
    }

    if (this.pacing === 'off') {
      piece.group.position.copy(targetPos)
      if (rookMove) {
        const rook = this.pieceNodes.get(rookMove.from)
        if (rook) {
          this.pieceNodes.delete(rookMove.from)
          this.pieceNodes.set(rookMove.to, rook)
          rook.square = rookMove.to
          rook.group.position.copy(this.board.squareToWorld(rookMove.to))
        }
      }
      this.setFen(this.currentFen)
      onComplete?.()
      return
    }

    const isKnight = classChar === 'N'
    piece.isAnimating = true
    piece.animator?.playClip('move', true)

    const duration =
      this.pacing === 'reduced'
        ? 160
        : this.pacing === 'cinematic'
        ? (isKnight ? 640 : 520)
        : (isKnight ? 380 : 280)
    const now = performance.now()

    this.activeMoves.push({
      piece,
      startPos,
      targetPos,
      startTime: now,
      duration,
      isKnight,
      onComplete: () => {
        this.setFen(this.currentFen)
        onComplete?.()
      },
    })

    if (rookMove) {
      const rook = this.pieceNodes.get(rookMove.from)
      if (rook) {
        this.pieceNodes.delete(rookMove.from)
        this.pieceNodes.set(rookMove.to, rook)
        rook.square = rookMove.to
        rook.isAnimating = true
        rook.animator?.playClip('move', true)
        this.activeMoves.push({
          piece: rook,
          startPos: rook.group.position.clone(),
          targetPos: this.board.squareToWorld(rookMove.to),
          startTime: now,
          duration,
          isKnight: false,
        })
      }
    }
  }

  /**
   * Triggers game-ending presentation
   */
  public triggerGameEnding(outcome: EndingOutcome) {
    this.endingDirector.triggerEnding(outcome, this.pieceNodes)
  }

  public skipEnding() {
    this.endingDirector.skip(this.pieceNodes)
  }

  public resetGame() {
    this.cancelActiveAnimations()
    this.endingDirector.reset(this.pieceNodes)
    this.debris.clear()
    this.board.setSelectedSquare(null)
    this.board.setInCheckSquare(null)
    this.board.clearLegalMoves()
    this.updateAllPieceOrientations()
  }

  /**
   * Event handlers for 3D mouse/touch interaction & safe camera orbit/zoom
   */
  private setupEventListeners() {
    const dom = this.renderer.domElement

    let isPointerDown = false
    let startX = 0
    let startY = 0
    let hasDragged = false

    const handleClick = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect()
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

      this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera)
      // Raycast strictly against the 64 board square tiles so tall piece cards never block squares behind them
      const tiles = Array.from(this.board.tileMeshes.values())
      const intersects = this.raycaster.intersectObjects(tiles, false)

      for (const hit of intersects) {
        if (hit.object.userData?.square) {
          this.onSquareClick(hit.object.userData.square)
          return
        }
        const sq = this.board.worldToSquare(hit.point)
        if (sq) {
          this.onSquareClick(sq)
          return
        }
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true
      startX = e.clientX
      startY = e.clientY
      hasDragged = false
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.hypot(dx, dy) > 5) {
        hasDragged = true
        this.cameraCtrl.orbit(dx * 0.4, dy * 0.4)
        startX = e.clientX
        startY = e.clientY
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (isPointerDown && !hasDragged) {
        handleClick(e.clientX, e.clientY)
      }
      isPointerDown = false
      hasDragged = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      this.cameraCtrl.zoom(e.deltaY)
    }

    const onDblClick = () => {
      this.cameraCtrl.resetView()
    }

    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('dblclick', onDblClick)

    this.cleanupListeners = () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('dblclick', onDblClick)
    }
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

      // Update active frame-rate independent move traversals
      if (this.activeMoves.length > 0) {
        const finished: ActiveMoveAnim[] = []
        for (let i = this.activeMoves.length - 1; i >= 0; i--) {
          const anim = this.activeMoves[i]
          const t = Math.min(1.0, (now - anim.startTime) / anim.duration)
          const ease = 0.5 - Math.cos(t * Math.PI) / 2

          anim.piece.group.position.x = THREE.MathUtils.lerp(anim.startPos.x, anim.targetPos.x, ease)
          anim.piece.group.position.z = THREE.MathUtils.lerp(anim.startPos.z, anim.targetPos.z, ease)

          if (anim.isKnight) {
            anim.piece.group.position.y = anim.startPos.y + Math.sin(t * Math.PI) * 0.44
          } else {
            anim.piece.group.position.y = anim.startPos.y + Math.abs(Math.sin(t * Math.PI * 4)) * 0.025
          }

          if (t >= 1.0) {
            anim.piece.group.position.copy(anim.targetPos)
            anim.piece.isAnimating = false
            anim.piece.animator?.playClip('idle', true)
            this.activeMoves.splice(i, 1)
            finished.push(anim)
          }
        }
        for (const anim of finished) {
          anim.onComplete?.()
        }
      }

      // Update 2.5D character piece animators (walking, breathing, combat)
      for (const piece of this.pieceNodes.values()) {
        piece.animator?.update(delta)
      }

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

  public setBoardPreset(preset: BoardPreset) {
    this.board.setPreset(preset)
  }

  public resize(width: number, height: number) {
    this.renderer.setSize(width, height)
    this.cameraCtrl.updateAspect(width / height)
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraCtrl.setMode(mode)
  }

  public resetView() {
    this.cameraCtrl.resetView()
  }

  public async setAssetManifest(manifestId: string) {
    this.cameraCtrl.restrict2p5d = manifestId === '2p5d-stylized'
    PieceBuilder3D.setManifest(manifestId)
    await PieceBuilder3D.preloadArmyModels(manifestId)
    this.clearPieces()
    this.setFen(this.currentFen)
  }

  public getAssetManifest() {
    return PieceBuilder3D.getManifest()
  }

  public setOrientation(side: 'white' | 'black') {
    this.side = side
    this.cameraCtrl.setOrientation(side)
    this.updateAllPieceOrientations()
  }

  public setPacing(pacing: AnimationPacing) {
    this.pacing = pacing
  }

  public dispose() {
    this.isDisposed = true
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
    }
    this.cleanupListeners?.()
    this.clearPieces()
    this.debris.clear()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }
}
