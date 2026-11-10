/** Real Chromium regression tests. Start the frontend on :3100 first.
 * Requires Playwright; PLAYWRIGHT_MODULE may point to an external installation.
 * Optional PLAYWRIGHT_EXECUTABLE_PATH selects an installed Chromium.
 * Screenshots, when requested, go only to ignored .cache/recovery/.
 */
import { before,after,test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync,existsSync } from 'node:fs'
import path from 'node:path'
import { Chess } from 'chess.js'

const require=createRequire(import.meta.url)
const local=path.resolve('.cache/browser-tools/node_modules/playwright')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || (existsSync(local)?local:'playwright'))
let browser,page
const errors=[]
const initial=new Chess().fen()
const line=['e4','d5','exd5','Qxd5']
function moves(fen,sans) {
  const game=new Chess(fen)
  return sans.map(san=>{
    const m=game.move(san)
    return {from:m.from,to:m.to,piece:m.color+m.piece.toUpperCase(),victim:m.captured?(m.color==='w'?'b':'w')+m.captured.toUpperCase():null,
      beforeFen:m.before,afterFen:m.after,promotion:m.promotion,isCastling:m.isKingsideCastle()||m.isQueensideCastle(),isEnPassant:m.isEnPassant(),capturedSquare:m.isEnPassant()?m.to[0]+m.from[1]:m.to}
  })
}
const snapshot=()=>page.evaluate(()=>window.__THREE_RENDERER__.getPresentationSnapshot())
async function reset(fen=initial,side='white',pacing='fast') {
  await page.evaluate(({fen,side,pacing})=>{
    const r=window.__THREE_RENDERER__;r.resetGame();r.setFen(fen);r.setOrientation(side);r.setPacing(pacing);r.cameraCtrl.update(10)
  },{fen,side,pacing})
}
async function fire(events) {
  await page.evaluate(events=>{
    for(const e of events) {
      const meta={beforeFen:e.beforeFen,afterFen:e.afterFen,isCastling:e.isCastling,promotion:e.promotion}
      if(e.victim) window.__ASTRA_HUB__.notifyCapture({attackerSquare:e.from,victimSquare:e.to,attackerPiece:e.piece,victimPiece:e.victim,...meta,isEnPassant:e.isEnPassant,capturedSquare:e.capturedSquare,timestamp:Date.now()})
      else window.__ASTRA_HUB__.notifyMove(e.from,e.to,e.piece,meta)
    }
  },events)
}
async function idle() {
  await page.waitForFunction(()=>{const s=window.__THREE_RENDERER__.getPresentationSnapshot();return !s.active&&!s.queued.length&&!s.ending},null,{timeout:90000})
  return snapshot()
}
async function captureStarted(code) {
  await page.waitForFunction(code=>{const s=window.__THREE_RENDERER__.getPresentationSnapshot();return s.active?.defender&&s.active.attacker.code===code&&s.stage?.owner===s.active.id},code,{timeout:90000})
}
function finalPosition(s,fen) {
  assert.equal(s.presentedFen,fen);assert.equal(s.authoritativeFen,fen)
  assert.equal(new Set(s.units.map(u=>u.id)).size,s.units.length)
  assert.ok(s.units.every(u=>u.visible))
  assert.equal(s.camera.owner,null)
  assert.equal(s.stage.effectsOwner,null)
}

before(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
  page=await browser.newPage({viewport:{width:1440,height:1000}})
  page.on('pageerror',error=>{errors.push(error.message);console.error('pageerror:',error.message)})
  page.on('console',message=>{if(message.type()==='error'&&message.text().includes('[Astra2.5D:IndianArmies]'))errors.push(message.text())})
  await page.goto((process.env.BLUNDERBOT_TEST_URL||'http://localhost:3100')+'/game?side=white&difficulty=easy&timeControl=casual',{waitUntil:'domcontentloaded',timeout:300000})
  await page.waitForFunction(()=>window.__THREE_RENDERER__?.getPresentationSnapshot().units.length===32,null,{timeout:180000})
  await page.waitForFunction(()=>[...window.__THREE_RENDERER__.pieceNodes.values()].every(n=>n.cardMesh?.material.map?.image?.width),null,{timeout:180000})
  if(process.env.RECOVERY_SCREENSHOTS){mkdirSync('.cache/recovery',{recursive:true});await page.locator('canvas').first().screenshot({path:'.cache/recovery/tactical.png'})}
},{timeout:600000})
after(async()=>{await browser?.close()})

