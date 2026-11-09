/**
 * 3D Physical Chessboard Geometry & Square Overlays
 * Realistic physical slab, bevel borders, inlaid square tiles, coordinate engravings,
 * and illuminated 3D move/check indicators.
 */

import * as THREE from 'three'
import type { BoardPreset } from '../../theme/themeTypes.ts'

export class PhysicalBoard3D {
  public group: THREE.Group
  public tileMeshes: Map<string, THREE.Mesh> = new Map()
  public moveIndicators: Map<string, THREE.Group> = new Map()
  public lastMoveHighlights: THREE.Mesh[] = []
  public selectedHighlight: THREE.Mesh
  public checkAuraMesh: THREE.Mesh
  public boardSize = 8.0 // 8 units across 8 squares, 1 unit per square
  public squareSize = 1.0
  private preset: BoardPreset

  constructor(preset: BoardPreset) {
    this.preset = preset
    this.group = new THREE.Group()
    this.group.name = 'PhysicalBoard3D'

    this.buildOuterFrame()
    this.buildSquareTiles()
    this.buildCoordinateLabels()

    // Highlights & Indicators
    this.selectedHighlight = this.createHighlightMesh(0xffcc00, 0.45)
    this.selectedHighlight.visible = false
    this.group.add(this.selectedHighlight)

    this.checkAuraMesh = this.createHighlightMesh(0xef4444, 0.6)
    this.checkAuraMesh.visible = false
    this.group.add(this.checkAuraMesh)

    this.createIndicatorPool()
  }

