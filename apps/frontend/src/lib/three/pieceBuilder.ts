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
import type { Piece3DNode } from './types.ts'

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
  production: {
    id: 'production',
    name: 'Production (Astra 3D)',
    isExperimental: false,
    description: 'Production high-readability army models with full combat rig sockets.',
    getModelPath: (code) => `/models/astra/${code}.glb`,
  },
  'astra-dev-v01': {
    id: 'astra-dev-v01',
    name: 'White Army Development Kit (v0.1)',
    label: 'Experimental Geometry',
    isExperimental: true,
    description: 'Development geometry studies from White Army AssetKit. For scale, silhouette and integration testing.',
    getModelPath: (code) => {
      if (code.startsWith('w')) {
        return `/models/astra-dev-v01/${code}.glb`
      }
      return `/models/astra/${code}.glb`
    },
  },
  'astra-dev-v02': {
    id: 'astra-dev-v02',
    name: 'White Army Candidates (v0.2)',
    label: 'v0.2 Production Candidates',
    isExperimental: true,
    description: 'Complete rigged White Army candidates from CC0 Human Base with 10 standard animation clips and repaired Bishop.',
    getModelPath: (code) => {
      if (code.startsWith('w')) {
        return `/models/astra-dev-v02/${code}.glb`
      }
      return `/models/astra/${code}.glb`
    },
  },
}

export class PieceBuilder3D {
  private static activeManifestId = 'production'

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

  /**
   * Preloads army models for the specified or active manifest
   */
  public static async preloadArmyModels(manifestId?: string): Promise<void> {
    const manifest = manifestId ? ASSET_MANIFESTS[manifestId] || this.getManifest() : this.getManifest()
    const codes = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK']
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

  /**
   * Constructs an articulated 3D piece node
   */
  public static createPieceNode(pieceCode: string, square: string, manifestId?: string): Piece3DNode {
    const group = new THREE.Group()
    group.name = `Piece_${pieceCode}_${square}`

    const isWhite = pieceCode.startsWith('w')
    const pal = isWhite ? WHITE_PALETTE : BLACK_PALETTE
    const classChar = pieceCode.slice(1).toUpperCase()
    const activeManifest = manifestId ? (ASSET_MANIFESTS[manifestId] || this.getManifest()) : this.getManifest()

    // Check if GLB is cached by manifest key or legacy key
    const cacheKey = `${activeManifest.id}:${pieceCode}`
    const cachedGLB = glbCache.get(cacheKey) || glbCache.get(pieceCode)
    let torsoNode: THREE.Object3D | undefined
    let weaponNode: THREE.Object3D | undefined
    let shieldNode: THREE.Object3D | undefined
    let plinthNode: THREE.Object3D | undefined

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

    // Orient Black pieces 180 deg to face White
    if (!isWhite) {
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
}