test('A: consecutive Pawn and Queen captures are separate, ordered and reconcile the correct final board', {timeout:360000}, async()=>{
  await reset(initial,'white','cinematic')
  const camera=(await snapshot()).camera,events=moves(initial,line)
  await fire(events);await captureStarted('wP')
  let s=await snapshot()
  assert.equal(s.active.defender.code,'bP');assert.equal(s.queued.at(-1).attacker.code,'bQ')
  const id=s.active.id
  await captureStarted('bQ');s=await snapshot()
  assert.notEqual(s.active.id,id);assert.equal(s.active.defender.code,'wP');assert.equal(s.stage.effectsOwner,null)
  const captures=s.history.filter(e=>e.defender)
  assert.equal(captures[0].attacker.id,s.active.defender.id)
  const done=await idle();finalPosition(done,events.at(-1).afterFen)
  assert.deepEqual(done.history.filter(e=>e.defender).map(e=>[e.attacker.code,e.defender.code]),[['wP','bP'],['bQ','wP']])
  assert.deepEqual(done.camera,camera)
  assert.equal(done.units.find(u=>u.square==='d5').code,'bQ')
  assert.ok(!done.units.some(u=>u.id===captures[0].defender.id||u.id===captures[0].attacker.id))
})

test('B: an engine reply arriving during the first capture is queued without stealing the stage', {timeout:360000}, async()=>{
  await reset();const events=moves(initial,line)
  const pair=await page.evaluate(events=>new Promise(resolve=>{
    const hub=window.__ASTRA_HUB__,r=window.__THREE_RENDERER__
    const capture=e=>hub.notifyCapture({attackerSquare:e.from,victimSquare:e.to,attackerPiece:e.piece,victimPiece:e.victim,beforeFen:e.beforeFen,afterFen:e.afterFen,timestamp:Date.now()})
    for(const e of events.slice(0,3)){if(e.victim)capture(e);else hub.notifyMove(e.from,e.to,e.piece,{beforeFen:e.beforeFen,afterFen:e.afterFen})}
    function reply(){const first=r.getPresentationSnapshot();if(first.active?.attacker.code==='wP'&&first.active.defender){capture(events[3]);resolve({first,queued:r.getPresentationSnapshot()})}else requestAnimationFrame(reply)}
    requestAnimationFrame(reply)
  }),events)
  assert.equal(pair.queued.active.id,pair.first.active.id);assert.equal(pair.queued.queued[0].defender.id,pair.first.active.attacker.id)
  finalPosition(await idle(),events.at(-1).afterFen)
})

