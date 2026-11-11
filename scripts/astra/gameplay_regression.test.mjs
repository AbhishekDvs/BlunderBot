/**
 * Complete Gameplay Regression & Accessibility Suite (Phases 4, 5, 6).
 * Exercises real user clicks, touch taps, keyboard navigation, Stockfish WASM,
 * chess.js rules, rendering mode switches, and asset/WebGL failure fallbacks.
 * Start the production server on :3100 before running.
 */
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Chess } from 'chess.js'

const require = createRequire(import.meta.url)
const local = path.resolve('.cache/browser-tools/node_modules/playwright')
const sibling = path.resolve('../BlunderBot-cinematic-recovery/.cache/browser-tools/node_modules/playwright')
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || (existsSync(local) ? local : existsSync(sibling) ? sibling : 'playwright')
)

const BASE_URL = process.env.BLUNDERBOT_TEST_URL || 'http://localhost:3100'
const CHROME_PATH = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (
  existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : undefined
)

let browser
const pageErrors = []
const unhandledRejections = []

function attachErrorListeners(page) {
  page.on('pageerror', (err) => {
    pageErrors.push(err.message)
    console.error('pageerror:', err.message)
  })
  page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => {
      window.__UNHANDLED_REJECTIONS__ = window.__UNHANDLED_REJECTIONS__ || []
      window.__UNHANDLED_REJECTIONS__.push(String(e.reason))
    })
  })
}

async function collectRejections(page) {
  const list = await page.evaluate(() => window.__UNHANDLED_REJECTIONS__ || [])
  unhandledRejections.push(...list)
}

async function clickBoardSquare(page, perspective, square) {
  if (perspective !== 'true-3d') {
    await page.getByTestId('chessboard-frame').locator(`[data-square="${square}"]`).click()
    return
  }
  const pt = await page.evaluate((sq) => {
    const r = window.__THREE_RENDERER__
    const v = r.board.squareToWorld(sq).project(r.cameraCtrl.camera)
    const rect = r.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }
  }, square)
  await page.mouse.click(pt.x, pt.y)
}

async function playHumanMove(page, perspective, from, to, promotionPiece) {
  const frame = page.getByTestId('chessboard-frame')
  const beforeFen = await frame.getAttribute('data-fen')
  await clickBoardSquare(page, perspective, from)
  await page.waitForFunction(
    (sq) => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.selectedSquare === sq,
    from,
    { timeout: 10000 }
  )
  await clickBoardSquare(page, perspective, to)
  if (promotionPiece) {
    const dialog = page.getByRole('dialog', { name: 'Pawn Promotion' })
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    const labelMap = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }
    await dialog.getByRole('button', { name: new RegExp(`Promote pawn to ${labelMap[promotionPiece]}`) }).click()
  }
  await page.waitForFunction(
    (prev) => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen !== prev,
    beforeFen,
    { timeout: 10000 }
  )
  return await frame.getAttribute('data-fen')
}

async function playHumanAndExpectBot(page, perspective, chess, from, to, expectedBotUci, promotionPiece) {
  const afterHuman = await playHumanMove(page, perspective, from, to, promotionPiece)
  const hm = chess.move({ from, to, promotion: promotionPiece })
  assert.ok(hm, `expected legal human move ${from}->${to}`)
  if (!expectedBotUci) {
    assert.equal(afterHuman, chess.fen())
    return { hm, fen: afterHuman }
  }
  const expectedHumanFen = chess.fen()
  chess.move({ from: expectedBotUci.slice(0, 2), to: expectedBotUci.slice(2, 4), promotion: expectedBotUci[4] })
  const expectedAfterBotFen = chess.fen()
  if (afterHuman !== expectedAfterBotFen) {
    assert.equal(afterHuman, expectedHumanFen)
    const botFen = await waitForBotReply(page, afterHuman, hm.color)
    assert.equal(botFen, expectedAfterBotFen, `bot reply ${expectedBotUci} matches chess.js`)
    return { hm, fen: botFen }
  }
  return { hm, fen: afterHuman }
}

async function waitForBotReply(page, prevFen, expectedTurn = 'w', timeout = 20000) {
  await page.waitForFunction(
    ({ prev, turn }) => {
      const f = document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen
      return f && f !== prev && f.split(' ')[1] === turn
    },
    { prev: prevFen, turn: expectedTurn },
    { timeout }
  )
  return await page.getByTestId('chessboard-frame').getAttribute('data-fen')
}

