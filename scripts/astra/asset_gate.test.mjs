import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../../apps/frontend/src/theme/themePresets.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(compiled, context)
const { DEFAULT_THEME_SETTINGS, PIECE_SETS, BOARD_PRESETS, enforceAssetAvailability } = context.exports

test('default and selectable armies exclude unapproved ASTRA placeholders', () => {
  assert.equal(PIECE_SETS['astra-medieval'].isAvailable, false)
  assert.equal(DEFAULT_THEME_SETTINGS.pieceSetId, 'default')
  assert.notEqual(DEFAULT_THEME_SETTINGS.boardPresetId, 'ancient-battlefield')
  assert.match(BOARD_PRESETS['ancient-battlefield'].name, /Experimental/)
})

test('persisted or programmatic unavailable army selection falls back without changing preferences', () => {
  const result = enforceAssetAvailability({ ...DEFAULT_THEME_SETTINGS, pieceSetId: 'astra-medieval', soundEnabled: false, showCoordinates: false })
  assert.equal(result.pieceSetId, 'default')
  assert.equal(result.soundEnabled, false)
  assert.equal(result.showCoordinates, false)
})

test('available sets survive validation; unknown IDs fall back', () => {
  for (const id of ['default', 'pirouetti', 'chestnut']) {
    assert.equal(enforceAssetAvailability({ ...DEFAULT_THEME_SETTINGS, pieceSetId: id }).pieceSetId, id)
  }
  const result = enforceAssetAvailability({ ...DEFAULT_THEME_SETTINGS, pieceSetId: 'missing', boardPresetId: 'missing' })
  assert.equal(result.pieceSetId, DEFAULT_THEME_SETTINGS.pieceSetId)
  assert.equal(result.boardPresetId, DEFAULT_THEME_SETTINGS.boardPresetId)
})
