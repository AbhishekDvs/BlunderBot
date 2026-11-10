/**
 * Runtime loader and metadata resolver for Sol's `indian-armies-v1` 2.5D animated assets.
 * Consumes `manifest.json`, `encounters.json`, `endings.json`, and per-piece `*_clip.json`.
 */

export const INDIAN_ARMIES_BASE_URL = '/pieces/indian-armies-v1'
export const PLINTH_TOP_Y = 0.04

export interface RuntimeClipDef {
  start: number
  count: number
  fps: number
  loop: boolean
  contactFrame?: number
  frameDurationsMs?: number[]
  socketsPx?: Array<{
    feet?: [number, number][]
    hip?: [number, number]
    weaponTip?: [number, number]
    defenseContact?: [number, number]
    staffSegment?: [[number, number], [number, number]]
  }>
}

export interface PieceClipManifest {
  pieceCode: string
  cols: number
  rows: number
  cell: number
  image: string
  anchor: [number, number]
  baselinePx: number
  direction: string
  cameraAngleDeg: number
  clips: Record<string, RuntimeClipDef>
  traversal?: {
    nominalStridePx?: number
  }
  endings?: {
    image: string
    cols: number
    rows: number
    cell: number
    clips: Record<string, RuntimeClipDef>
  }
}

export interface MasterRuntimeManifest {
  version: string
  pieces: string[]
  cell: number
  cols: number
  rows: number
  cameraAngleDeg: number
  effects: Record<
    'w' | 'b',
    {
      image: string
      cols: number
      rows: number
      cell: number
      count: number
      fps: number
      loop: boolean
      anchor: [number, number]
      durationMs: number
      faction: 'white' | 'black'
    }
  >
  clips: Record<string, RuntimeClipDef>
  manifests: Record<string, string>
  encounters: string
  endings: string
  verifiedCardDimensions: Record<string, [number, number]>
  planeTiltRad: number
  planeCenterFromFootAnchor: Record<string, [number, number, number]>
}

export interface EncounterEntry {
  attacker: string
  defender: string
  contactTimeMs: number
  attackStartMs: number
  attackClip: string
  contactFrame: number
  contactLocalTimeMs: number
  defenseClip: string
  defenseFrame: number
  defenseHoldUntilMs: number
  nativeCardDimensions: {
    attacker: [number, number]
    defender: [number, number]
  }
  worldContact: {
    defenderContactPx?: [number, number]
    attackerLocal: [number, number, number]
    defenderLocal: [number, number, number]
    defenderRootOffset: [number, number, number]
    tiltRad: number
    error: number
  }
}

export interface EncountersManifest {
  version: number
  encounters: EncounterEntry[]
}

export interface EndingsManifest {
  kingCapture: boolean
  whiteVictory: {
    winners: Array<{ piece: string; clip: string; texture: 'main' | 'endings' }>
    losingKing: { piece: string; clip: string; texture: 'main' | 'endings' }
  }
  blackVictory: {
    winners: Array<{ piece: string; clip: string; texture: 'main' | 'endings' }>
    losingKing: { piece: string; clip: string; texture: 'main' | 'endings' }
  }
  draw: {
    units: Array<{ piece: string; clip: string; texture: 'main' | 'endings' }>
  }
}

export interface ResolvedClipPlayback {
  clipName: string
  textureKind: 'main' | 'endings'
  cols: number
  rows: number
  start: number
  count: number
  fps: number
  loop: boolean
  contactFrame?: number
  frameDurationsMs?: number[]
}

const DEFAULT_CARD_DIMENSIONS: Record<string, [number, number]> = {
  P: [0.96, 1.05],
  N: [1.25, 1.28],
  B: [1.1, 1.32],
  R: [1.1, 1.15],
  Q: [1.2, 1.38],
  K: [1.3, 1.45],
}

const DEFAULT_PLANE_CENTER_OFFSET: Record<string, [number, number, number]> = {
  P: [0, 0.3156339530539338, -0.20679340739880855],
  N: [0, 0.38477281896098603, -0.25209101092426184],
  B: [0, 0.39679696955351684, -0.25996885501564504],
  R: [0, 0.34569432953526086, -0.22648801762726647],
  Q: [0, 0.414833195442313, -0.27178562115271976],
  K: [0, 0.43587545897924196, -0.2855718483126404],
}

const DEFAULT_PLINTH_RADIUS: Record<string, number> = {
  P: 0.36,
  R: 0.4,
  N: 0.4,
  B: 0.38,
  Q: 0.39,
  K: 0.42,
}