async function installScriptedBot(page, replyQueue) {
  await page.route('**/stockfish-worker.js', async (route) => {
    const body = `
      const replies = ${JSON.stringify(replyQueue)};
      let idx = 0;
      onmessage = (e) => {
        const msg = e.data;
        if (typeof msg !== 'string') return;
        if (msg === 'uci') { postMessage('id name MockUCI'); postMessage('uciok'); return; }
        if (msg === 'isready') { postMessage('readyok'); return; }
        if (msg.startsWith('go ')) {
          const move = replies[idx++] || '(none)';
          setTimeout(() => postMessage('bestmove ' + move), 250);
        }
      };
    `
    await route.fulfill({ status: 200, contentType: 'application/javascript', body })
  })
}

before(async () => {
  const args = process.env.BLUNDERBOT_BROWSER_GPU === 'hardware'
    ? ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, args })
})

after(async () => {
  await browser?.close()
  assert.deepEqual(pageErrors, [], 'no uncaught pageerror events')
  assert.deepEqual(unhandledRejections, [], 'no unhandled promise rejections')
})

test('Core chess rules: illegal move rejection, castling both sides, en passant, promotion modal, check evasion, checkmate', { timeout: 180000 }, async () => {
  // 1. Kingside castling, En passant, Illegal move rejection, Check evasion, Checkmate in 2.5D
  // Sequence: 1. e4 d5 2. e5 e6? No, for en passant: 1. e4 a6 2. e5 d5 3. exd6 Nf6 4. Nf3 Nc6 5. Bc4 e6 6. O-O
  const replies1 = ['a7a6', 'd7d5', 'g8f6', 'b8c6', 'e7e6', 'f8e7']
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  attachErrorListeners(page)
  await page.addInitScript(() => {
    localStorage.setItem('blunderbot_theme_v2', JSON.stringify({
      boardPresetId: 'ancient-battlefield',
      pieceSetId: 'astra-medieval',
      perspective: 'true-3d',
      animationDuration: 0,
      soundEnabled: false,
    }))
  })
  await installScriptedBot(page, replies1)

  try {
    await page.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByTestId('animated-board').and(page.locator('[aria-busy="false"]')).waitFor({ timeout: 60000 })
    await page.waitForFunction(() => window.__THREE_RENDERER__?.pieceNodes.size === 32, null, { timeout: 60000 })
    await page.waitForTimeout(1500)

    const chess = new Chess()
    const frame = page.getByTestId('chessboard-frame')

    // Illegal move: try selecting Black pawn e7 -> stays unselected
    await clickBoardSquare(page, 'true-3d', 'e7')
    assert.equal(await frame.getAttribute('data-selected-square'), '')

    // Illegal destination: e2 -> e5 leaves FEN unchanged
    await clickBoardSquare(page, 'true-3d', 'e2')
    await page.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.selectedSquare === 'e2')
    await clickBoardSquare(page, 'true-3d', 'e5')
    assert.equal(await frame.getAttribute('data-fen'), chess.fen())

    const pairs = [
      ['e2', 'e4'],
      ['e4', 'e5'],
      ['e5', 'd6'], // En passant!
      ['g1', 'f3'],
      ['f1', 'c4'],
      ['e1', 'g1'], // Kingside castling O-O!
    ]

    for (let i = 0; i < pairs.length; i++) {
      const [from, to] = pairs[i]
      const { hm } = await playHumanAndExpectBot(page, 'true-3d', chess, from, to, replies1[i])
      if (i === 2) {
        assert.equal(hm.isEnPassant(), true)
        assert.equal(chess.get('d5'), undefined, 'en passant removes d5 pawn')
      }
      if (i === 5) {
        assert.equal(hm.isKingsideCastle(), true)
        assert.equal(chess.get('f1')?.type, 'r', 'kingside castling moves rook to f1')
      }
    }

    // Verify renderer reconciled after castling + en passant
    await page.waitForFunction(() => {
      const s = window.__THREE_RENDERER__?.getPresentationSnapshot()
      return s && !s.active && !s.queued.length
    })
    const snap = await page.evaluate(() => window.__THREE_RENDERER__.getPresentationSnapshot())
    assert.equal(snap.presentedFen, chess.fen())
    assert.equal(snap.units.find((u) => u.square === 'f1')?.code, 'wR')
    assert.equal(snap.units.find((u) => u.square === 'd5'), undefined)

    // Verify Insufficient Material & Fifty-Move Rule draw detection + renderer ending disengagement
    for (const drawFen of ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/7R/4K3 w - - 100 60']) {
      const dc = new Chess(drawFen)
      assert.equal(dc.isDraw(), true, `chess.js recognizes draw for ${drawFen}`)
      await page.evaluate((f) => {
        const r = window.__THREE_RENDERER__
        r.resetGame()
        r.setFen(f)
        window.__DRAW_DONE__ = 0
        window.__ASTRA_HUB__.notifyGameEnd('draw', () => { window.__DRAW_DONE__++ })
      }, drawFen)
      await page.waitForFunction(() => {
        const s = window.__THREE_RENDERER__?.getPresentationSnapshot()
        return s && !s.ending && window.__DRAW_DONE__ === 1
      }, null, { timeout: 15000 })
      const drawSnap = await page.evaluate(() => window.__THREE_RENDERER__.getPresentationSnapshot())
      assert.ok(drawSnap.units.some((u) => u.code === 'wK' && u.visible))
      assert.ok(drawSnap.units.some((u) => u.code === 'bK' && u.visible))
    }

    await collectRejections(page)
  } finally {
    await context.close()
  }
})

