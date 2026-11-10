import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ATLAS_DIR = path.resolve(__dirname, '../../apps/frontend/public/pieces/2p5d-animated')

const source = readFileSync(new URL('../../apps/frontend/src/theme/themePresets.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(compiled, context)
const { DEFAULT_THEME_SETTINGS, PIECE_SETS, BOARD_PRESETS, enforceAssetAvailability } = context.exports

test('2.5D animated war chess atlases and manifests exist and White/Black factions are distinct', () => {
  const masterPath = path.join(ATLAS_DIR, 'manifest.json')
  assert.ok(existsSync(masterPath), 'Missing master 2p5d-animated/manifest.json')
  const master = JSON.parse(readFileSync(masterPath, 'utf8'))
  assert.equal(master.cameraAngleDeg, 48)
  assert.equal(master.cols, 8)
  assert.equal(master.rows, 8)
  assert.equal(master.cell, 256)

  const classes = ['P', 'N', 'B', 'R', 'Q', 'K']
  for (const cls of classes) {
    const wCode = `w${cls}`
    const bCode = `b${cls}`
    assert.ok(master.pieces.includes(wCode), `Master manifest missing ${wCode}`)
    assert.ok(master.pieces.includes(bCode), `Master manifest missing ${bCode}`)

    const wAtlas = path.join(ATLAS_DIR, `${wCode}_atlas.webp`)
    const bAtlas = path.join(ATLAS_DIR, `${bCode}_atlas.webp`)
    const wBack = path.join(ATLAS_DIR, `${wCode}_back_atlas.webp`)
    const bBack = path.join(ATLAS_DIR, `${bCode}_back_atlas.webp`)
    for (const file of [wAtlas, bAtlas, wBack, bBack]) {
      assert.ok(existsSync(file), `Missing atlas file: ${file}`)
      const size = statSync(file).size
      assert.ok(size > 50_000, `Atlas suspiciously small (${size} bytes): ${file}`)
      const hdr = readFileSync(file).subarray(0, 12)
      assert.equal(hdr.subarray(0, 4).toString('ascii'), 'RIFF', `Invalid RIFF header in ${file}`)
      assert.equal(hdr.subarray(8, 12).toString('ascii'), 'WEBP', `Invalid WEBP header in ${file}`)
    }

    const wHash = crypto.createHash('md5').update(readFileSync(wAtlas)).digest('hex')
    const bHash = crypto.createHash('md5').update(readFileSync(bAtlas)).digest('hex')
    assert.notEqual(wHash, bHash, `White and Black atlases must not be identical for class ${cls}`)

    for (const code of [wCode, bCode]) {
      const clipPath = path.join(ATLAS_DIR, `${code}_clip.json`)
      assert.ok(existsSync(clipPath), `Missing clip manifest: ${clipPath}`)
      const clipJson = JSON.parse(readFileSync(clipPath, 'utf8'))
      for (const reqClip of ['idle', 'move', 'attack_anticipation', 'attack', 'defend', 'hit', 'stagger', 'defeat', 'victory', 'draw']) {
        assert.ok(clipJson.clips?.[reqClip], `Missing clip '${reqClip}' in ${code}_clip.json`)
      }
    }
  }
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