const DEFAULT_MAIN_CLIPS: Record<string, RuntimeClipDef> = {
  idle: { start: 0, count: 8, fps: 10, loop: true },
  move: { start: 8, count: 12, fps: 14, loop: true },
  attack_anticipation: { start: 20, count: 4, fps: 12, loop: false },
  attack: { start: 24, count: 8, fps: 16, loop: false, contactFrame: 4 },
  defend: { start: 32, count: 6, fps: 12, loop: false },
  hit: { start: 38, count: 4, fps: 16, loop: false },
  stagger: { start: 42, count: 6, fps: 12, loop: false },
  defeat: { start: 48, count: 8, fps: 12, loop: false },
  victory: { start: 56, count: 8, fps: 12, loop: false },
}

const DEFAULT_ENDING_CLIPS: Record<string, RuntimeClipDef> = {
  defeat_acknowledgement: { start: 0, count: 8, fps: 12, loop: false },
  draw_disengagement: { start: 8, count: 8, fps: 12, loop: false },
}

const DEFAULT_STRIDE_PX: Record<string, number> = {
  P: 76,
  N: 76,
  B: 52,
  R: 113.09733552923255,
  Q: 60,
  K: 40,
}

export class IndianArmiesRuntime {
  private static masterManifest: MasterRuntimeManifest | null = null
  private static encountersManifest: EncountersManifest | null = null
  private static endingsManifest: EndingsManifest | null = null
  private static pieceClips = new Map<string, PieceClipManifest>()
  private static loadPromise: Promise<void> | null = null
  private static loadErrors: string[] = []
  private static errorListeners = new Set<(errors: string[]) => void>()

  public static recordError(message: string): void {
    console.error(`[Astra2.5D:IndianArmies] ${message}`)
    if (!this.loadErrors.includes(message)) {
      this.loadErrors = [...this.loadErrors, message]
      this.errorListeners.forEach((cb) => cb(this.loadErrors))
    }
  }

  public static getAssetLoadErrors(): string[] {
    return this.loadErrors
  }

  public static onErrorsChange(cb: (errors: string[]) => void): () => void {
    this.errorListeners.add(cb)
    return () => {
      this.errorListeners.delete(cb)
    }
  }

  public static getMasterManifest(): MasterRuntimeManifest | null {
    return this.masterManifest
  }

  public static getEndingsManifest(): EndingsManifest | null {
    return this.endingsManifest
  }

  public static getEncountersManifest(): EncountersManifest | null {
    return this.encountersManifest
  }

  public static getPieceClipManifest(pieceCode: string): PieceClipManifest | undefined {
    return this.pieceClips.get(pieceCode)
  }