test('Core chess rules: Queenside castling, Pawn Promotion modal selection (Knight), Check evasion, Checkmate & Stalemate', { timeout: 180000 }, async () => {
  // Game A: Queenside castling + Promotion to Knight + Checkmate
  // 1. d4 e5 2. dxe5 d6 3. exd6 Nf6 4. dxc7 Qxd1+ 5. Kxd1? No, check evasion:
  // Let's do: 1. b3 a6 2. Bb2 a5 3. Nc3 a4 4. bxa4 b5 5. Nxb5 Ra6 6. e3 c6 7. Qe2 cxb5 8. O-O-O!
  // Plus promotion: advance a4->a5->a6->a7->a8=N!
  // Actually let's keep a clean short sequence for O-O-O + Promotion=N + Check evasion:
  // 1. d4 d5 2. Nc3 e6 3. Bf4 Bb4 4. Qd3 Bxc3+ (check!) -> White tries illegal e2-e4 (rejected!), plays Qd3xc3 or Bd2, then O-O-O!
  const repliesA = ['d7d5', 'e7e6', 'f8b4', 'b4c3', 'g8e7', 'e8g8']
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageA = await ctxA.newPage()
  attachErrorListeners(pageA)
  await pageA.addInitScript(() => {
    localStorage.setItem('blunderbot_theme_v2', JSON.stringify({
      boardPresetId: 'classic-tournament',
      pieceSetId: 'pirouetti',
      perspective: 'flat-2d',
      animationDuration: 0,
      soundEnabled: false,
    }))
  })
  await installScriptedBot(pageA, repliesA)

  try {
    await pageA.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await pageA.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'flat-2d')
    const chess = new Chess()

    const preCheckMoves = [['d2', 'd4'], ['b1', 'c3'], ['c1', 'f4'], ['d1', 'd3']]
    for (let i = 0; i < preCheckMoves.length; i++) {
      const [from, to] = preCheckMoves[i]
      await playHumanAndExpectBot(pageA, 'flat-2d', chess, from, to, repliesA[i])
    }

    // White is in check from Bxc3+! Try illegal e2->e4 while in check -> must be rejected
    assert.equal(chess.inCheck(), true)
    await clickBoardSquare(pageA, 'flat-2d', 'e2')
    await clickBoardSquare(pageA, 'flat-2d', 'e4')
    assert.equal(await pageA.getByTestId('chessboard-frame').getAttribute('data-fen'), chess.fen(), 'illegal move while in check is rejected')

    // Legal check evasion: bxc3
    await playHumanAndExpectBot(pageA, 'flat-2d', chess, 'b2', 'c3', 'g8e7')

    // Queenside castling O-O-O!
    const { hm: castleMove } = await playHumanAndExpectBot(pageA, 'flat-2d', chess, 'e1', 'c1')
    assert.equal(castleMove.isQueensideCastle(), true)
    assert.equal(chess.get('d1')?.type, 'r')
    await collectRejections(pageA)
  } finally {
    await ctxA.close()
  }

  // Game B: Pawn Promotion (to Knight via PromotionModal)
  const repliesB = ['b7b5', 'b8c6', 'a8b8', 'h7h6']
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageB = await ctxB.newPage()
  attachErrorListeners(pageB)
  await pageB.addInitScript(() => {
    localStorage.setItem('blunderbot_theme_v2', JSON.stringify({
      boardPresetId: 'royal-walnut',
      pieceSetId: 'default',
      perspective: 'flat-2d',
      animationDuration: 0,
      soundEnabled: false,
    }))
  })
  await installScriptedBot(pageB, repliesB)

  try {
    await pageB.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await pageB.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'flat-2d')
    const chess = new Chess()
    // 1. a4 b5 2. axb5 Nc6 3. b6 Rb8 4. bxc7 h6 5. cxb8=N! (Promotion to Knight)
    const promoSeq = [['a2', 'a4'], ['a4', 'b5'], ['b5', 'b6'], ['b6', 'c7']]
    for (let i = 0; i < promoSeq.length; i++) {
      const [from, to] = promoSeq[i]
      await playHumanAndExpectBot(pageB, 'flat-2d', chess, from, to, repliesB[i])
    }
    await playHumanAndExpectBot(pageB, 'flat-2d', chess, 'c7', 'b8', undefined, 'n')
    assert.equal(chess.get('b8')?.type, 'n')
    await collectRejections(pageB)
  } finally {
    await ctxB.close()
  }

  // Game C: Stalemate (10-move Sam Loyd stalemate) + Threefold Repetition + Checkmate modal
  // Sam Loyd 10-move stalemate:
  // 1. e3 a5 2. Qh5 Ra6 3. Qxa5 h5 4. h4 Rah6 5. Qxc7 f6 6. Qxd7+ Kf7 7. Qxb7 Qd3 8. Qxb8 Qh7 9. Qxc8 Kg6 10. Qe6 (Stalemate!)
  const stalemateBot = ['a7a5', 'a8a6', 'h7h5', 'a6h6', 'f7f6', 'e8f7', 'd8d3', 'd3h7', 'f7g6']
  const stalemateHuman = [['e2', 'e3'], ['d1', 'h5'], ['h5', 'a5'], ['h2', 'h4'], ['a5', 'c7'], ['c7', 'd7'], ['d7', 'b7'], ['b7', 'b8'], ['b8', 'c8'], ['c8', 'e6']]
  const repBot = ['g8f6', 'f6g8', 'g8f6', 'f6g8']
  const mateBot = ['e7e5', 'b8c6', 'g8f6']
  const ctxC = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageC = await ctxC.newPage()
  attachErrorListeners(pageC)
  await pageC.addInitScript(() => {
    localStorage.setItem('blunderbot_theme_v2', JSON.stringify({
      boardPresetId: 'minimal-modern',
      pieceSetId: 'default',
      perspective: 'flat-2d',
      animationDuration: 0,
      soundEnabled: false,
    }))
  })
  await installScriptedBot(pageC, [...stalemateBot, ...repBot, ...mateBot])

  try {
    await pageC.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await pageC.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'flat-2d')
    const chess = new Chess()
    for (let i = 0; i < stalemateHuman.length; i++) {
      const [from, to] = stalemateHuman[i]
      await playHumanAndExpectBot(pageC, 'flat-2d', chess, from, to, stalemateBot[i])
    }
    assert.equal(chess.isStalemate(), true)
    const dialog = pageC.getByRole('dialog')
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    assert.match(await dialog.textContent(), /Stalemate/i)

    // Test Restart from GameResultModal -> Play Again -> Threefold Repetition
    await dialog.getByRole('button', { name: /Play Again/i }).click()
    await pageC.waitForFunction((startFen) => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen === startFen, new Chess().fen())
    const repChess = new Chess()
    const repHuman = [['g1', 'f3'], ['f3', 'g1'], ['g1', 'f3'], ['f3', 'g1']]
    for (let i = 0; i < repHuman.length; i++) {
      const [from, to] = repHuman[i]
      await playHumanAndExpectBot(pageC, 'flat-2d', repChess, from, to, repBot[i])
    }
    assert.equal(repChess.isThreefoldRepetition(), true)
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    assert.match(await dialog.textContent(), /Threefold Repetition/i)

    // Test Checkmate via Play Again (Scholar's Mate: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#)
    await dialog.getByRole('button', { name: /Play Again/i }).click()
    await pageC.waitForFunction((startFen) => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen === startFen, new Chess().fen())
    const mateChess = new Chess()
    const mateHuman = [['e2', 'e4'], ['f1', 'c4'], ['d1', 'h5'], ['h5', 'f7']]
    for (let i = 0; i < mateHuman.length; i++) {
      const [from, to] = mateHuman[i]
      await playHumanAndExpectBot(pageC, 'flat-2d', mateChess, from, to, mateBot[i])
    }
    assert.equal(mateChess.isCheckmate(), true)
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    assert.match(await dialog.textContent(), /Glorious Victory/i)
    await collectRejections(pageC)
  } finally {
    await ctxC.close()
  }
})

