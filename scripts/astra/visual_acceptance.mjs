/** Local art-direction frames from the real app. Images stay in ignored .cache/. */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Chess } from 'chess.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.resolve('.cache/browser-tools/node_modules/playwright'))
const folder = path.resolve('.cache/visual', process.env.VISUAL_LABEL || 'review')
mkdirSync(folder, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
const initial = new Chess().fen()
const observations = []
async function shot(name) {
  await page.screenshot({ path: path.join(folder, `${name}.png`) })
  const snapshot = await page.evaluate(() => window.__THREE_RENDERER__.getPresentationSnapshot())
  observations.push({ name, viewport: page.viewportSize(), board: await page.getByTestId('animated-board').boundingBox(), snapshot })
  writeFileSync(path.join(folder, 'observations.json'), JSON.stringify({ errors, observations }, null, 2))
  console.log(`Captured ${name}`)
}
async function reset(fen = initial, side = 'white') {
  await page.evaluate(({ fen, side }) => {
    const r = window.__THREE_RENDERER__
    r.resetGame(); r.setFen(fen); r.setOrientation(side); r.setPacing('cinematic'); r.cameraCtrl.update(10)
  }, { fen, side })
  await page.waitForTimeout(180)
}
async function fire(fen, moves) {
  const game = new Chess(fen)
  const events = moves.map(san => {
    const m = game.move(san)
    return { from: m.from, to: m.to, code: m.color + m.piece.toUpperCase(), victim: m.captured && (m.color === 'w' ? 'b' : 'w') + m.captured.toUpperCase(), beforeFen: m.before, afterFen: m.after }
  })
  await page.evaluate(events => {
    for (const e of events) {
      if (e.victim) window.__ASTRA_HUB__.notifyCapture({ attackerSquare: e.from, victimSquare: e.to, attackerPiece: e.code, victimPiece: e.victim, beforeFen: e.beforeFen, afterFen: e.afterFen, timestamp: Date.now() })
      else window.__ASTRA_HUB__.notifyMove(e.from, e.to, e.code, { beforeFen: e.beforeFen, afterFen: e.afterFen })
    }
  }, events)
}
async function freeze(code, phase) {
  await page.waitForFunction(({ code, phase }) => {
    const r = window.__THREE_RENDERER__, s = r.getPresentationSnapshot()
    if (s.active?.attacker.code !== code || s.active.phase !== phase) return false
    if (!s.active.defender) {
      const move = r.activeMoves[0]
      if (!move || (performance.now() - move.startTime) / move.duration < .4) return false
    }
    cancelAnimationFrame(r.animFrameId)
    r.__reviewPause = performance.now()
    return true
  }, { code, phase }, { timeout: 60000, polling: 'raf' })
}
async function resume() {
  await page.evaluate(() => {
    const r = window.__THREE_RENDERER__, now = performance.now(), pause = now - r.__reviewPause
    for (const move of r.activeMoves) move.startTime += pause
    const stage = r.encounterDirector.spriteStage
    if (stage?.isActive) {
      stage.startTime += pause
      if (stage.holdUntil > 0) { stage.holdStart += pause; stage.holdUntil += pause }
    }
    if (r.endingDirector.isActive) r.endingDirector.startTime += pause
    r.lastTime = now
    r.startRenderLoop()
  })
}
async function idle() { await page.waitForFunction(() => { const s = window.__THREE_RENDERER__.getPresentationSnapshot(); return !s.active && !s.queued.length && !s.ending }, null, { timeout: 90000 }) }
async function freezeEnding() {
  await page.waitForFunction(() => {
    const r=window.__THREE_RENDERER__
    if(!r.endingDirector.isActive || performance.now()-r.endingDirector.startTime<250)return false
    cancelAnimationFrame(r.animFrameId);r.__reviewPause=performance.now();return true
  },null,{timeout:30000,polling:'raf'})
}

try {
  await page.goto(`${process.env.BLUNDERBOT_TEST_URL || 'http://localhost:3103'}/game?side=white&difficulty=easy&timeControl=casual`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  console.log('Loaded game document')
  await page.getByTestId('animated-board').and(page.locator('[aria-busy="false"]')).waitFor({ timeout: 120000 })
  await page.waitForFunction(() => window.__THREE_RENDERER__?.getPresentationSnapshot().units.length === 32)
  for (const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:390,height:844}]) {
    await page.setViewportSize(viewport)
    for (const side of ['white','black']) {
      await reset(initial, side)
      await shot(`${viewport.width}-${side}`)
    }
  }
  await page.setViewportSize({width:1366,height:768}); await reset()
  await fire(initial, ['e4']); await freeze('wP','APPROACHING'); await shot('pawn-walk'); await resume(); await idle()
  const knight = '4k3/8/4b3/8/3N4/8/8/4K3 w - - 0 1'
  await reset(knight); await fire(knight,['Nxe6']); await freeze('wN','IMPACT'); await shot('knight-bishop-contact'); await resume()
  await freeze('wN','DESTRUCTION'); await shot('knight-bishop-destruction'); await resume(); await idle()
  await reset(); await fire(initial,['e4','d5','exd5','Qxd5'])
  await freeze('wP','IMPACT'); await shot('pawn-contact'); await resume()
  await freeze('bQ','IMPACT'); await shot('queen-recapture'); await resume(); await idle(); await shot('after-two-captures')
  await page.setViewportSize({width:390,height:844}); await reset(knight,'black'); await fire(knight,['Nxe6'])
  await freeze('wN','IMPACT'); await shot('mobile-black-contact'); await resume(); await idle()
  await page.setViewportSize({width:1366,height:768})
  const army = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  for (const outcome of ['white_wins','black_wins','draw']) {
    await reset(army)
    await page.evaluate(outcome => window.__THREE_RENDERER__.triggerGameEnding(outcome),outcome)
    await freezeEnding(); await shot(outcome); await resume(); await idle()
  }
  await page.setViewportSize({width:1920,height:1080})
  await reset('8/1prnbqk1/8/8/8/1PRNBQK1/8/8 w - - 0 1')
  for(const frame of [0,3,6,9]) {
    await page.evaluate(frame => {
      const r=window.__THREE_RENDERER__;cancelAnimationFrame(r.animFrameId);r.__reviewPause=performance.now()
      for(const node of r.pieceNodes.values()){node.animator.playClip('move',true);node.animator.setFrame(frame)}
      r.renderer.render(r.scene,r.cameraCtrl.camera)
    },frame)
    await shot(`all-classes-walk-${frame}`);await resume()
  }
  writeFileSync(path.join(folder, 'observations.json'), JSON.stringify({ errors, observations }, null, 2))
  if (errors.length) throw new Error(errors.join('\n'))
} catch (error) {
  await page.screenshot({ path: path.join(folder, 'failure.png') }).catch(() => {})
  console.error({ errors, body: await page.locator('body').innerText().catch(() => '') })
  throw error
} finally { await browser.close() }