test('C: Skip completes only the first encounter and preserves the queued Queen capture', {timeout:360000}, async()=>{
  await reset();const events=moves(initial,line)
  const skipped=await page.evaluate(events=>new Promise(resolve=>{
    const hub=window.__ASTRA_HUB__,r=window.__THREE_RENDERER__
    for(const e of events){const meta={beforeFen:e.beforeFen,afterFen:e.afterFen};if(e.victim)hub.notifyCapture({attackerSquare:e.from,victimSquare:e.to,attackerPiece:e.piece,victimPiece:e.victim,...meta,timestamp:Date.now()});else hub.notifyMove(e.from,e.to,e.piece,meta)}
    function skip(){const s=r.getPresentationSnapshot(),button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Skip');if(s.active?.attacker.code==='wP'&&s.active.defender&&button){button.click();resolve(r.getPresentationSnapshot())}else requestAnimationFrame(skip)}
    requestAnimationFrame(skip)
  }),events)
  assert.equal(skipped.active.attacker.code,'bQ')
  const done=await idle();finalPosition(done,events.at(-1).afterFen)
  assert.equal(done.history.filter(e=>e.defender)[0].skipped,true)
  assert.equal(done.history.filter(e=>e.defender)[1].skipped,false)
})

test('D: restart and undo invalidate old callbacks, victims, effects and queued work', {timeout:360000}, async()=>{
  await reset();await fire(moves(initial,line));await captureStarted('wP')
  await page.evaluate(()=>window.__ASTRA_HUB__.notifyGameReset())
  let s=await idle();assert.equal(s.units.length,32);assert.equal(s.history.length,0)
  await page.waitForTimeout(700);s=await snapshot();assert.equal(s.active,null);assert.equal(s.stage.owner,undefined)
  await fire(moves(initial,line));await captureStarted('wP')
  await page.evaluate(fen=>window.__THREE_RENDERER__.setFen(fen),initial)
  s=await idle();assert.equal(s.presentedFen,initial);assert.equal(s.units.length,32);assert.equal(s.queued.length,0)
  await fire(moves(initial,line));await captureStarted('wP')
  await page.evaluate(()=>window.__THREE_RENDERER__.setAssetManifest('2p5d-stylized'))
  s=await idle();assert.equal(s.presentedFen,moves(initial,line).at(-1).afterFen);assert.equal(s.history.length,0)
})

test('E: legal Knight/Bishop capture displays exact contact frames, both actors fit, and the Bishop is removed', {timeout:360000}, async()=>{
  const fen='4k3/8/4b3/8/3N4/8/8/4K3 w - - 0 1'
  await reset(fen,'white','cinematic');const events=moves(fen,['Nxe6']);await fire(events)
  const handle=await page.waitForFunction(()=>{
    const r=window.__THREE_RENDERER__,s=r.getPresentationSnapshot()
    if(s.active?.attacker.code!=='wN'||s.stage.elapsed<1440||s.stage.elapsed>1440.01)return false
    return {s,image:r.renderer.domElement.parentElement.querySelectorAll('canvas')[1].toDataURL(),frames:[r.nodesById.get(s.active.attacker.id).animator.currentFrame,r.nodesById.get(s.active.defender.id).animator.currentFrame]}
  },null,{timeout:90000})
  const {s,frames,image}=await handle.jsonValue();assert.deepEqual(frames,[4,5]);assert.equal(s.stage.calibratedContact,true)
  assert.ok(s.stage.contactErrorPx<.01)
  for(const [x0,y0,x1,y1] of s.stage.bounds){assert.ok(x0>=0&&y0>=0&&x1<=s.stage.viewport[0]&&y1<=s.stage.viewport[1])}
  if(process.env.RECOVERY_SCREENSHOTS)require('node:fs').writeFileSync('.cache/recovery/contact-stage.png',Buffer.from(image.split(',')[1],'base64'))
  const done=await idle();finalPosition(done,events[0].afterFen);assert.equal(done.units.find(u=>u.square==='e6').code,'wN');assert.ok(!done.units.some(u=>u.code==='bB'))
})

test('F: both board perspectives and a mobile canvas preserve unmirrored sprites and bounded encounter framing', {timeout:360000}, async()=>{
  const fen='4k3/8/4b3/8/3N4/8/8/4K3 w - - 0 1'
  for(const side of ['white','black']) {
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150)
    await reset(fen,side,'cinematic');await fire(moves(fen,['Nxe6']));await captureStarted('wN')
    const s=await snapshot();assert.equal(s.camera.owner,s.active.id)
    for(const box of s.stage.bounds)assert.ok(box[0]>=0&&box[2]<=s.stage.viewport[0])
    const mirrored=await page.evaluate(()=>[...window.__THREE_RENDERER__.nodesById.values()].some(n=>n.cardMesh?.material.map.repeat.x<0))
    assert.equal(mirrored,false);await idle()
  }
  await page.setViewportSize({width:1440,height:1000})
})

