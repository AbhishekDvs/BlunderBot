/**
 * 3D Piece Mesh Builder & GLB Loader for Astra Royal War Miniatures
 * Authoritative specification: docs/astra/DESIGN.md, ANIMATION.md
 * 
 * Supports both:
 * 1. Production glTF / GLB model loading via GLTFLoader with caching
 * 2. Instant procedural 3D geometric construction fallback with full articulation handles
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Piece3DNode, PieceAnimator } from './types.ts'
import { IndianArmiesRuntime } from './indianArmiesRuntime.ts'

export const CARD_REST_TILT_X = -0.58

export const CLIPS_DEF: Record<
  string,
  { start: number; count: number; fps: number; loop: boolean; contactFrame?: number; texture?: 'main' | 'endings' }
> = {
  idle: { start: 0, count: 8, fps: 10, loop: true, texture: 'main' },
  move: { start: 8, count: 12, fps: 14, loop: true, texture: 'main' },
  attack_anticipation: { start: 20, count: 4, fps: 12, loop: false, texture: 'main' },
  attack: { start: 24, count: 8, fps: 16, loop: false, contactFrame: 4, texture: 'main' },
  defend: { start: 32, count: 6, fps: 12, loop: false, texture: 'main' },
  hit: { start: 38, count: 4, fps: 16, loop: false, texture: 'main' },
  stagger: { start: 42, count: 6, fps: 12, loop: false, texture: 'main' },
  defeat: { start: 48, count: 8, fps: 12, loop: false, texture: 'main' },
  victory: { start: 56, count: 8, fps: 12, loop: false, texture: 'main' },
  defeat_acknowledgement: { start: 0, count: 8, fps: 12, loop: false, texture: 'endings' },
  draw_disengagement: { start: 8, count: 8, fps: 12, loop: false, texture: 'endings' },
}

// Cache for loaded GLB templates
const glbCache = new Map<string, THREE.Group>()
if (typeof window !== 'undefined') {
  (window as unknown as { __GLB_CACHE__: Map<string, THREE.Group> }).__GLB_CACHE__ = glbCache
}
const loader = new GLTFLoader()

// Faction PBR material palettes with enhanced readability and edge contrast
const WHITE_PALETTE = {
  stone: new THREE.MeshStandardMaterial({
    color: 0xebe3d3, // Warm antique alabaster/ivory
    roughness: 0.34,
    metalness: 0.05,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xd9a637, // Polished warm gold
    roughness: 0.24,
    metalness: 0.92,
  }),
  bronze: new THREE.MeshStandardMaterial({
    color: 0x9e7542, // Polished bronze
    roughness: 0.32,
    metalness: 0.88,
  }),
  crimson: new THREE.MeshStandardMaterial({
    color: 0xad2927, // Royal crimson
    roughness: 0.70,
    metalness: 0.05,
  }),
  saffron: new THREE.MeshStandardMaterial({
    color: 0xd6842e, // Infantry saffron
    roughness: 0.70,
    metalness: 0.05,
  }),
  forestGreen: new THREE.MeshStandardMaterial({
    color: 0x476b4d, // Sage green
    roughness: 0.70,
    metalness: 0.05,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: 0xbfc7d1, // Polished steel blade
    roughness: 0.18,
    metalness: 0.96,
  }),
}

const BLACK_PALETTE = {
  stone: new THREE.MeshStandardMaterial({
    color: 0x302a28, // Lustrous volcanic obsidian/basalt
    roughness: 0.28,
    metalness: 0.22,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xd19940, // High-contrast antique brass/bronze edge trim
    roughness: 0.25,
    metalness: 0.88,
  }),
  bronze: new THREE.MeshStandardMaterial({
    color: 0x6b5138, // Warm dark bronze
    roughness: 0.35,
    metalness: 0.85,
  }),
  crimson: new THREE.MeshStandardMaterial({
    color: 0x7a241f, // Deep maroon
    roughness: 0.70,
    metalness: 0.05,
  }),
  saffron: new THREE.MeshStandardMaterial({
    color: 0xad701f, // Warm dark ochre
    roughness: 0.70,
    metalness: 0.05,
  }),
  forestGreen: new THREE.MeshStandardMaterial({
    color: 0x38523f, // Deep spruce green
    roughness: 0.70,
    metalness: 0.05,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: 0x7a8087, // Tempered steel
    roughness: 0.22,
    metalness: 0.95,
  }),
}

export interface AssetManifest {
  id: string
  name: string
  label?: string
  isExperimental: boolean
  description: string
  getModelPath: (pieceCode: string) => string
}

export const ASSET_MANIFESTS: Record<string, AssetManifest> = {
  '2p5d-stylized': {
    id: '2p5d-stylized',
    name: 'Stylized 2.5D Indian War Chess',
    label: '✨ 2.5D Stylized (Recommended)',
    isExperimental: false,
    description: 'Living 2.5D ancient Indian war chess units with frame-by-frame animation, Warcraft RTS combat, and sub-second readability.',
    getModelPath: (code) => IndianArmiesRuntime.getMainAtlasUrl(code),
  },
  'astra-dev-v02': {
    id: 'astra-dev-v02',
    name: 'White Army Candidates (v0.2)',
    label: 'v0.2 3D Candidates',
    isExperimental: true,
    description: 'Complete rigged White Army candidates from CC0 Human Base with 10 standard animation clips and repaired Bishop.',
    getModelPath: (code) => {
      if (code.startsWith('w')) {
        return `/models/astra-dev-v02/${code}.glb`
      }
      return `/models/astra/${code}.glb`
    },
  },
  production: {
    id: 'production',
    name: 'Legacy 3D Blockouts',
    isExperimental: false,
    description: 'Legacy 3D geometric blockout models with combat sockets.',
    getModelPath: (code) => `/models/astra/${code}.glb`,
  },
  'astra-dev-v01': {
    id: 'astra-dev-v01',
    name: 'Development Kit (v0.1)',
    label: 'Dev Kit v0.1',
    isExperimental: true,
    description: 'Initial development geometry studies from White Army AssetKit.',
    getModelPath: (code) => {
      if (code.startsWith('w')) {
        return `/models/astra-dev-v01/${code}.glb`
      }
      return `/models/astra/${code}.glb`
    },
  },
}

export class PieceBuilder3D {
  private static activeManifestId = '2p5d-stylized'
  private static textureLoader = new THREE.TextureLoader()
  private static textureCache = new Map<string, THREE.Texture>()
  private static texturePromises = new Map<string, Promise<THREE.Texture>>()

  private static readonly DIMENSIONS_2P5D: Record<string, { width: number; height: number; yOffset: number; plinthR: number }> = {
    P: { width: 0.96, height: 1.05, yOffset: 0.52, plinthR: 0.36 }, // Padati - Infantry Pawn
    R: { width: 1.10, height: 1.15, yOffset: 0.58, plinthR: 0.40 }, // Durg - Wheeled Fortress Rook
    N: { width: 1.25, height: 1.28, yOffset: 0.64, plinthR: 0.40 }, // Ashva - Armored Cavalry Knight
    B: { width: 1.10, height: 1.32, yOffset: 0.66, plinthR: 0.38 }, // Acharya - Preceptor Bishop
    Q: { width: 1.20, height: 1.38, yOffset: 0.69, plinthR: 0.39 }, // Samrajni - Battle Queen
    K: { width: 1.30, height: 1.45, yOffset: 0.72, plinthR: 0.42 }, // Raja - Sovereign King
  }

  public static setManifest(manifestId: string) {
    if (ASSET_MANIFESTS[manifestId]) {
      this.activeManifestId = manifestId
    }
  }

  public static getManifest(): AssetManifest {
    return ASSET_MANIFESTS[this.activeManifestId] || ASSET_MANIFESTS.production
  }

  public static getAvailableManifests(): AssetManifest[] {
    return Object.values(ASSET_MANIFESTS)
  }

  private static loadCachedTexture(key: string, url: string, pieceCode: string): Promise<THREE.Texture> {
    const existing = this.texturePromises.get(key)
    if (existing) return existing

    const promise = new Promise<THREE.Texture>((resolve) => {
      this.textureLoader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.minFilter = THREE.LinearMipmapLinearFilter
          tex.magFilter = THREE.LinearFilter
          tex.generateMipmaps = true
          tex.needsUpdate = true
          this.textureCache.set(key, tex)
          resolve(tex)
        },
        undefined,
        (err) => {
          const msg = `Failed to load 2.5D atlas ${url} for ${pieceCode}`
          IndianArmiesRuntime.recordError(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
          const fallback = this.createFallbackAtlasTexture(pieceCode, key.startsWith('atlas_endings_') ? 2 : 8)
          this.textureCache.set(key, fallback)
          resolve(fallback)
        }
      )
    })

    this.texturePromises.set(key, promise)
    return promise
  }

  /**
   * Preloads army models or 2.5D textures for the specified or active manifest
   */
  public static async preloadArmyModels(manifestId?: string, _side: 'white' | 'black' = 'white'): Promise<void> {
    void _side // Authored views are shared across board orientations, never mirrored.
    const manifest = manifestId ? ASSET_MANIFESTS[manifestId] || this.getManifest() : this.getManifest()
    const codes = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK']

    if (manifest.id === '2p5d-stylized') {
      await IndianArmiesRuntime.loadRuntimeMetadata()

      // Load all 12 main character atlases immediately so every board piece renders crisply,
      // then warm supplementary ending atlases & impact debris sprites asynchronously.
      await Promise.allSettled(
        [...codes.map((code) =>
          this.loadCachedTexture(`atlas_${code}`, IndianArmiesRuntime.getMainAtlasUrl(code), code)
        ),...codes.flatMap(code => {
          const url=IndianArmiesRuntime.getDefenseAtlasUrl(code)
          return url ? [this.loadCachedTexture(`defense_${code}`,url,code)] : []
        })]
      )

      const effectW = IndianArmiesRuntime.getEffectSpriteDef('w')
      const effectB = IndianArmiesRuntime.getEffectSpriteDef('b')
      void Promise.allSettled([
        ...codes.map((code) =>
          this.loadCachedTexture(`atlas_endings_${code}`, IndianArmiesRuntime.getEndingsAtlasUrl(code), code)
        ),
        this.loadCachedTexture('effect_w', effectW.url, 'wEffect'),
        this.loadCachedTexture('effect_b', effectB.url, 'bEffect'),
      ])
      return
    }

    await Promise.allSettled(
      codes.map(async (code) => {
        const cacheKey = `${manifest.id}:${code}`
        if (glbCache.has(cacheKey)) return
        try {
          const modelUrl = manifest.getModelPath(code)
          const gltf = await loader.loadAsync(modelUrl)
          glbCache.set(cacheKey, gltf.scene)
          // Also set legacy key for active manifest
          if (manifest.id === this.activeManifestId) {
            glbCache.set(code, gltf.scene)
          }
        } catch (err) {
          console.error(`[Astra3D] Failed to load GLB for ${code} (${manifest.id}):`, err)
        }
      })
    )
  }

  private static createFallbackAtlasTexture(pieceCode: string, rows = 8): THREE.Texture {
    if (typeof document === 'undefined') {
      return new THREE.Texture()
    }
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const isWhite = pieceCode.startsWith('w')
      ctx.fillStyle = isWhite ? '#f0e7d6' : '#26242b'
      ctx.beginPath()
      ctx.arc(128, 138, 72, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 8
      ctx.strokeStyle = isWhite ? '#d49a38' : '#b8252c'
      ctx.stroke()
      ctx.fillStyle = isWhite ? '#231f1a' : '#f5e6c8'
      ctx.font = 'bold 88px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(pieceCode.slice(1).toUpperCase(), 128, 140)
    }
    // Animators sample an atlas, including during idle. A single-cell fallback
    // gets cropped into 1/64th and disappears on most frames. Repeat the token
    // at every authored frame position so missing artwork stays playable.
    const atlas = document.createElement('canvas')
    const isEffect = pieceCode.endsWith('Effect')
    atlas.width = isEffect ? 1 : 256 * 8
    atlas.height = isEffect ? 1 : 256 * rows
    const atlasCtx = atlas.getContext('2d')
    if (!isEffect) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 8; col++) atlasCtx?.drawImage(canvas, col * 256, row * 256)
      }
    }
    const tex = new THREE.CanvasTexture(atlas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  private static get2p5dAnimatedTexture(
    pieceCode: string,
    kind: 'main' | 'endings' = 'main'
  ): THREE.Texture {
    if (typeof document === 'undefined') {
      return new THREE.Texture()
    }
    const isEndings = kind === 'endings'
    const cacheKey = isEndings ? `atlas_endings_${pieceCode}` : `atlas_${pieceCode}`
    const url = isEndings
      ? IndianArmiesRuntime.getEndingsAtlasUrl(pieceCode)
      : IndianArmiesRuntime.getMainAtlasUrl(pieceCode)
    const cols = 8
    const rows = isEndings ? 2 : 8

    const cached = this.textureCache.get(cacheKey)
    if (cached && cached.image) {
      const tex = cached.clone()
      tex.repeat.set(1 / cols, 1 / rows)
      tex.offset.set(0, (rows - 1) / rows)
      tex.needsUpdate = true
      return tex
    }

    // Create a shell texture that receives the decoded image as soon as it finishes loading
    const tex = new THREE.Texture()
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.repeat.set(1 / cols, 1 / rows)
    tex.offset.set(0, (rows - 1) / rows)

    this.loadCachedTexture(cacheKey, url, pieceCode).then((loadedMaster) => {
      // Share the decoded atlas/GPU source, preserving each node's UV transform.
      // Assigning only image gives every initial Pawn a separate GPU allocation.
      tex.source = loadedMaster.source
      tex.needsUpdate = true
    })

    return tex
  }

  public static getEffectSpriteTexture(faction: 'w' | 'b'): THREE.Texture {
    if (typeof document === 'undefined') {
      return new THREE.Texture()
    }
    const effectDef = IndianArmiesRuntime.getEffectSpriteDef(faction)
    const cacheKey = `effect_${faction}`
    const cached = this.textureCache.get(cacheKey)
    if (cached && cached.image) {
      const tex = cached.clone()
      tex.repeat.set(1 / effectDef.cols, 1 / effectDef.rows)
      tex.offset.set(0, (effectDef.rows - 1) / effectDef.rows)
      tex.needsUpdate = true
      return tex
    }
    const tex = new THREE.Texture()
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.repeat.set(1 / effectDef.cols, 1 / effectDef.rows)
    tex.offset.set(0, (effectDef.rows - 1) / effectDef.rows)

    this.loadCachedTexture(cacheKey, effectDef.url, `${faction}Effect`).then((loadedMaster) => {
      tex.source = loadedMaster.source
      tex.needsUpdate = true
    })
    return tex
  }

  /** Alternate painted performance for the same live defender; never mirrored. */
  public static getDefenseSpriteTexture(pieceCode: string): THREE.Texture | null {
    return this.textureCache.get(`defense_${pieceCode}`)?.clone() ?? null
  }

  /**
   * Constructs an authoritative 2.5D stylized Indian war chess miniature:
   * Upright card with animated 8x8 sprite atlas texture (Warcraft RTS inspired),
   * soft contact plinth, gold fillet ring, and weapon/contact socket anchors.
   */
  private static build2p5dPiece(
    pieceCode: string,
    square: string,
    pal: typeof WHITE_PALETTE
  ): {
    group: THREE.Group
    torsoNode: THREE.Object3D
    weaponNode: THREE.Object3D
    shieldNode: THREE.Object3D
    plinthNode: THREE.Object3D
    cardMesh: THREE.Mesh
    animator: PieceAnimator
  } {
    const group = new THREE.Group()
    group.name = `Miniature_2p5D_${pieceCode}_${square}`
    const classChar = pieceCode.slice(1).toUpperCase()
    const placement = IndianArmiesRuntime.getCardPlacement(classChar)
    const dim = this.DIMENSIONS_2P5D[classChar] || this.DIMENSIONS_2P5D.P

    // 1. Ground Contact Shadow Disc (Y = 0.005)
    const shadowGeo = new THREE.CircleGeometry(placement.plinthR * .82, 32)
    let shadowTexture: THREE.Texture | undefined
    if (typeof document!=='undefined') {
      const shadowCanvas=document.createElement('canvas');shadowCanvas.width=64;shadowCanvas.height=64
      const context=shadowCanvas.getContext('2d')
      if (context) {
        const gradient=context.createRadialGradient(32,32,0,32,32,32)
        gradient.addColorStop(0,'rgba(255,255,255,.9)');gradient.addColorStop(.45,'rgba(255,255,255,.45)');gradient.addColorStop(1,'rgba(255,255,255,0)')
        context.fillStyle=gradient;context.fillRect(0,0,64,64)
        shadowTexture=new THREE.CanvasTexture(shadowCanvas)
      }
    }
    const shadowMat = new THREE.MeshBasicMaterial({
      ...(shadowTexture?{map:shadowTexture}:{}),
      color: 0x0a0806,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
    shadowMesh.rotation.x = -Math.PI / 2
    shadowMesh.position.y = 0.012
    shadowMesh.scale.y=.58
    group.add(shadowMesh)

    // 2. Beveled Stone Plinth Base (Y = 0.02, top surface Y = 0.04)
    const plinthGeo = new THREE.CylinderGeometry(placement.plinthR, placement.plinthR * 1.05, 0.04, 32)
    const plinthMesh = new THREE.Mesh(plinthGeo, pal.stone)
    plinthMesh.name = 'Plinth_Stone'
    plinthMesh.position.y = 0.02
    plinthMesh.castShadow = true
    plinthMesh.receiveShadow = true
    plinthMesh.visible = false
    group.add(plinthMesh)

    // 3. Antique Gold / Brass Inlay Ring on Plinth
    const rimGeo = new THREE.TorusGeometry(placement.plinthR * 1.01, 0.012, 8, 32)
    const rimMesh = new THREE.Mesh(rimGeo, pal.gold)
    rimMesh.rotation.x = Math.PI / 2
    rimMesh.position.y = 0.04
    rimMesh.visible = false
    group.add(rimMesh)

    // 4. Upright 2.5D Animated Character Card Mesh anchored to foot pivot ([128, 220] -> [0.5, 0.859375])
    const mainTexture = this.get2p5dAnimatedTexture(pieceCode, 'main')
    let endingsTexture: THREE.Texture | null = null
    let activeTextureKind: 'main' | 'endings' = 'main'
    let activeTexture = mainTexture

    const cardGeo = new THREE.PlaneGeometry(placement.width, placement.height)
    const cardMat = new THREE.MeshBasicMaterial({
      map: activeTexture,
      transparent: true,
      alphaTest: 0.035,
      depthWrite: false,
      side: THREE.FrontSide,
      toneMapped: false,
    })
    const cardMesh = new THREE.Mesh(cardGeo, cardMat)
    cardMesh.name = `Card_${pieceCode}`
    cardMesh.castShadow = false
    cardMesh.receiveShadow = false
    cardMesh.userData.cardRestPos = [...placement.cardPosition]
    cardMesh.userData.cardRestTiltX = placement.tiltRad
    cardMesh.userData.cardDimensions = [placement.width,placement.height]
    cardMesh.userData.mainTexture = mainTexture
    cardMesh.position.set(placement.cardPosition[0], placement.cardPosition[1], placement.cardPosition[2])
    // Tilted backwards (-0.58 rad = ~33 deg) to perpendicularly face 48 deg oblique tactical camera
    cardMesh.rotation.x = placement.tiltRad
    group.add(cardMesh)

    // Frame-by-Frame Animator Engine supporting both 8x8 main and 8x2 supplementary endings atlases
    const animator: PieceAnimator = {
      currentClip: 'idle',
      currentFrame: 0,
      frameTime: 0,
      loop: true,
      isFinished: false,
      facing: 'front',
      setFacing(dir: 'front' | 'back') {
        // Sol provides fixed authored 3/4 views only (Bishop left, others right); never mirror weapon hands
        this.facing = dir
      },
      playClip(clipName: string, loop?: boolean, onComplete?: () => void) {
        const resolved = IndianArmiesRuntime.resolveClip(pieceCode, clipName)
        this.currentClip = resolved.clipName
        this.currentFrame = 0
        this.frameTime = 0
        this.loop = loop ?? resolved.loop
        this.isFinished = false
        this.onComplete = onComplete
        this.updateUV()
      },
      setFrame(frameIndex: number) {
        this.currentFrame = Math.max(0, frameIndex)
        this.updateUV()
      },
      updateUV() {
        const resolved = IndianArmiesRuntime.resolveClip(pieceCode, this.currentClip)
        if (resolved.textureKind !== activeTextureKind) {
          activeTextureKind = resolved.textureKind
          if (activeTextureKind === 'endings') {
            if (!endingsTexture) {
              endingsTexture = PieceBuilder3D.get2p5dAnimatedTexture(pieceCode, 'endings')
              cardMesh.userData.endingsTexture = endingsTexture
            }
            activeTexture = endingsTexture
          } else {
            activeTexture = mainTexture
          }
          cardMat.map = activeTexture
          cardMat.needsUpdate = true
        }
        const safeCount = Math.max(1, resolved.count)
        const localFrame = this.currentFrame % safeCount
        const atlasIndex = resolved.start + localFrame
        const cols = Math.max(1, resolved.cols)
        const rows = Math.max(1, resolved.rows)
        activeTexture.repeat.set(1/cols,1/rows)
        const col = atlasIndex % cols
        const row = Math.floor(atlasIndex / cols)
        activeTexture.offset.x = col / cols
        activeTexture.offset.y = (rows - 1 - row) / rows
      },
      update(deltaSeconds: number) {
        if (this.isFinished) return
        const resolved = IndianArmiesRuntime.resolveClip(pieceCode, this.currentClip)
        this.frameTime += deltaSeconds
        const fps = resolved.fps || 12
        let guard = 0
        while (guard++ < 16) {
          const ms = resolved.frameDurationsMs?.[this.currentFrame]
          const frameDuration = ms ? ms / 1000 : 1 / fps
          if (this.frameTime < frameDuration) break
          this.frameTime -= frameDuration
          this.currentFrame++
          if (this.currentFrame >= resolved.count) {
            if (this.loop) {
              this.currentFrame = 0
            } else {
              this.currentFrame = Math.max(0, resolved.count - 1)
              this.isFinished = true
              this.updateUV()
              if (this.onComplete) {
                const cb = this.onComplete
                this.onComplete = undefined
                cb()
              }
              return
            }
          }
          this.updateUV()
        }
      },
    }

    // 5. Authored Socket Anchors driven by clip manifest pixels when available
    const weaponSocket = new THREE.Object3D()
    weaponSocket.name = 'weapon_tip_socket'
    const contactAnchor = new THREE.Object3D()
    contactAnchor.name = 'contact_anchor'
    const shieldSocket = new THREE.Object3D()
    shieldSocket.name = 'shield_socket'

    const pieceMeta = IndianArmiesRuntime.getPieceClipManifest(pieceCode)
    const atk4Tip = pieceMeta?.clips?.attack?.socketsPx?.[4]?.weaponTip
    const def5Contact = pieceMeta?.clips?.defend?.socketsPx?.[5]?.defenseContact

    if (atk4Tip) {
      const [wx, wy, wz] = IndianArmiesRuntime.spritePixelToCardLocal(classChar, atk4Tip[0], atk4Tip[1], pieceMeta?.cell || 256)
      weaponSocket.position.set(wx, wy, wz)
    } else {
      switch (classChar) {
        case 'N':
          weaponSocket.position.set(0.41, dim.yOffset * 0.12, 0.05)
          break
        case 'B':
          weaponSocket.position.set(-0.32, dim.yOffset * 0.1, 0.05)
          break
        case 'P':
          weaponSocket.position.set(0.18, dim.yOffset * 0.1, 0.05)
          shieldSocket.position.set(-0.18, dim.yOffset * 0.05, 0.05)
          break
        default:
          weaponSocket.position.set(0.2, dim.yOffset * 0.08, 0.05)
          break
      }
    }

    if (def5Contact) {
      const [cx, cy, cz] = IndianArmiesRuntime.spritePixelToCardLocal(classChar, def5Contact[0], def5Contact[1], pieceMeta?.cell || 256)
      contactAnchor.position.set(cx, cy, cz)
    } else {
      contactAnchor.position.set(0, 0.02, 0)
    }

    cardMesh.add(weaponSocket)
    cardMesh.add(contactAnchor)
    cardMesh.add(shieldSocket)

    return {
      group,
      torsoNode: cardMesh,
      weaponNode: weaponSocket,
      shieldNode: shieldSocket,
      plinthNode: plinthMesh,
      cardMesh,
      animator,
    }
  }

  /**
   * Constructs an articulated 3D piece node
   */
  public static createPieceNode(pieceCode: string, square: string, manifestId?: string): Piece3DNode {
    const activeManifest = manifestId ? (ASSET_MANIFESTS[manifestId] || this.getManifest()) : this.getManifest()
    const is2p5dManifest = activeManifest.id === '2p5d-stylized'
    const group = new THREE.Group()
    group.name = is2p5dManifest ? `Piece_2p5D_${pieceCode}_${square}` : `Piece_${pieceCode}_${square}`

    const isWhite = pieceCode.startsWith('w')
    const pal = isWhite ? WHITE_PALETTE : BLACK_PALETTE
    const classChar = pieceCode.slice(1).toUpperCase()

    let torsoNode: THREE.Object3D | undefined
    let weaponNode: THREE.Object3D | undefined
    let shieldNode: THREE.Object3D | undefined
    let plinthNode: THREE.Object3D | undefined
    let cardMesh: THREE.Mesh | undefined
    let animator: PieceAnimator | undefined

    if (activeManifest.id === '2p5d-stylized') {
      const model = this.build2p5dPiece(pieceCode, square, pal)
      group.add(model.group)
      torsoNode = model.torsoNode
      weaponNode = model.weaponNode
      shieldNode = model.shieldNode
      plinthNode = model.plinthNode
      cardMesh = model.cardMesh
      animator = model.animator
    } else {
      // Check if GLB is cached by manifest key or legacy key
      const cacheKey = `${activeManifest.id}:${pieceCode}`
      const cachedGLB = glbCache.get(cacheKey) || glbCache.get(pieceCode)

      if (cachedGLB) {
        const cloned = cachedGLB.clone(true)
        cloned.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true
            obj.receiveShadow = true
          }
        })
        group.add(cloned)

        // Find articulation sockets
        torsoNode =
          cloned.getObjectByName('Rider_Torso') ||
          cloned.getObjectByName('Acharya_Torso') ||
          cloned.getObjectByName('Pawn_Torso') ||
          cloned.getObjectByName('Samrajni_Torso') ||
          cloned.getObjectByName('Raja_Cuirass') ||
          cloned.getObjectByName('Horse_Body') ||
          cloned.getObjectByName('Durg_Bastion')

        weaponNode =
          cloned.getObjectByName('Lance_Assembly') ||
          cloned.getObjectByName('Staff_Assembly') ||
          cloned.getObjectByName('Acharya_Staff_Assembly') ||
          cloned.getObjectByName('Pawn_SpearAssembly') ||
          cloned.getObjectByName('Pawn_Spear_Assembly') ||
          cloned.getObjectByName('Samrajni_TalwarAssembly') ||
          cloned.getObjectByName('Samrajni_Talwar_Assembly') ||
          cloned.getObjectByName('Raja_SwordAssembly') ||
          cloned.getObjectByName('Raja_Sword_Assembly') ||
          cloned.getObjectByName('Cavalry_Lance') ||
          cloned.getObjectByName('Acharya_Staff') ||
          cloned.getObjectByName('Acharya_Staff_Head') ||
          cloned.getObjectByName('Pawn_SpearShaft') ||
          cloned.getObjectByName('Pawn_Spear_Head') ||
          cloned.getObjectByName('Samrajni_TalwarBlade') ||
          cloned.getObjectByName('Samrajni_Talwar_Blade') ||
          cloned.getObjectByName('Raja_Broadsword') ||
          cloned.getObjectByName('Raja_Sword_Blade') ||
          cloned.getObjectByName('Durg_Ram')

        shieldNode =
          cloned.getObjectByName('Pawn_DhalShield') ||
          cloned.getObjectByName('Pawn_Shield')

        plinthNode =
          cloned.getObjectByName('Plinth_Stone') ||
          cloned.getObjectByName('Plinth_Lower')
      } else {
        // Procedural model generation matching exact Astra dimensions & materials
        const model = this.buildProceduralModel(classChar, pal)
        group.add(model.group)
        torsoNode = model.torsoNode
        weaponNode = model.weaponNode
        shieldNode = model.shieldNode
        plinthNode = model.plinthNode
      }
    }

    // Orient Black pieces 180 deg to face White for 3D models (2.5D cards stay facing the player)
    if (!isWhite && activeManifest.id !== '2p5d-stylized') {
      group.rotation.y = Math.PI
    }

    return {
      pieceCode,
      square,
      group,
      torsoNode,
      weaponNode,
      shieldNode,
      plinthNode,
      cardMesh,
      animator,
      initialScale: new THREE.Vector3(1, 1, 1),
      currentPosition: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      isAnimating: false,
    }
  }

  /**
   * Builds procedural 3D model for class with full articulation points
   */
  private static buildProceduralModel(classChar: string, pal: typeof WHITE_PALETTE) {
    const group = new THREE.Group()
    let torsoNode: THREE.Object3D | undefined
    let weaponNode: THREE.Object3D | undefined
    let shieldNode: THREE.Object3D | undefined

    // Shared Plinth base: diameter .68S (radius 0.34S), height .07S
    const baseGeo = new THREE.CylinderGeometry(0.34, 0.35, 0.05, 24)
    const baseMesh = new THREE.Mesh(baseGeo, pal.stone)
    baseMesh.position.y = 0.025
    baseMesh.castShadow = true
    baseMesh.receiveShadow = true
    group.add(baseMesh)
    const plinthNode = baseMesh

    const rimGeo = new THREE.CylinderGeometry(0.31, 0.34, 0.02, 24)
    const rimMesh = new THREE.Mesh(rimGeo, pal.gold)
    rimMesh.position.y = 0.06
    rimMesh.castShadow = true
    group.add(rimMesh)

    switch (classChar) {
      case 'P': { // Padati — Pawn (Height .69S)
        const torsoGroup = new THREE.Group()
        torsoGroup.position.set(0, 0.28, 0)

        // Dhoti & Lower body
        const dhotiGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.18, 16)
        const dhotiMesh = new THREE.Mesh(dhotiGeo, pal.saffron)
        dhotiMesh.position.y = -0.10
        dhotiMesh.castShadow = true
        torsoGroup.add(dhotiMesh)

        // Armored Torso Cuirass
        const cuirassGeo = new THREE.ConeGeometry(0.15, 0.22, 16)
        const cuirassMesh = new THREE.Mesh(cuirassGeo, pal.bronze)
        cuirassMesh.position.y = 0.05
        cuirassMesh.castShadow = true
        torsoGroup.add(cuirassMesh)

        // Carved Ivory Head
        const headGeo = new THREE.SphereGeometry(0.08, 16, 12)
        const headMesh = new THREE.Mesh(headGeo, pal.stone)
        headMesh.position.y = 0.21
        headMesh.castShadow = true
        torsoGroup.add(headMesh)

        // Turban with Pointed Crest
        const crestGeo = new THREE.ConeGeometry(0.085, 0.14, 16)
        const crestMesh = new THREE.Mesh(crestGeo, pal.gold)
        crestMesh.position.y = 0.32
        crestMesh.castShadow = true
        torsoGroup.add(crestMesh)

        // Shield (Left arm)
        const shieldGroup = new THREE.Group()
        shieldGroup.position.set(-0.16, 0.05, 0.05)
        const shieldGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 20)
        const shieldMesh = new THREE.Mesh(shieldGeo, pal.bronze)
        shieldMesh.rotation.z = Math.PI / 2
        shieldMesh.castShadow = true
        shieldGroup.add(shieldMesh)

        const bossGeo = new THREE.SphereGeometry(0.03, 12, 8)
        const bossMesh = new THREE.Mesh(bossGeo, pal.gold)
        bossMesh.position.x = -0.015
        shieldGroup.add(bossMesh)
        torsoGroup.add(shieldGroup)
        shieldNode = shieldGroup

        // Spear (Right hand)
        const weaponGroup = new THREE.Group()
        weaponGroup.position.set(0.14, 0.04, 0)
        const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.65, 8)
        const shaftMesh = new THREE.Mesh(shaftGeo, pal.bronze)
        shaftMesh.castShadow = true
        weaponGroup.add(shaftMesh)

        const tipGeo = new THREE.ConeGeometry(0.025, 0.12, 8)
        const tipMesh = new THREE.Mesh(tipGeo, pal.steel)
        tipMesh.position.y = 0.38
        tipMesh.castShadow = true
        weaponGroup.add(tipMesh)
        torsoGroup.add(weaponGroup)
        weaponNode = weaponGroup

        group.add(torsoGroup)
        torsoNode = torsoGroup
        break
      }

      case 'R': { // Durg — Rook (Height .72S)
        const towerGeo = new THREE.CylinderGeometry(0.28, 0.30, 0.48, 8)
        const towerMesh = new THREE.Mesh(towerGeo, pal.stone)
        towerMesh.position.y = 0.31
        towerMesh.castShadow = true
        towerMesh.receiveShadow = true
        group.add(towerMesh)
        torsoNode = towerMesh

        // Crenellated Parapet Ring
        const parapetGeo = new THREE.CylinderGeometry(0.30, 0.28, 0.12, 16)
        const parapetMesh = new THREE.Mesh(parapetGeo, pal.stone)
        parapetMesh.position.y = 0.60
        parapetMesh.castShadow = true
        group.add(parapetMesh)

        // Bronze Battering Ram
        const ramGroup = new THREE.Group()
        ramGroup.position.set(0, 0.24, 0.20)
        const ramGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12)
        const ramMesh = new THREE.Mesh(ramGeo, pal.steel)
        ramMesh.rotation.x = Math.PI / 2
        ramMesh.castShadow = true
        ramGroup.add(ramMesh)
        group.add(ramGroup)
        weaponNode = ramGroup
        break
      }

      case 'N': { // Ashva Senani — Knight (Height .86S)
        const knightGroup = new THREE.Group()
        knightGroup.position.set(0, 0.30, 0)

        // Horse Body & Rump
        const bodyGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.30, 12)
        const bodyMesh = new THREE.Mesh(bodyGeo, pal.stone)
        bodyMesh.rotation.x = 0.4
        bodyMesh.position.set(0, -0.06, -0.04)
        bodyMesh.castShadow = true
        knightGroup.add(bodyMesh)

        // Arched Horse Neck
        const neckGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.28, 12)
        const neckMesh = new THREE.Mesh(neckGeo, pal.stone)
        neckMesh.rotation.x = -0.55
        neckMesh.position.set(0, 0.10, 0.08)
        neckMesh.castShadow = true
        knightGroup.add(neckMesh)

        // Horse Head with Chamfron
        const headGeo = new THREE.ConeGeometry(0.10, 0.20, 12)
        const headMesh = new THREE.Mesh(headGeo, pal.bronze)
        headMesh.rotation.x = 0.8
        headMesh.position.set(0, 0.24, 0.18)
        headMesh.castShadow = true
        knightGroup.add(headMesh)

        // Mounted Rider & Lance
        const riderGeo = new THREE.CylinderGeometry(0.09, 0.10, 0.20, 12)
        const riderMesh = new THREE.Mesh(riderGeo, pal.gold)
        riderMesh.position.set(0, 0.16, -0.06)
        riderMesh.castShadow = true
        knightGroup.add(riderMesh)

        const weaponGroup = new THREE.Group()
        weaponGroup.position.set(0.14, 0.22, 0.06)
        const lanceGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.78, 8)
        const lanceMesh = new THREE.Mesh(lanceGeo, pal.steel)
        lanceMesh.rotation.x = 0.35
        lanceMesh.castShadow = true
        weaponGroup.add(lanceMesh)
        knightGroup.add(weaponGroup)
        weaponNode = weaponGroup

        group.add(knightGroup)
        torsoNode = knightGroup
        break
      }

      case 'B': { // Acharya — Bishop (Height .81S)
        const sageGroup = new THREE.Group()
        sageGroup.position.set(0, 0.32, 0)

        // Flowing Robe Lower
        const robeGeo = new THREE.ConeGeometry(0.20, 0.36, 16)
        const robeMesh = new THREE.Mesh(robeGeo, pal.stone)
        robeMesh.position.y = -0.08
        robeMesh.castShadow = true
        sageGroup.add(robeMesh)

        // Torso Shawl
        const shawlGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.24, 16)
        const shawlMesh = new THREE.Mesh(shawlGeo, pal.forestGreen)
        shawlMesh.position.y = 0.13
        shawlMesh.castShadow = true
        sageGroup.add(shawlMesh)

        // Head & Turban
        const headGeo = new THREE.SphereGeometry(0.08, 16, 12)
        const headMesh = new THREE.Mesh(headGeo, pal.stone)
        headMesh.position.y = 0.29
        headMesh.castShadow = true
        sageGroup.add(headMesh)

        const turbanGeo = new THREE.CylinderGeometry(0.075, 0.08, 0.12, 16)
        const turbanMesh = new THREE.Mesh(turbanGeo, pal.gold)
        turbanMesh.position.y = 0.40
        turbanMesh.castShadow = true
        sageGroup.add(turbanMesh)

        // Staff (Gaja-Ankusha)
        const weaponGroup = new THREE.Group()
        weaponGroup.position.set(0.14, 0.14, 0.04)
        const staffGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.82, 8)
        const staffMesh = new THREE.Mesh(staffGeo, pal.bronze)
        staffMesh.castShadow = true
        weaponGroup.add(staffMesh)

        const finialGeo = new THREE.ConeGeometry(0.035, 0.10, 8)
        const finialMesh = new THREE.Mesh(finialGeo, pal.gold)
        finialMesh.position.y = 0.45
        finialMesh.castShadow = true
        weaponGroup.add(finialMesh)
        sageGroup.add(weaponGroup)
        weaponNode = weaponGroup

        group.add(sageGroup)
        torsoNode = sageGroup
        break
      }

      case 'Q': { // Samrajni — Queen (Height .94S)
        const queenGroup = new THREE.Group()
        queenGroup.position.set(0, 0.34, 0)

        // Layered Gown
        const gownGeo = new THREE.ConeGeometry(0.24, 0.44, 20)
        const gownMesh = new THREE.Mesh(gownGeo, pal.stone)
        gownMesh.position.y = -0.06
        gownMesh.castShadow = true
        queenGroup.add(gownMesh)

        // Crimson Outer Mantle
        const mantleGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.38, 16)
        const mantleMesh = new THREE.Mesh(mantleGeo, pal.crimson)
        mantleMesh.position.set(0, -0.04, -0.03)
        mantleMesh.scale.set(1.1, 1.0, 0.8)
        mantleMesh.castShadow = true
        queenGroup.add(mantleMesh)

        // Cuirass Torso
        const cuirassGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.22, 16)
        const cuirassMesh = new THREE.Mesh(cuirassGeo, pal.gold)
        cuirassMesh.position.y = 0.20
        cuirassMesh.castShadow = true
        queenGroup.add(cuirassMesh)

        // Head & Flared Diadem Crown
        const headGeo = new THREE.SphereGeometry(0.075, 16, 12)
        const headMesh = new THREE.Mesh(headGeo, pal.stone)
        headMesh.position.y = 0.36
        headMesh.castShadow = true
        queenGroup.add(headMesh)

        const crownGeo = new THREE.ConeGeometry(0.11, 0.16, 16)
        const crownMesh = new THREE.Mesh(crownGeo, pal.gold)
        crownMesh.rotation.x = Math.PI
        crownMesh.position.y = 0.49
        crownMesh.castShadow = true
        queenGroup.add(crownMesh)

        // Curved Royal Talwar
        const weaponGroup = new THREE.Group()
        weaponGroup.position.set(0.17, 0.12, 0.08)
        const bladeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.48, 8)
        const bladeMesh = new THREE.Mesh(bladeGeo, pal.steel)
        bladeMesh.rotation.set(0.6, 0.3, 0)
        bladeMesh.castShadow = true
        weaponGroup.add(bladeMesh)
        queenGroup.add(weaponGroup)
        weaponNode = weaponGroup

        group.add(queenGroup)
        torsoNode = queenGroup
        break
      }

      case 'K': { // Raja — King (Height .87S)
        const kingGroup = new THREE.Group()
        kingGroup.position.set(0, 0.32, 0)

        // Royal Broad Robe
        const robeGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.38, 18)
        const robeMesh = new THREE.Mesh(robeGeo, pal.stone)
        robeMesh.position.y = -0.06
        robeMesh.castShadow = true
        kingGroup.add(robeMesh)

        // Crimson Shoulder Mantle
        const mantleGeo = new THREE.BoxGeometry(0.32, 0.22, 0.20)
        const mantleMesh = new THREE.Mesh(mantleGeo, pal.crimson)
        mantleMesh.position.y = 0.12
        mantleMesh.castShadow = true
        kingGroup.add(mantleMesh)

        // Cuirass
        const cuirassGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.24, 16)
        const cuirassMesh = new THREE.Mesh(cuirassGeo, pal.gold)
        cuirassMesh.position.y = 0.20
        cuirassMesh.castShadow = true
        kingGroup.add(cuirassMesh)

        // Head & Tiered Crown
        const headGeo = new THREE.SphereGeometry(0.08, 16, 12)
        const headMesh = new THREE.Mesh(headGeo, pal.stone)
        headMesh.position.y = 0.36
        headMesh.castShadow = true
        kingGroup.add(headMesh)

        const crownBaseGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.10, 16)
        const crownBaseMesh = new THREE.Mesh(crownBaseGeo, pal.gold)
        crownBaseMesh.position.y = 0.45
        crownBaseMesh.castShadow = true
        kingGroup.add(crownBaseMesh)

        const finialGeo = new THREE.ConeGeometry(0.04, 0.08, 12)
        const finialMesh = new THREE.Mesh(finialGeo, pal.gold)
        finialMesh.position.y = 0.53
        finialMesh.castShadow = true
        kingGroup.add(finialMesh)

        // Vertical Central Broadsword
        const weaponGroup = new THREE.Group()
        weaponGroup.position.set(0, 0.15, 0.14)
        const swordGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8)
        const swordMesh = new THREE.Mesh(swordGeo, pal.steel)
        swordMesh.castShadow = true
        weaponGroup.add(swordMesh)

        const guardGeo = new THREE.BoxGeometry(0.12, 0.02, 0.03)
        const guardMesh = new THREE.Mesh(guardGeo, pal.gold)
        guardMesh.position.y = 0.20
        weaponGroup.add(guardMesh)
        kingGroup.add(weaponGroup)
        weaponNode = weaponGroup

        group.add(kingGroup)
        torsoNode = kingGroup
        break
      }
    }

    return { group, torsoNode, weaponNode, shieldNode, plinthNode }
  }

  public static disposeNodeResources(node: Piece3DNode) {
    node.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose()
        if (mesh.userData?.mainTexture && ![...this.textureCache.values()].includes(mesh.userData.mainTexture)) {
          (mesh.userData.mainTexture as THREE.Texture).dispose()
        }
        if (mesh.userData?.endingsTexture && ![...this.textureCache.values()].includes(mesh.userData.endingsTexture)) {
          (mesh.userData.endingsTexture as THREE.Texture).dispose()
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) {
          if (!m) continue
          const std = m as THREE.MeshStandardMaterial
          if (std.map && ![...this.textureCache.values()].includes(std.map)) {
            std.map.dispose()
          }
          // Avoid disposing shared palette materials
          if (!Object.values(WHITE_PALETTE).includes(std) && !Object.values(BLACK_PALETTE).includes(std)) {
            m.dispose()
          }
        }
      }
    })
  }

  /** Face the viewing plane without ever reflecting artwork or rotating a sprite back into view. */
  public static orientSprite(node: Piece3DNode,camera: THREE.Camera) {
    const card=node.cardMesh
    if (!card) return
    const parent=card.parent!
    parent.updateWorldMatrix(true,false)
    const parentRotation=parent.getWorldQuaternion(new THREE.Quaternion())
    card.quaternion.copy(parentRotation.invert().multiply(camera.quaternion))
    const height=(card.userData.cardDimensions as [number,number])[1]
    const center=new THREE.Vector3(0,(220/256-.5)*height,0).applyQuaternion(card.quaternion)
    card.position.copy(center).add(new THREE.Vector3(0,.02,0))
  }
}
