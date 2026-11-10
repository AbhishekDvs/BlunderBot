import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { PieceBuilder3D } from '../../apps/frontend/src/lib/three/pieceBuilder.ts'
import { IndianArmiesRuntime } from '../../apps/frontend/src/lib/three/indianArmiesRuntime.ts'
import { GameEndingDirector3D } from '../../apps/frontend/src/lib/three/gameEndingDirector.ts'
import { CameraController3D } from '../../apps/frontend/src/lib/three/cameraController.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ATLAS_DIR = path.resolve(__dirname, '../../apps/frontend/public/pieces/indian-armies-v1')

const source = readFileSync(new URL('../../apps/frontend/src/theme/themePresets.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(compiled, context)
const { DEFAULT_THEME_SETTINGS, PIECE_SETS, BOARD_PRESETS, enforceAssetAvailability } = context.exports

function assertValidWebp(filePath, minBytes) {
  assert.ok(existsSync(filePath), `Missing WebP asset: ${filePath}`)
  const size = statSync(filePath).size
  assert.ok(size > minBytes, `WebP asset suspiciously small (${size} bytes): ${filePath}`)
  const hdr = readFileSync(filePath).subarray(0, 12)
  assert.equal(hdr.subarray(0, 4).toString('ascii'), 'RIFF', `Invalid RIFF header in ${filePath}`)
  assert.equal(hdr.subarray(8, 12).toString('ascii'), 'WEBP', `Invalid WEBP header in ${filePath}`)
}

test('Sol 2.5D animated war chess atlases, endings, effects, foot anchors, and manifests exist and factions are distinct', () => {
  const masterPath = path.join(ATLAS_DIR, 'manifest.json')
  const encountersPath = path.join(ATLAS_DIR, 'encounters.json')
  const endingsPath = path.join(ATLAS_DIR, 'endings.json')
  assert.ok(existsSync(masterPath), 'Missing master indian-armies-v1/manifest.json')
  assert.ok(existsSync(encountersPath), 'Missing indian-armies-v1/encounters.json')
  assert.ok(existsSync(endingsPath), 'Missing indian-armies-v1/endings.json')

  const master = JSON.parse(readFileSync(masterPath, 'utf8'))
  assert.equal(master.cameraAngleDeg, 48)
  assert.equal(master.cols, 8)
  assert.equal(master.rows, 8)
  assert.equal(master.cell, 256)
  assert.equal(master.planeTiltRad, -0.58)

  // Effects sprites
  for (const faction of ['w', 'b']) {
    const effectRel = master.effects?.[faction]?.image
    assert.ok(effectRel, `Missing master effects entry for faction ${faction}`)
    assertValidWebp(path.join(ATLAS_DIR, effectRel), 25_000)
  }

  // Encounters manifest & N->B benchmark
  const encounters = JSON.parse(readFileSync(encountersPath, 'utf8'))
  const wNbB = encounters.encounters?.find((e) => e.attacker === 'wN' && e.defender === 'bB')
  assert.ok(wNbB, 'Missing wN -> bB encounter entry in encounters.json')
  assert.equal(wNbB.contactFrame, 4)

  // Endings manifest
  const endings = JSON.parse(readFileSync(endingsPath, 'utf8'))
  assert.equal(endings.kingCapture, false)
  assert.equal(endings.whiteVictory?.losingKing?.clip, 'defeat_acknowledgement')
  assert.equal(endings.blackVictory?.losingKing?.clip, 'defeat_acknowledgement')
  assert.ok(endings.draw?.units?.every((u) => u.clip === 'draw_disengagement'))

  const classes = ['P', 'N', 'B', 'R', 'Q', 'K']
  for (const cls of classes) {
    assert.ok(master.verifiedCardDimensions?.[cls], `Missing verifiedCardDimensions for ${cls}`)
    assert.ok(master.planeCenterFromFootAnchor?.[cls], `Missing planeCenterFromFootAnchor for ${cls}`)

    const wCode = `w${cls}`
    const bCode = `b${cls}`
    assert.ok(master.pieces.includes(wCode), `Master manifest missing ${wCode}`)
    assert.ok(master.pieces.includes(bCode), `Master manifest missing ${bCode}`)

    const wAtlas = path.join(ATLAS_DIR, wCode, `${wCode}_atlas.webp`)
    const bAtlas = path.join(ATLAS_DIR, bCode, `${bCode}_atlas.webp`)
    const wEnding = path.join(ATLAS_DIR, wCode, `${wCode}_endings.webp`)
    const bEnding = path.join(ATLAS_DIR, bCode, `${bCode}_endings.webp`)

    assertValidWebp(wAtlas, 50_000)
    assertValidWebp(bAtlas, 50_000)
    assertValidWebp(wEnding, 20_000)
    assertValidWebp(bEnding, 20_000)

    const wHash = crypto.createHash('md5').update(readFileSync(wAtlas)).digest('hex')
    const bHash = crypto.createHash('md5').update(readFileSync(bAtlas)).digest('hex')
    assert.notEqual(wHash, bHash, `White and Black main atlases must not be identical for class ${cls}`)

    const wEndHash = crypto.createHash('md5').update(readFileSync(wEnding)).digest('hex')
    const bEndHash = crypto.createHash('md5').update(readFileSync(bEnding)).digest('hex')
    assert.notEqual(wEndHash, bEndHash, `White and Black ending atlases must not be identical for class ${cls}`)

    for (const code of [wCode, bCode]) {
      const clipPath = path.join(ATLAS_DIR, code, `${code}_clip.json`)
      assert.ok(existsSync(clipPath), `Missing clip manifest: ${clipPath}`)
      const clipJson = JSON.parse(readFileSync(clipPath, 'utf8'))
      assert.deepEqual(clipJson.anchor, [0.5, 0.859375], `Unexpected foot pivot anchor in ${code}_clip.json`)
      assert.equal(clipJson.baselinePx, 220)
      assert.ok((clipJson.traversal?.nominalStridePx ?? 0) > 0, `Missing nominalStridePx in ${code}_clip.json`)
      for (const reqClip of ['idle', 'move', 'attack_anticipation', 'attack', 'defend', 'hit', 'stagger', 'defeat', 'victory']) {
        assert.ok(clipJson.clips?.[reqClip], `Missing main clip '${reqClip}' in ${code}_clip.json`)
      }
      assert.ok(clipJson.endings?.clips?.defeat_acknowledgement, `Missing defeat_acknowledgement ending clip in ${code}_clip.json`)
      assert.ok(clipJson.endings?.clips?.draw_disengagement, `Missing draw_disengagement ending clip in ${code}_clip.json`)
    }
  }
})

test('2.5D runtime applies foot-pivot anchoring and supplementary ending clips cleanly', () => {
  PieceBuilder3D.setManifest('2p5d-stylized')
  const placement = IndianArmiesRuntime.getCardPlacement('P')
  const pawnNode = PieceBuilder3D.createPieceNode('wP', 'e2', '2p5d-stylized')
  assert.ok(pawnNode.cardMesh, 'Expected 2.5D Pawn cardMesh')
  assert.ok(
    Math.abs(pawnNode.cardMesh.position.y - placement.cardPosition[1]) < 1e-6,
    'Pawn cardMesh Y position must honor foot-pivot anchor on plinth top'
  )
  assert.ok(
    Math.abs(pawnNode.cardMesh.position.z - placement.cardPosition[2]) < 1e-6,
    'Pawn cardMesh Z offset must honor tilted foot-pivot anchor'
  )

  const bKing = PieceBuilder3D.createPieceNode('bK', 'e8', '2p5d-stylized')
  const wPawn = PieceBuilder3D.createPieceNode('wP', 'e4', '2p5d-stylized')
  const cam = new CameraController3D()
  const endingDirector = new GameEndingDirector3D(cam)
  const nodes = new Map([
    ['e8', bKing],
    ['e4', wPawn],
  ])

  endingDirector.triggerEnding('white_wins', nodes)
  assert.equal(bKing.group.visible, true, 'Losing king must remain visible on checkmate')
  assert.ok(Math.abs(bKing.group.rotation.x) <= 0.05, '2.5D losing king plinth must remain grounded on board')
  assert.equal(bKing.animator?.currentClip, 'defeat_acknowledgement')
  assert.equal(wPawn.animator?.currentClip, 'victory')

  endingDirector.triggerEnding('draw', nodes)
  assert.equal(bKing.animator?.currentClip, 'draw_disengagement')
  assert.equal(wPawn.animator?.currentClip, 'draw_disengagement')
})

test('production Astra 2.5D army and ancient battlefield board are enabled cleanly', () => {
  assert.equal(PIECE_SETS['astra-medieval'].isAvailable, true)
  assert.equal(DEFAULT_THEME_SETTINGS.pieceSetId, 'astra-medieval')
  assert.equal(DEFAULT_THEME_SETTINGS.boardPresetId, 'ancient-battlefield')
  assert.doesNotMatch(BOARD_PRESETS['ancient-battlefield'].name, /Experimental/i)
})

test('persisted or programmatic unavailable or unknown army selection falls back without changing preferences', () => {
  const unavailablePieceResult = enforceAssetAvailability({
    ...DEFAULT_THEME_SETTINGS,
    pieceSetId: 'nonexistent-army',
    soundEnabled: false,
    showCoordinates: false,
  })
  assert.equal(unavailablePieceResult.pieceSetId, DEFAULT_THEME_SETTINGS.pieceSetId)
  assert.equal(unavailablePieceResult.soundEnabled, false)
  assert.equal(unavailablePieceResult.showCoordinates, false)
})

test('available sets survive validation; unknown IDs fall back', () => {
  for (const id of ['default', 'pirouetti', 'chestnut', 'astra-medieval']) {
    assert.equal(enforceAssetAvailability({ ...DEFAULT_THEME_SETTINGS, pieceSetId: id }).pieceSetId, id)
  }
  const result = enforceAssetAvailability({ ...DEFAULT_THEME_SETTINGS, pieceSetId: 'missing', boardPresetId: 'missing' })
  assert.equal(result.pieceSetId, DEFAULT_THEME_SETTINGS.pieceSetId)
  assert.equal(result.boardPresetId, DEFAULT_THEME_SETTINGS.boardPresetId)
})