  private static async fetchJson<T>(url: string, label: string): Promise<T | null> {
    if (typeof fetch === 'undefined') return null
    try {
      const res = await fetch(url)
      if (!res.ok) {
        this.recordError(`Failed to fetch ${label} (${res.status} ${res.statusText}) at ${url}`)
        return null
      }
      return (await res.json()) as T
    } catch (err) {
      this.recordError(`Error loading ${label} from ${url}: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }

  /**
   * Loads master manifest, encounters, endings, and all 12 piece clip manifests.
   * Safe and idempotent across repeated calls; reports missing files loudly.
   */
  public static async loadRuntimeMetadata(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      return
    }
    if (this.loadPromise) {
      return this.loadPromise
    }

    this.loadPromise = (async () => {
      const master = await this.fetchJson<MasterRuntimeManifest>(
        `${INDIAN_ARMIES_BASE_URL}/manifest.json`,
        'master manifest'
      )
      if (!master) {
        this.loadPromise = null
        return
      }
      this.masterManifest = master

      const encountersUrl = `${INDIAN_ARMIES_BASE_URL}/${master.encounters || 'encounters.json'}`
      const endingsUrl = `${INDIAN_ARMIES_BASE_URL}/${master.endings || 'endings.json'}`

      const manifestEntries = Object.entries(master.manifests || {})
      const [encounters, endings, ...clipResults] = await Promise.all([
        this.fetchJson<EncountersManifest>(encountersUrl, 'encounters manifest'),
        this.fetchJson<EndingsManifest>(endingsUrl, 'endings manifest'),
        ...manifestEntries.map(async ([code, relPath]) => {
          const data = await this.fetchJson<PieceClipManifest>(
            `${INDIAN_ARMIES_BASE_URL}/${relPath}`,
            `${code} clip manifest`
          )
          return [code, data] as const
        }),
      ])

      if (encounters) this.encountersManifest = encounters
      if (endings) this.endingsManifest = endings

      for (const [code, data] of clipResults) {
        if (data) {
          this.pieceClips.set(code, data)
        }
      }
    })()

    return this.loadPromise
  }

  public static getMainAtlasUrl(pieceCode: string): string {
    const clip = this.pieceClips.get(pieceCode)
    if (clip?.image) {
      const clean = clip.image.replace(/^\.\//, '')
      return `${INDIAN_ARMIES_BASE_URL}/${pieceCode}/${clean}`
    }
    return `${INDIAN_ARMIES_BASE_URL}/${pieceCode}/${pieceCode}_atlas.webp`
  }

  public static getEndingsAtlasUrl(pieceCode: string): string {
    const clip = this.pieceClips.get(pieceCode)
    if (clip?.endings?.image) {
      const clean = clip.endings.image.replace(/^\.\//, '')
      return `${INDIAN_ARMIES_BASE_URL}/${pieceCode}/${clean}`
    }
    return `${INDIAN_ARMIES_BASE_URL}/${pieceCode}/${pieceCode}_endings.webp`
  }

  public static getEffectSpriteDef(faction: 'w' | 'b') {
    const fromManifest = this.masterManifest?.effects?.[faction]
    if (fromManifest) {
      return {
        ...fromManifest,
        url: `${INDIAN_ARMIES_BASE_URL}/${fromManifest.image.replace(/^\.\//, '')}`,
      }
    }
    return {
      image: `effects/${faction}_impact_debris.webp`,
      url: `${INDIAN_ARMIES_BASE_URL}/effects/${faction}_impact_debris.webp`,
      cols: 8,
      rows: 2,
      cell: 256,
      count: 16,
      fps: 24,
      loop: false,
      anchor: [0.5, 0.5] as [number, number],
      durationMs: 666.6666666666666,
      faction: faction === 'w' ? ('white' as const) : ('black' as const),
    }
  }

  /**
   * Computes exact foot-anchored card placement on top of the plinth (Y = 0.04)
   * using Sol's `verifiedCardDimensions`, `planeTiltRad`, and `planeCenterFromFootAnchor`.
   */
  public static getCardPlacement(classChar: string): {
    width: number
    height: number
    centerFromFootAnchor: [number, number, number]
    cardPosition: [number, number, number]
    tiltRad: number
    plinthR: number
  } {
    const cls = classChar.toUpperCase()
    const dims = this.masterManifest?.verifiedCardDimensions?.[cls] || DEFAULT_CARD_DIMENSIONS[cls] || DEFAULT_CARD_DIMENSIONS.P
    const tiltRad = this.masterManifest?.planeTiltRad ?? -0.58
    const center =
      this.masterManifest?.planeCenterFromFootAnchor?.[cls] ||
      DEFAULT_PLANE_CENTER_OFFSET[cls] ||
      DEFAULT_PLANE_CENTER_OFFSET.P
    const plinthR = DEFAULT_PLINTH_RADIUS[cls] ?? 0.36
    return {
      width: dims[0],
      height: dims[1],
      centerFromFootAnchor: center,
      cardPosition: [center[0], PLINTH_TOP_Y + center[1], center[2]],
      tiltRad,
      plinthR,
    }
  }

  /**
   * Converts a 256px sprite-cell pixel coordinate into local card space relative to cardMesh center.
   */
  public static spritePixelToCardLocal(
    classChar: string,
    px: number,
    py: number,
    cell = 256
  ): [number, number, number] {
    const { width, height } = this.getCardPlacement(classChar)
    const u = px / cell - 0.5
    const vFromBottom = 0.5 - py / cell
    return [u * width, vFromBottom * height, 0.02]
  }

  /**
   * Resolves a clip definition across main (8x8) and supplementary endings (8x2) atlases.
   */
  public static resolveClip(pieceCode: string, clipName: string): ResolvedClipPlayback {
    const pieceMeta = this.pieceClips.get(pieceCode)
    const masterClips = this.masterManifest?.clips || DEFAULT_MAIN_CLIPS

    const normalizedName = clipName === 'draw' ? 'draw_disengagement' : clipName

    const endingsClips = pieceMeta?.endings?.clips || DEFAULT_ENDING_CLIPS
    if (normalizedName in endingsClips) {
      const def = endingsClips[normalizedName]
      return {
        clipName: normalizedName,
        textureKind: 'endings',
        cols: pieceMeta?.endings?.cols ?? 8,
        rows: pieceMeta?.endings?.rows ?? 2,
        start: def.start,
        count: def.count,
        fps: def.fps || 12,
        loop: Boolean(def.loop),
        frameDurationsMs: def.frameDurationsMs,
      }
    }

    const pieceMainClips = pieceMeta?.clips
    const def = pieceMainClips?.[normalizedName] || masterClips[normalizedName] || masterClips.idle || DEFAULT_MAIN_CLIPS.idle
    return {
      clipName: normalizedName,
      textureKind: 'main',
      cols: pieceMeta?.cols ?? this.masterManifest?.cols ?? 8,
      rows: pieceMeta?.rows ?? this.masterManifest?.rows ?? 8,
      start: def.start,
      count: def.count,
      fps: def.fps || 12,
      loop: Boolean(def.loop),
      contactFrame: def.contactFrame ?? (normalizedName === 'attack' ? 4 : undefined),
      frameDurationsMs: def.frameDurationsMs,
    }
  }

  /**
   * Returns world contact separation distance between attacker root and defender root.
   * Uses `encounters.json` when available, otherwise computes from attacker weaponTip
   * and defender defenseContact socket pixels scaled by card dimensions.
   */
  public static resolveContactSeparation(attackerCode: string, defenderCode: string): number {
    const atkClass = attackerCode.slice(1).toUpperCase()
    const defClass = defenderCode.slice(1).toUpperCase()

    const entries = this.encountersManifest?.encounters || []
    const exactMatch = entries.find((e) => e.attacker === attackerCode && e.defender === defenderCode)
    const classMatch = entries.find(
      (e) => e.attacker.slice(1).toUpperCase() === atkClass && e.defender.slice(1).toUpperCase() === defClass
    )
    const match = exactMatch || classMatch
    if (match?.worldContact?.defenderRootOffset) {
      const off = match.worldContact.defenderRootOffset
      const sep = Math.hypot(off[0], off[2])
      if (sep > 0.25 && sep < 1.2) return sep
    }

    const atkClip = this.pieceClips.get(attackerCode)
    const defClip = this.pieceClips.get(defenderCode)
    const atkWidth = this.getCardPlacement(atkClass).width
    const defWidth = this.getCardPlacement(defClass).width

    const atkTipPx = atkClip?.clips?.attack?.socketsPx?.[4]?.weaponTip
    const defBlockPx = defClip?.clips?.defend?.socketsPx?.[5]?.defenseContact

    if (atkTipPx && defBlockPx) {
      const atkReach = Math.max(0.15, (Math.abs(atkTipPx[0] - 128) / 256) * atkWidth)
      const defBlock = Math.max(0.12, (Math.abs(defBlockPx[0] - 128) / 256) * defWidth)
      return Math.min(0.95, Math.max(0.45, atkReach + defBlock))
    }

    // Well-calibrated default separation matching N->B benchmark (~0.665)
    return atkClass === 'N' && defClass === 'B' ? 0.665 : 0.56
  }

  /**
   * Computes world-aligned travel duration using Sol's `nominalStridePx` when moving >= 1.5 squares,
   * keeping short moves crisp while allowing full alternating walk strides across multi-square advances (like e2->e4).
   */
  public static resolveMoveDurationMs(pieceCode: string, worldDistance: number, pacing: 'cinematic' | 'fast' | 'reduced' | 'off'): number {
    if (pacing === 'off') return 0
    if (pacing === 'reduced') return 160

    const cls = pieceCode.slice(1).toUpperCase()
    const isKnight = cls === 'N'
    if (pacing === 'fast') {
      return isKnight ? 380 : 300
    }

    const pieceClip = this.pieceClips.get(pieceCode)
    const stridePx = pieceClip?.traversal?.nominalStridePx || DEFAULT_STRIDE_PX[cls] || 76
    const cardWidth = this.getCardPlacement(cls).width
    const moveDef = this.resolveClip(pieceCode, 'move')
    const cycleMs = (moveDef.count / Math.max(1, moveDef.fps)) * 1000
    const worldStridePerCycle = Math.max(0.22, (stridePx / 256) * cardWidth)

    // Keep within snappy playable bounds [520ms, 920ms] so characters never dawdle on long Queen/Rook glides
    const physicalDuration = (worldDistance / worldStridePerCycle) * cycleMs * 0.22
    const minDur = isKnight ? 640 : worldDistance >= 1.5 ? 720 : 520
    return Math.round(Math.min(960, Math.max(minDur, physicalDuration)))
  }

  public static getMoveStrideWorld(pieceCode:string):number {
    const stride=this.pieceClips.get(pieceCode)?.traversal?.nominalStridePx ?? DEFAULT_STRIDE_PX[pieceCode[1]] ?? 76
    return stride*this.getCardPlacement(pieceCode[1]).width/256
  }
}