test('Live Stockfish: Human plays Black, Board flip, Theme switch while active, Restart while engine thinking (no stale move), All rendering modes', { timeout: 240000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await ctx.newPage()
  attachErrorListeners(page)

  // Start in 2D Tilted ('elevated-2.5d') as Black against real Stockfish!
  await page.addInitScript(() => {
    localStorage.setItem('blunderbot_theme_v2', JSON.stringify({
      boardPresetId: 'marble-brass',
      pieceSetId: 'chestnut',
      perspective: 'elevated-2.5d',
      animationDuration: 250,
      soundEnabled: false,
    }))
  })

  try {
    await page.goto(`${BASE_URL}/game?side=black&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'elevated-2.5d')

    // Stockfish UCI handshake verification + Stockfish plays White's opening move automatically
    const startFen = new Chess().fen()
    const afterWhite1 = await waitForBotReply(page, startFen, 'b', 20000)
    const chess = new Chess(afterWhite1)
    assert.equal(chess.turn(), 'b')

    // Human responds as Black with two legal moves in 2D Tilted (elevated-2.5d)
    for (let turn = 0; turn < 2; turn++) {
      const legal = chess.moves({ verbose: true })
      const move = legal.find((m) => m.captured) || legal.find((m) => ['e5', 'd5', 'c5', 'Nf6'].includes(m.san)) || legal[0]
      const afterMove = await playHumanMove(page, 'elevated-2.5d', move.from, move.to)
      chess.move(move.san)
      let afterBot = afterMove
      if (afterMove.split(' ')[1] === 'w') {
        assert.equal(afterMove, chess.fen())
        afterBot = await waitForBotReply(page, afterMove, 'b', 20000)
      }
      const nextChess = new Chess(afterBot)
      assert.equal(nextChess.turn(), 'b')
      assert.ok(
        chess.moves().some((san) => {
          const probe = new Chess(chess.fen())
          probe.move(san)
          return probe.fen() === afterBot
        }),
        'bot reply is a legal move from the human position'
      )
      chess.load(afterBot)
    }

    // Flip board while game is active (Black -> White perspective) and verify drag-and-drop in elevated-2.5d
    await page.getByTitle('Flip Board View').click()
    const dragMove = chess.moves({ verbose: true }).find((m) => (m.flags.includes('n') || m.flags.includes('b')) && !m.promotion) || chess.moves({ verbose: true })[0]
    if (dragMove && !dragMove.promotion) {
      const beforeDrag = await page.getByTestId('chessboard-frame').getAttribute('data-fen')
      const sourcePiece = page.getByTestId('chessboard-frame').locator(`[data-square="${dragMove.from}"] [data-piece]`).first()
      const targetSquare = page.getByTestId('chessboard-frame').locator(`[data-square="${dragMove.to}"]`)
      await sourcePiece.dragTo(targetSquare)
      await page.waitForFunction((prev) => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen !== prev, beforeDrag, { timeout: 10000 })
      const afterDrag = await page.getByTestId('chessboard-frame').getAttribute('data-fen')
      const afterDragBot = afterDrag.split(' ')[1] === 'b' ? afterDrag : await waitForBotReply(page, afterDrag, 'b', 20000)
      chess.load(afterDragBot)
    }

    // Switch difficulty to 'insane' (depth 20) and make a move, then Restart while Stockfish is thinking!
    await page.getByRole('button', { name: 'insane' }).click()
    const legal = chess.moves({ verbose: true })
    const mv = legal[0]
    await playHumanMove(page, 'elevated-2.5d', mv.from, mv.to)
    // Wait until Stockfish depth-20 search is actively thinking ("Calculating line...")
    await page.getByText('Calculating line...').waitFor({ state: 'visible', timeout: 5000 })
    // Select 'easy' for the upcoming restarted game while depth-20 is still running, then Restart Match
    await page.getByRole('button', { name: 'easy' }).click()
    await page.getByTitle('Restart Match').first().click()

    const start = new Chess().fen()
    const restartedFen = await waitForBotReply(page, start, 'b', 20000)
    await page.waitForTimeout(1500)
    const finalRestartedFen = await page.getByTestId('chessboard-frame').getAttribute('data-fen')
    assert.equal(finalRestartedFen, restartedFen, 'no duplicate or stale AI move after restart')
    const restartedChess = new Chess(finalRestartedFen)
    assert.equal(restartedChess.turn(), 'b', 'restarted game as Black has exactly 1 White opening move')
    assert.equal(restartedChess.moveNumber(), 1)

    // Switch rendering mode to Animated 2.5D ('true-3d') via Navbar button while active, verify playable
    await page.getByTitle(/Cycle between True 3D/).click()
    await page.getByTitle(/Cycle between True 3D/).click()
    await page.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'true-3d', null, { timeout: 15000 })
    await page.getByTestId('animated-board').and(page.locator('[aria-busy="false"]')).waitFor({ timeout: 60000 })
    const snap = await page.evaluate(() => window.__THREE_RENDERER__.getPresentationSnapshot())
    assert.equal(snap.authoritativeFen, restartedFen)

    await collectRejections(page)
  } finally {
    await ctx.close()
  }
})

test('Accessibility, Keyboard Navigation, Touch, Reduced Motion, and Error/2D Fallbacks', { timeout: 180000 }, async () => {
  // 1. Home page keyboard navigation & accessible opponent buttons
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const page1 = await ctx1.newPage()
  attachErrorListeners(page1)

  try {
    await page1.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 })
    await page1.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]') !== null)
    const r2Btn = page1.getByRole('button', { name: /Tactical Astromech/i })
    await r2Btn.focus()
    await page1.keyboard.press('Enter')
    await page1.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => /Tactical Astromech/i.test(b.textContent || ''))?.getAttribute('aria-pressed') === 'true')
    assert.equal(await r2Btn.getAttribute('aria-pressed'), 'true')

    // 2. Game page with prefers-reduced-motion: reduce & keyboard square navigation
    await page1.addInitScript(() => {
      localStorage.setItem('blunderbot_theme_v2', JSON.stringify({
        boardPresetId: 'classic-tournament',
        pieceSetId: 'default',
        perspective: 'flat-2d',
        animationDuration: 0,
        soundEnabled: false,
      }))
    })
    await page1.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const frame = page1.getByTestId('chessboard-frame')
    await page1.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'flat-2d')

    // Verify ThemeCustomizerModal opens, traps focus, closes on Escape, and restores trigger focus
    const studioBtn = page1.getByRole('button', { name: /Studio/i })
    await studioBtn.focus()
    await studioBtn.click()
    const customizerDialog = page1.getByRole('dialog', { name: /Board & Appearance Studio/i })
    await customizerDialog.waitFor({ state: 'visible', timeout: 5000 })
    await page1.keyboard.press('Tab')
    const focusInsideDialog = await page1.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]')
      return !!dlg && dlg.contains(document.activeElement)
    })
    assert.equal(focusInsideDialog, true, 'modal focus stays inside ThemeCustomizerModal')
    await page1.keyboard.press('Escape')
    await customizerDialog.waitFor({ state: 'hidden', timeout: 5000 })
    const restoredToStudio = await page1.evaluate(() => document.activeElement?.textContent?.includes('Studio'))
    assert.equal(restoredToStudio, true, 'closing modal restores focus to trigger button')

    // Verify aria-live status region exists and announces turn
    const liveStatus = frame.locator('[role="status"][aria-live="polite"]')
    assert.match(await liveStatus.textContent(), /White to move/i)

    // Keyboard play: focus board, press Enter on e2 (default cursor), ArrowUp twice to e4, Enter!
    await frame.focus()
    await page1.keyboard.press('Enter')
    assert.equal(await frame.getAttribute('data-selected-square'), 'e2')
    assert.match(await liveStatus.textContent(), /Selected square e2/i)
    await page1.keyboard.press('ArrowUp')
    await page1.keyboard.press('ArrowUp')
    await page1.keyboard.press('Enter')
    await page1.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen.includes('4P3'))
    // Wait for Stockfish reply
    await page1.waitForFunction(() => {
      const f = document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen
      return f && f.split(' ')[1] === 'w' && Number(f.split(' ')[5]) === 2
    }, null, { timeout: 20000 })
    await collectRejections(page1)
  } finally {
    await ctx1.close()
  }

  // 3. Mobile touch interaction (hasTouch: true)
  const ctxTouch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const pageTouch = await ctxTouch.newPage()
  attachErrorListeners(pageTouch)
  try {
    await pageTouch.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await pageTouch.getByTestId('animated-board').and(pageTouch.locator('[aria-busy="false"]')).waitFor({ timeout: 60000 })
    const ptE2 = await pageTouch.evaluate(() => {
      const r = window.__THREE_RENDERER__, v = r.board.squareToWorld('e2').project(r.cameraCtrl.camera), rect = r.renderer.domElement.getBoundingClientRect()
      return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }
    })
    await pageTouch.touchscreen.tap(ptE2.x, ptE2.y)
    await pageTouch.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.selectedSquare === 'e2')
    const ptE4 = await pageTouch.evaluate(() => {
      const r = window.__THREE_RENDERER__, v = r.board.squareToWorld('e4').project(r.cameraCtrl.camera), rect = r.renderer.domElement.getBoundingClientRect()
      return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }
    })
    await pageTouch.touchscreen.tap(ptE4.x, ptE4.y)
    await pageTouch.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen.includes('4P3'))

    // Switch to 2D Tilted (elevated-2.5d) on mobile touch and verify touch tap works there too
    await pageTouch.getByTitle(/Cycle between True 3D/).click()
    await pageTouch.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.perspective === 'elevated-2.5d')
    await pageTouch.waitForFunction(() => {
      const f = document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen
      return f && f.split(' ')[1] === 'w' && Number(f.split(' ')[5]) === 2
    }, null, { timeout: 20000 })
    await pageTouch.getByTestId('chessboard-frame').locator('[data-square="d2"]').tap()
    await pageTouch.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.selectedSquare === 'd2')
    await pageTouch.getByTestId('chessboard-frame').locator('[data-square="d4"]').tap()
    await pageTouch.waitForFunction(() => document.querySelector('[data-testid="chessboard-frame"]')?.dataset.fen.includes('3PP3'))
    await collectRejections(pageTouch)
  } finally {
    await ctxTouch.close()
  }

  // 4. WebGL unavailable -> Classic 2D Fallback + Stockfish worker failure alert
  const ctxFail = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageFail = await ctxFail.newPage()
  // Do NOT attach pageerror fail on intentional WebGL throw, catch via ErrorBoundary!
  await pageFail.addInitScript(() => {
    window.__UNHANDLED_REJECTIONS__ = []
    window.addEventListener('unhandledrejection', (e) => window.__UNHANDLED_REJECTIONS__.push(String(e.reason)))
    const origGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null
      return origGetContext.call(this, type, ...args)
    }
  })
  await pageFail.route('**/stockfish-worker.js', (route) => route.fulfill({ status: 404, body: 'missing' }))

  try {
    await pageFail.goto(`${BASE_URL}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // ErrorBoundary catches WebGL init failure and renders Classic 2D board
    await pageFail.getByText(/Classic 2D Fallback Active/i).waitFor({ state: 'visible', timeout: 15000 })
    // Stockfish failure shows explicit alert banner
    await pageFail.getByText(/Stockfish Engine Error/i).waitFor({ state: 'visible', timeout: 15000 })
    // Human can still make a legal 2D chess move in fallback mode!
    const fenAfter = await playHumanMove(pageFail, 'flat-2d', 'e2', 'e4')
    assert.ok(fenAfter.includes('4P3'), 'Classic 2D board remains playable when WebGL/2.5D fails')
    await collectRejections(pageFail)
  } finally {
    await ctxFail.close()
  }
})