test('G: a mating capture completes before the single ending begins; the losing King stays visible', {timeout:360000}, async()=>{
  const game=new Chess();for(const san of ['e4','e5','Bc4','Nc6','Qh5','Nf6'])game.move(san)
  const fen=game.fen();game.move('Qxf7#');assert.equal(game.isCheckmate(),true)
  await reset(fen)
  const result=await page.evaluate(e=>new Promise(resolve=>{
    const hub=window.__ASTRA_HUB__,r=window.__THREE_RENDERER__
    window.__ENDING_COMPLETIONS__=0
    hub.notifyCapture({attackerSquare:e.from,victimSquare:e.to,attackerPiece:e.piece,victimPiece:e.victim,beforeFen:e.beforeFen,afterFen:e.afterFen,timestamp:Date.now()})
    hub.notifyGameEnd('white_wins',()=>window.__ENDING_COMPLETIONS__++)
    const early=r.getPresentationSnapshot()
    function ending(){if(r.endingDirector.isActive){resolve({early,s:r.getPresentationSnapshot(),clip:[...r.pieceNodes.values()].find(n=>n.pieceCode==='bK').animator.currentClip})}else requestAnimationFrame(ending)}
    requestAnimationFrame(ending)
  }),moves(fen,['Qxf7#'])[0])
  assert.equal(result.early.ending,false)
  const s=result.s;assert.equal(s.active,null);assert.equal(s.history.at(-1).phase,'COMPLETE');assert.equal(s.camera.owner,null)
  assert.ok(s.units.find(u=>u.code==='bK').visible)
  assert.equal(result.clip,'defeat_acknowledgement');await idle()
  assert.equal(await page.evaluate(()=>window.__ENDING_COMPLETIONS__),1)
  assert.deepEqual(errors,[])
})

test('H: real board clicks receive a legal engine reply in 2.5D and traditional chess', {timeout:360000}, async()=>{
  await reset()
  const point=async square=>page.evaluate(square=>{
    const r=window.__THREE_RENDERER__,p=r.board.squareToWorld(square).project(r.cameraCtrl.camera),rect=r.renderer.domElement.getBoundingClientRect()
    return{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2}
  },square)
  for(const square of ['e2','e4']){const p=await point(square);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150)}
  await page.waitForFunction(()=>{const s=window.__THREE_RENDERER__.getPresentationSnapshot();return s.authoritativeFen.split(' ')[1]==='w'&&Number(s.authoritativeFen.split(' ')[5])>=2},null,{timeout:90000})
  await idle()
  const s=await snapshot();assert.equal(s.history[0].from,'e2');assert.equal(s.history[0].to,'e4');assert.equal(s.history[1].attacker.code[0],'b')
  const flat=await browser.newPage({viewport:{width:1440,height:1000}})
  try {
    flat.on('pageerror',e=>errors.push(e.message))
    await flat.addInitScript(()=>localStorage.setItem('blunderbot_theme_v2',JSON.stringify({perspective:'flat-2d',pieceSetId:'pirouetti',soundEnabled:false,animationDuration:0})))
    await flat.goto((process.env.BLUNDERBOT_TEST_URL||'http://localhost:3100')+'/game?side=white&difficulty=easy&timeControl=casual',{waitUntil:'domcontentloaded',timeout:180000})
    await flat.locator('[data-square="e2"]').first().click();await flat.locator('[data-square="e4"]').first().click()
    const san=/^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)$/
    await flat.waitForFunction(()=>[...document.querySelectorAll('button')].filter(b=>/^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)$/.test(b.textContent.trim())).length>=2,null,{timeout:90000})
    assert.ok(await flat.getByRole('button',{name:san}).count()>=2)
  } finally {await flat.close()}
  assert.deepEqual(errors,[])
})
