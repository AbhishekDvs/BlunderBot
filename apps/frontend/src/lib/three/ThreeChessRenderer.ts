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
import { IndianArmiesRuntime } from './indianArmiesRuntime.ts'
import { DebrisSystem3D } from './debris3D.ts'
import { CameraController3D } from './cameraController.ts'
import { EncounterDirector3D } from './encounterDirector.ts'
import { GameEndingDirector3D, EndingOutcome } from './gameEndingDirector.ts'
import { VisualEventQueue, type VisualMoveEvent, type VisualPosition } from './visualEventQueue.ts'
import { SpriteEncounterStage } from './spriteEncounterStage.ts'
import type { AstraMoveMeta } from '../../theme/themeTypes.ts'

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
  public readonly presentation = new VisualEventQueue()
  private nodesById = new Map<string,Piece3DNode>()
  private presentedFen = this.currentFen
  private eventCallbacks = new Map<string,{contact?:()=>void;complete?:()=>void;anticipation?:()=>void;defeat?:()=>void}>()
  private pendingEnding: {outcome:EndingOutcome;complete?:()=>void} | null = null
  private endingComplete?:()=>void
  private manifestRevision=0
  private assetLoading=false
  private pendingSide: 'white'|'black'|null=null
  public onPresentationChange?: (active:boolean)=>void

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
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate=false
    this.renderer.shadowMap.needsUpdate=true
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
    this.encounterDirector.spriteStage = new SpriteEncounterStage(options.container,this.cameraCtrl)
    this.encounterDirector.onPhase=(phase) => {
      const active=this.presentation.active
      if (active) this.presentation.transition(active.event.id,phase)
    }
    this.endingDirector = new GameEndingDirector3D(this.cameraCtrl)
    this.presentation.reset(this.currentFen)
    this.applyPendingOrientation()

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
    node.group.rotation.y = 0
    PieceBuilder3D.orientSprite(node,this.cameraCtrl.camera)
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
    if (this.presentation.busy && this.presentation.recognizes(fen)) { this.currentFen=this.presentation.tailFen;return }
    this.currentFen = fen
    if (fen === this.presentedFen && !this.presentation.busy && this.pieceNodes.size) return
    this.invalidatePresentation()
    this.presentation.reset(fen)
    this.reconcile(fen,this.presentation.tail)
  }

  private reconcile(fen: string,position: VisualPosition) {
    this.presentedFen=fen
    const retained=new Set(Object.values(position).map(unit=>unit.id))
    for (const [id,node] of this.nodesById) {
      if (!retained.has(id) || !Object.values(position).some(unit=>unit.id===id && unit.code===node.pieceCode)) {
        this.scene.remove(node.group);PieceBuilder3D.disposeNodeResources(node);this.nodesById.delete(id)
      }
    }
    this.pieceNodes.clear()
    for (const [square,unit] of Object.entries(position)) {
      let node=this.nodesById.get(unit.id)
      if (!node) {
        node=PieceBuilder3D.createPieceNode(unit.code,square)
        node.instanceId=unit.id;node.group.userData.visualInstanceId=unit.id
        this.nodesById.set(unit.id,node);this.scene.add(node.group)
      }
      node.square=square;node.group.visible=true;node.isAnimating=false
      delete node.group.userData.locomotionFrame
      node.group.position.copy(this.board.squareToWorld(square));node.currentPosition.copy(node.group.position);node.targetPosition.copy(node.group.position)
      this.applyPieceOrientation(node)
      this.pieceNodes.set(square,node)
    }
  }

  private invalidatePresentation() {
    this.encounterDirector.abort();this.activeMoves=[];this.eventCallbacks.clear();this.pendingEnding=null;this.endingComplete=undefined
    this.endingDirector.reset(this.pieceNodes);this.debris.clear()
    this.presentation.reset(this.currentFen)
    this.applyPendingOrientation()
    this.onPresentationChange?.(false)
  }

  private enqueueVisual(from:string,to:string,pieceCode:string,meta:AstraMoveMeta|undefined,callbacks:{contact?:()=>void;complete?:()=>void;anticipation?:()=>void;defeat?:()=>void}) {
    const event=this.presentation.enqueue({from,to,pieceCode,...meta,pacing:this.pacing})
    if (!event) return
    this.currentFen=event.afterFen
    this.eventCallbacks.set(event.id,callbacks)
    this.onPresentationChange?.(true)
    this.startNextVisual()
  }

  private startNextVisual() {
    if (this.isDisposed || this.assetLoading || this.endingDirector.isActive || this.presentation.active) return
    const event=this.presentation.begin()
    if (!event) {
      this.applyPendingOrientation()
      if (this.pendingEnding) {
        const ending=this.pendingEnding;this.pendingEnding=null
        this.endingComplete=ending.complete
        this.endingDirector.triggerEnding(ending.outcome,this.pieceNodes)
      } else this.onPresentationChange?.(false)
      return
    }
    this.reconcile(event.beforeFen,event.before)
    this.board.setLastMove({from:event.from,to:event.to})
    const callbacks=this.eventCallbacks.get(event.id)
    const valid=()=>this.presentation.active?.event.id===event.id && event.generation===this.presentation.generation
    const guarded=(cb?:()=>void)=>()=>{if(valid())cb?.()}
    if (event.defender) {
      const attacker=this.nodesById.get(event.attacker.id)!
      attacker.group.userData.encounterId=event.id
      this.playCapture(event.from,event.to,event.attacker.code,event.defender.code,guarded(callbacks?.contact),()=>this.completeVisual(event),{
        isEnPassant:event.capturedSquare!==event.to,capturedSquare:event.capturedSquare,
        onAnticipation:guarded(callbacks?.anticipation),onDefeat:guarded(callbacks?.defeat),
      })
    } else {
      this.presentation.transition(event.id,'APPROACHING')
      this.playMove(event.from,event.to,event.attacker.code,()=>this.completeVisual(event),{isCastling:!!event.rookMove})
    }
  }

  private completeVisual(event:VisualMoveEvent,skipped=false) {
    if (this.presentation.active?.event.id!==event.id || event.generation!==this.presentation.generation) return
    const callback=this.eventCallbacks.get(event.id)?.complete
    this.eventCallbacks.delete(event.id)
    this.reconcile(event.afterFen,event.after)
    this.presentation.complete(event.id,skipped)
    this.debris.clear()
    callback?.()
    this.startNextVisual()
  }

  public getPresentationSnapshot() {
    const describe=(record:NonNullable<VisualEventQueue['active']>)=>({id:record.event.id,attacker:record.event.attacker,defender:record.event.defender,from:record.event.from,to:record.event.to,phase:record.phase,transitions:[...record.transitions],skipped:record.skipped})
    return {authoritativeFen:this.currentFen,presentedFen:this.presentedFen,generation:this.presentation.generation,
      active:this.presentation.active?describe(this.presentation.active):null,queued:this.presentation.pending.map(describe),history:this.presentation.history.map(describe),
      units:[...this.pieceNodes].map(([square,node])=>({square,code:node.pieceCode,id:node.instanceId,visible:node.group.visible})),
      stage:this.encounterDirector.spriteStage?.getSnapshot(),camera:this.cameraCtrl.getSnapshot(),ending:this.endingDirector.isActive}
  }

  /**
   * Clears all piece nodes to allow rebuild with cached GLB models
   */
  public clearPieces() {
    this.invalidatePresentation()
    this.nodesById.forEach((node) => {
      this.scene.remove(node.group)
      PieceBuilder3D.disposeNodeResources(node)
    })
    this.pieceNodes.clear()
    this.nodesById.clear()
  }

  public cancelActiveAnimations() {
    const active=this.presentation.active?.event
    if (active) {
      this.activeMoves=[];this.encounterDirector.abort();this.completeVisual(active,true)
      return
    }
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
  public triggerCapture(from:string,to:string,attackerCode:string,defenderCode:string,onContact?:()=>void,onComplete?:()=>void,options?:AstraMoveMeta & {isEnPassant?:boolean;capturedSquare?:string;onAnticipation?:()=>void;onDefeat?:()=>void}) {
    void defenderCode
    this.enqueueVisual(from,to,attackerCode,options,{contact:onContact,complete:onComplete,anticipation:options?.onAnticipation,defeat:options?.onDefeat})
  }

  public triggerMove(from:string,to:string,pieceCode:string,onComplete?:()=>void,meta?:AstraMoveMeta) {
    this.enqueueVisual(from,to,pieceCode,meta,{complete:onComplete})
  }

  private playCapture(
    from: string,
    to: string,
    attackerCode: string,
    defenderCode: string,
    onContact?: () => void,
    onComplete?: () => void,
    options?: { isEnPassant?: boolean; capturedSquare?: string; onAnticipation?: () => void; onDefeat?: () => void }
  ) {
    // Settle any previous in-flight animations before starting the next move
    if (this.activeMoves.length > 0 || this.encounterDirector.isActive) throw new Error('Visual ownership overlap')

    const victimSq = options?.isEnPassant && options?.capturedSquare ? options.capturedSquare : to
    const attacker = this.pieceNodes.get(from)
    const defender = this.pieceNodes.get(victimSq)

    if (!attacker) {
      throw new Error('Queued capture lost its attacker instance')
    }

    if (!defender) {
      throw new Error('Queued capture lost its defender instance')
    }

    // Re-index pieceNodes: remove defender square, attacker will occupy 'to'
    attacker.targetPosition.copy(this.board.squareToWorld(to))

    this.encounterDirector.startCapture(attacker, defender, {
      attackerCode,
      attackerSquare: from,
      defenderCode,
      defenderSquare: victimSq,
      destinationSquare: to,
      isEnPassant: options?.isEnPassant,
      capturedSquare: victimSq,
      pacing: this.presentation.active?.event.animation.pacing ?? this.pacing,
      onAnticipation: options?.onAnticipation,
      onContact,
      onDefeat: options?.onDefeat,
      onComplete: () => {
        onComplete?.()
      },
    })
  }

  /**
   * Executes normal piece movement without capture (handles castling rook slide & promotions)
   */
  private playMove(
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

    const piece = this.pieceNodes.get(from)
    if (!piece) {
      throw new Error('Queued move lost its visual instance')
    }

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

    const pacing=this.presentation.active?.event.animation.pacing ?? this.pacing
    if (pacing === 'off') {
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

    const moveDist = startPos.distanceTo(targetPos)
    const is2p5d = !!piece.cardMesh || piece.group.name.includes('2p5D')
    const duration = is2p5d
      ? IndianArmiesRuntime.resolveMoveDurationMs(pieceCode, moveDist, pacing)
      : this.pacing === 'reduced'
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
  public triggerGameEnding(outcome: EndingOutcome,onComplete?:()=>void) {
    if (this.pendingEnding || this.endingDirector.isActive) return
    this.pendingEnding={outcome,complete:onComplete}
    this.onPresentationChange?.(true)
    if (!this.presentation.busy) this.startNextVisual()
  }

  public skipEnding() {
    this.endingDirector.skip(this.pieceNodes)
    const callback=this.endingComplete;this.endingComplete=undefined
    callback?.();this.onPresentationChange?.(false)
  }

  public resetGame() {
    this.invalidatePresentation()
    this.currentFen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    this.presentation.reset(this.currentFen)
    this.reconcile(this.currentFen,this.presentation.tail)
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
          const isSprite=!!anim.piece.cardMesh
          const ease = isSprite ? t : 0.5 - Math.cos(t * Math.PI) / 2

          anim.piece.group.position.x = THREE.MathUtils.lerp(anim.startPos.x, anim.targetPos.x, ease)
          anim.piece.group.position.z = THREE.MathUtils.lerp(anim.startPos.z, anim.targetPos.z, ease)
          if (isSprite) {
            const moved=anim.startPos.distanceTo(anim.piece.group.position)
            const clip=IndianArmiesRuntime.resolveClip(anim.piece.pieceCode,'move')
            anim.piece.group.userData.locomotionFrame=Math.floor(moved/IndianArmiesRuntime.getMoveStrideWorld(anim.piece.pieceCode)*clip.count)%clip.count
          }

          if (isSprite) anim.piece.group.position.y=anim.startPos.y
          else if (anim.isKnight) {
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
        if (piece.isAnimating && typeof piece.group.userData.locomotionFrame==='number') piece.animator?.setFrame(piece.group.userData.locomotionFrame)
        if (piece.cardMesh) PieceBuilder3D.orientSprite(piece,this.cameraCtrl.camera)
      }

      // Update Two-Piece Encounter
      this.encounterDirector.update(now)

      // Update Game Ending
      const endingWasActive=this.endingDirector.isActive
      this.endingDirector.update(now)
      if (endingWasActive && !this.endingDirector.isActive) {
        const callback=this.endingComplete;this.endingComplete=undefined
        callback?.();this.onPresentationChange?.(false)
        this.applyPendingOrientation()
      }

      // Update Debris ballistics
      this.debris.update(delta, now)

      // Render Scene
      if (!this.encounterDirector.spriteStage?.isActive) this.renderer.render(this.scene, this.cameraCtrl.camera)

      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  public setBoardPreset(preset: BoardPreset) {
    this.board.setPreset(preset)
    this.renderer.shadowMap.needsUpdate=true
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
    const revision=++this.manifestRevision
    this.assetLoading=true
    this.invalidatePresentation()
    this.reconcile(this.currentFen,this.presentation.tail)
    this.cameraCtrl.restrict2p5d = manifestId === '2p5d-stylized'
    this.renderer.shadowMap.autoUpdate=manifestId!=='2p5d-stylized'
    this.renderer.shadowMap.needsUpdate=true
    PieceBuilder3D.setManifest(manifestId)
    try { await PieceBuilder3D.preloadArmyModels(manifestId) }
    finally { if(revision===this.manifestRevision)this.assetLoading=false }
    if (revision!==this.manifestRevision || this.isDisposed) return
    this.clearPieces()
    this.setFen(this.currentFen)
  }

  public getAssetManifest() {
    return PieceBuilder3D.getManifest()
  }

  public setOrientation(side: 'white' | 'black') {
    if(this.presentation.busy || this.endingDirector.isActive){this.pendingSide=side;return}
    this.side = side
    this.cameraCtrl.setOrientation(side)
    this.updateAllPieceOrientations()
  }

  private applyPendingOrientation() {
    if(this.pendingSide && !this.presentation.busy && !this.endingDirector.isActive){const side=this.pendingSide;this.pendingSide=null;this.setOrientation(side)}
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
    this.encounterDirector.spriteStage?.dispose()
    this.debris.clear()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }
}
