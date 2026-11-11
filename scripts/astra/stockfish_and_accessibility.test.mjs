import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { StockfishProtocolController } from '../../apps/frontend/src/lib/stockfish/engineProtocol.ts'
import { boardAnimationDuration } from '../../apps/frontend/src/lib/astra/motion.ts'

const presetsSource = readFileSync(new URL('../../apps/frontend/src/theme/themePresets.ts', import.meta.url), 'utf8')
const presetsCompiled = ts.transpileModule(presetsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const presetsCtx = { exports: {} }
vm.runInNewContext(presetsCompiled, presetsCtx)
const { DEFAULT_THEME_SETTINGS, enforceAssetAvailability } = presetsCtx.exports

test('StockfishProtocolController queues commands until readyok and delivers valid bestmove', () => {
  const sent = []
  const moves = []
  const statuses = []
  const ctrl = new StockfishProtocolController({
    sendRaw: (cmd) => sent.push(cmd),
    onBestMove: (m) => moves.push(m),
    onStatusChange: (s) => statuses.push(s.status),
  })

  ctrl.startHandshake()
  assert.deepEqual(sent, ['uci'])

  // Commands sent before readyok must be queued
  ctrl.postMessage('ucinewgame')
  ctrl.postMessage('position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
  ctrl.postMessage('go depth 3')
  assert.deepEqual(sent, ['uci'])

  ctrl.handleWorkerMessage('uciok')
  ctrl.handleWorkerMessage('readyok')
  assert.deepEqual(sent, [
    'uci',
    'isready',
    'ucinewgame',
    'position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'go depth 3',
  ])
  assert.equal(ctrl.getSnapshot().isSearching, true)

  ctrl.handleWorkerMessage('bestmove d7d5 ponder e4d5')
  assert.deepEqual(moves, ['d7d5'])
  assert.equal(ctrl.getSnapshot().isSearching, false)
  assert.equal(statuses.at(-1), 'ready')
})

test('StockfishProtocolController cancels in-flight search on reset/stop and discards stale bestmove', () => {
  const sent = []
  const moves = []
  const ctrl = new StockfishProtocolController({
    sendRaw: (cmd) => sent.push(cmd),
    onBestMove: (m) => moves.push(m),
  })

  ctrl.startHandshake()
  ctrl.handleWorkerMessage('readyok')
  ctrl.postMessage('ucinewgame')
  ctrl.postMessage('position fen startpos')
  ctrl.postMessage('go depth 20')
  assert.equal(ctrl.getSnapshot().isSearching, true)

  // User restarts match mid-search
  ctrl.cancelSearch()
  assert.equal(sent.at(-1), 'stop')
  assert.equal(ctrl.getSnapshot().isSearching, false)
  assert.equal(ctrl.getSnapshot().supersededCount, 1)

  // Start a new search (e.g. player chose Black)
  ctrl.postMessage('ucinewgame')
  ctrl.postMessage('position fen startpos')
  ctrl.postMessage('go depth 3')

  // Old aborted bestmove arrives first -> must be discarded
  ctrl.handleWorkerMessage('bestmove e7e5')
  assert.deepEqual(moves, [])
  assert.equal(ctrl.getSnapshot().isSearching, true)

  // New search bestmove arrives -> must be delivered
  ctrl.handleWorkerMessage('bestmove d2d4')
  assert.deepEqual(moves, ['d2d4'])
  assert.equal(ctrl.getSnapshot().isSearching, false)
})

test('StockfishProtocolController prevents duplicate AI moves when a new search supersedes an active one', () => {
  const sent = []
  const moves = []
  const ctrl = new StockfishProtocolController({
    sendRaw: (cmd) => sent.push(cmd),
    onBestMove: (m) => moves.push(m),
  })

  ctrl.startHandshake()
  ctrl.handleWorkerMessage('readyok')
  ctrl.postMessage('go depth 10')
  ctrl.postMessage('ucinewgame')
  ctrl.postMessage('position fen startpos')
  ctrl.postMessage('go depth 3')

  // First bestmove belongs to superseded depth 10 search
  ctrl.handleWorkerMessage('bestmove c7c5')
  assert.deepEqual(moves, [])
  // Second bestmove belongs to active depth 3 search
  ctrl.handleWorkerMessage('bestmove e2e4')
  assert.deepEqual(moves, ['e2e4'])
})

test('StockfishProtocolController surfaces worker load failure and ignores post-termination messages', () => {
  const sent = []
  const moves = []
  const ctrl = new StockfishProtocolController({
    sendRaw: (cmd) => sent.push(cmd),
    onBestMove: (m) => moves.push(m),
  })

  ctrl.handleWorkerMessage('Failed to load stockfish.js: network error')
  assert.equal(ctrl.getSnapshot().status, 'error')
  assert.match(ctrl.getSnapshot().error, /Failed to load stockfish\.js/)

  ctrl.postMessage('go depth 3')
  assert.deepEqual(sent, [])

  ctrl.terminate()
  assert.equal(ctrl.getSnapshot().status, 'terminated')
  ctrl.handleWorkerMessage('bestmove e2e4')
  assert.deepEqual(moves, [])
})

test('Animation disabled mode and invalid persisted theme settings fall back safely', () => {
  assert.equal(boardAnimationDuration('off', false, 'white'), 0)
  assert.equal(boardAnimationDuration('off', true, 'white'), 0)
  assert.equal(boardAnimationDuration('system', true, 'white'), 100)

  const sanitized = enforceAssetAvailability({
    ...DEFAULT_THEME_SETTINGS,
    boardPresetId: 'unknown-preset',
    pieceSetId: 'unknown-set',
  })
  assert.equal(sanitized.boardPresetId, DEFAULT_THEME_SETTINGS.boardPresetId)
  assert.equal(sanitized.pieceSetId, DEFAULT_THEME_SETTINGS.pieceSetId)
})