  /**
   * Builds the outer physical frame and bevel border with material depth
   */
  private buildOuterFrame() {
    const frameSize = 9.4
    const frameHeight = 0.35

    // Outer slab
    const frameGeo = new THREE.BoxGeometry(frameSize, frameHeight, frameSize)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1b140e, // Deep dark walnut / basalt
      roughness: 0.65,
      metalness: 0.15,
    })
    const frameMesh = new THREE.Mesh(frameGeo, frameMat)
    frameMesh.position.y = -frameHeight / 2
    frameMesh.receiveShadow = true
    this.group.add(frameMesh)

    // Inner bevel lip (brushed bronze / brass inlay)
    const innerLipSize = 8.3
    const lipHeight = 0.04
    const lipGeo = new THREE.BoxGeometry(innerLipSize, lipHeight, innerLipSize)
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0x82613d, // Aged bronze / gold trim
      roughness: 0.35,
      metalness: 0.85,
    })
    const lipMesh = new THREE.Mesh(lipGeo, lipMat)
    lipMesh.position.y = 0.01
    lipMesh.receiveShadow = true
    this.group.add(lipMesh)
  }

  /**
   * Builds 64 separate physical square tiles with bevels and individual materials
   */
  private buildSquareTiles() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const tileHeight = 0.05
    const tileWidth = 0.98 // slight bevel gap

    const lightColor = new THREE.Color(this.preset.lightSquare)
    const darkColor = new THREE.Color(this.preset.darkSquare)

    const lightMat = new THREE.MeshStandardMaterial({
      color: lightColor,
      roughness: 0.55,
      metalness: 0.1,
    })

    const darkMat = new THREE.MeshStandardMaterial({
      color: darkColor,
      roughness: 0.65,
      metalness: 0.15,
    })

    const tileGeo = new THREE.BoxGeometry(tileWidth, tileHeight, tileWidth)

    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const square = `${files[f]}${r + 1}`
        const isLight = (f + r) % 2 !== 0
        const mat = (isLight ? lightMat : darkMat).clone()

        const tile = new THREE.Mesh(tileGeo, mat)
        const x = (f - 3.5) * this.squareSize
        const z = (3.5 - r) * this.squareSize

        tile.position.set(x, tileHeight / 2, z)
        tile.receiveShadow = true
        tile.name = `Tile_${square}`
        tile.userData = { square, file: files[f], rank: r + 1 }

        this.tileMeshes.set(square, tile)
        this.group.add(tile)
      }
    }
  }

  /**
   * Adds coordinate markings along the border bevel
   */
  private buildCoordinateLabels() {
    if (typeof document === 'undefined') return
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8']

    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, 1024, 1024)

    ctx.font = 'bold 36px monospace'
    ctx.fillStyle = 'rgba(215, 195, 160, 0.75)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Draw file letters along bottom and top
    for (let f = 0; f < 8; f++) {
      const u = (f + 0.5) / 8 * 800 + 112
      ctx.fillText(files[f], u, 960)
      ctx.fillText(files[f], u, 64)
    }

    // Draw rank numbers along left and right
    for (let r = 0; r < 8; r++) {
      const v = (7 - r + 0.5) / 8 * 800 + 112
      ctx.fillText(ranks[r], 64, v)
      ctx.fillText(ranks[r], 960, v)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    const borderGeo = new THREE.PlaneGeometry(9.0, 9.0)
    const borderMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
    })
    const borderMesh = new THREE.Mesh(borderGeo, borderMat)
    borderMesh.rotation.x = -Math.PI / 2
    borderMesh.position.y = 0.035
    this.group.add(borderMesh)
  }

  /**
   * Creates glowing highlight meshes for selections and king in check
   */
  private createHighlightMesh(hexColor: number, opacity: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(0.98, 0.98)
    const mat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.052
    return mesh
  }

  /**
   * Pre-creates pool of 3D move indicator discs and capture rings
   */
  private createIndicatorPool() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    // Disc geometry for quiet moves
    const dotGeo = new THREE.CircleGeometry(0.16, 24)
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xeab308,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })

    // Ring geometry for captures
    const ringGeo = new THREE.RingGeometry(0.36, 0.44, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })

    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const square = `${files[f]}${r + 1}`
        const indicatorGroup = new THREE.Group()
        indicatorGroup.name = `Indicator_${square}`

        const dot = new THREE.Mesh(dotGeo, dotMat)
        dot.rotation.x = -Math.PI / 2
        dot.name = 'dot'
        indicatorGroup.add(dot)

        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = -Math.PI / 2
        ring.name = 'ring'
        indicatorGroup.add(ring)

        const x = (f - 3.5) * this.squareSize
        const z = (3.5 - r) * this.squareSize
        indicatorGroup.position.set(x, 0.055, z)
        indicatorGroup.visible = false

        this.moveIndicators.set(square, indicatorGroup)
        this.group.add(indicatorGroup)
      }
    }
  }

  /**
   * Converts algebraic square ('e4') to 3D world position (x, y, z)
   */
  public squareToWorld(square: string): THREE.Vector3 {
    const file = square.charCodeAt(0) - 97 // 'a' = 0 ... 'h' = 7
    const rank = parseInt(square[1], 10) - 1 // 1 = 0 ... 8 = 7

    const x = (file - 3.5) * this.squareSize
    const z = (3.5 - rank) * this.squareSize
    return new THREE.Vector3(x, 0.06, z)
  }

  /**
   * Converts 3D world position back to algebraic square ('e4')
   */
  public worldToSquare(worldPos: THREE.Vector3): string | null {
    const fileIdx = Math.round(worldPos.x / this.squareSize + 3.5)
    const rankIdx = Math.round(3.5 - worldPos.z / this.squareSize)

    if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) {
      return null
    }

    const file = String.fromCharCode(97 + fileIdx)
    const rank = rankIdx + 1
    return `${file}${rank}`
  }

  /**
   * Sets square selection highlight
   */
  public setSelectedSquare(square: string | null) {
    if (!square) {
      this.selectedHighlight.visible = false
      return
    }
    const pos = this.squareToWorld(square)
    this.selectedHighlight.position.set(pos.x, 0.053, pos.z)
    this.selectedHighlight.visible = true
  }

  /**
   * Highlights King in check
   */
  public setInCheckSquare(square: string | null) {
    if (!square) {
      this.checkAuraMesh.visible = false
      return
    }
    const pos = this.squareToWorld(square)
    this.checkAuraMesh.position.set(pos.x, 0.051, pos.z)
    this.checkAuraMesh.visible = true
  }

  /**
   * Displays legal move indicators (quiet moves vs captures)
   */
  public showLegalMoves(moves: { to: string; captured?: boolean }[]) {
    // Hide all indicators first
    this.moveIndicators.forEach((grp) => {
      grp.visible = false
    })

    // Show matching indicators
    for (const move of moves) {
      const grp = this.moveIndicators.get(move.to)
      if (grp) {
        const dot = grp.getObjectByName('dot')
        const ring = grp.getObjectByName('ring')
        if (dot) dot.visible = !move.captured
        if (ring) ring.visible = !!move.captured
        grp.visible = true
      }
    }
  }

  public clearLegalMoves() {
    this.moveIndicators.forEach((grp) => {
      grp.visible = false
    })
  }

  public setLastMove(lastMove: { from: string; to: string } | null) {
    for (const h of this.lastMoveHighlights) {
      this.group.remove(h)
    }
    this.lastMoveHighlights = []

    if (!lastMove) return

    for (const sq of [lastMove.from, lastMove.to]) {
      const highlight = this.createHighlightMesh(0xeab308, 0.28)
      const pos = this.squareToWorld(sq)
      highlight.position.set(pos.x, 0.051, pos.z)
      this.group.add(highlight)
      this.lastMoveHighlights.push(highlight)
    }
  }
}
