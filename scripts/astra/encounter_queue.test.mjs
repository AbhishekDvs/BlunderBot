import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { VisualEventQueue, VISUAL_PHASES } from '../../apps/frontend/src/lib/three/visualEventQueue.ts'
import { IndianArmiesRuntime } from '../../apps/frontend/src/lib/three/indianArmiesRuntime.ts'
import { PieceBuilder3D } from '../../apps/frontend/src/lib/three/pieceBuilder.ts'
import { CameraController3D } from '../../apps/frontend/src/lib/three/cameraController.ts'
import { SpriteEncounterStage,resolveSpriteContact } from '../../apps/frontend/src/lib/three/spriteEncounterStage.ts'

const initial=new Chess().fen()
function enqueue(queue,chess,san,id) {
  const move=chess.move(san)
  return queue.enqueue({from:move.from,to:move.to,pieceCode:move.color+move.piece.toUpperCase(),beforeFen:move.before,afterFen:move.after,promotion:move.promotion,pacing:'cinematic',moveId:id})
}

test('e4 d5 exd5 Qxd5 keeps two independent captures and the first attacker becomes the second victim',()=>{
  const queue=new VisualEventQueue(),chess=new Chess();queue.reset(initial)
  const events=['e4','d5','exd5','Qxd5'].map(san=>enqueue(queue,chess,san))
  assert.equal(events[2].attacker.id,events[3].defender.id)
  assert.equal(events[2].defender.code,'bP');assert.equal(events[3].attacker.code,'bQ')
  assert.notEqual(events[2].id,events[3].id)
  assert.equal(events[2].afterFen,events[3].beforeFen)
  assert.equal(events[2].after.d5.code,'wP');assert.equal(events[3].after.d5.code,'bQ')
  assert.ok(Object.isFrozen(events[2]) && Object.isFrozen(events[2].before) && Object.isFrozen(events[2].attacker))
  assert.throws(()=>{events[2].attacker.code='bK'},TypeError)
  for (const event of events) {
    assert.equal(queue.begin().id,event.id)
    assert.equal(queue.begin(),null,'a second event cannot acquire active ownership')
    queue.complete(event.id)
  }
  assert.deepEqual(queue.history.filter(r=>r.event.defender).map(r=>r.transitions),[VISUAL_PHASES,VISUAL_PHASES])
  assert.equal(queue.tailFen,chess.fen())
  assert.equal(Object.values(queue.tail).filter(u=>u.id===events[2].attacker.id).length,0)
})

test('rapid engine result queues, skip preserves the next snapshot, reset rejects stale completion',()=>{
  const q=new VisualEventQueue(),chess=new Chess();q.reset(initial)
  enqueue(q,chess,'e4');enqueue(q,chess,'d5');const first=enqueue(q,chess,'exd5');const second=enqueue(q,chess,'Qxd5')
  for(let i=0;i<2;i++){const e=q.begin();q.complete(e.id)}
  q.begin();assert.equal(q.active.event.id,first.id);assert.equal(q.pending[0].event.id,second.id)
  q.complete(first.id,true);assert.equal(q.history.at(-1).skipped,true)
  assert.equal(q.begin().id,second.id)
  const generation=q.generation;q.reset(initial)
  assert.ok(q.generation>generation);assert.equal(q.complete(second.id),null);assert.equal(q.busy,false)
})

test('move snapshots reject illegal or mismatched state and deduplicate supplied move IDs',()=>{
  const q=new VisualEventQueue(),chess=new Chess();q.reset(initial)
  const first=enqueue(q,chess,'e4','validated-1')
  assert.equal(q.enqueue({moveId:'validated-1',from:'e2',to:'e4',pieceCode:'wP',pacing:'fast'}),null)
  assert.throws(()=>q.enqueue({from:'d7',to:'d5',pieceCode:'bP',beforeFen:initial,pacing:'fast'}),/queued position/)
  assert.throws(()=>q.enqueue({from:'d7',to:'d5',pieceCode:'bP',afterFen:initial,pacing:'fast'}),/after-FEN/)
  assert.equal(q.tailFen,first.afterFen)
})

test('en passant, castling and promotion keep their correct visual identities',()=>{
  const q=new VisualEventQueue(),chess=new Chess();q.reset(initial)
  for(const move of ['e4','a6','e5','d5'])enqueue(q,chess,move)
  const ep=enqueue(q,chess,'exd6');assert.equal(ep.capturedSquare,'d5');assert.equal(ep.defender.code,'bP');assert.equal(ep.after.d5,undefined)
  const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');q.reset(castle.fen())
  const rook=q.tail.h1.id,e=enqueue(q,castle,'O-O');assert.equal(e.after.f1.id,rook);assert.equal(e.rookMove.from,'h1')
  const promotion=new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');q.reset(promotion.fen())
  const id=q.tail.a7.id,p=enqueue(q,promotion,'a8=Q');assert.equal(p.after.a8.id,id);assert.equal(p.after.a8.code,'wQ')
})

async function metadata() {
  const previousFetch=globalThis.fetch;globalThis.window={}
  globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL('../../apps/frontend/public'+url,import.meta.url),'utf8'))})
  try{await IndianArmiesRuntime.loadRuntimeMetadata()}finally{delete globalThis.window;globalThis.fetch=previousFetch}
}

test('Knight/Bishop contact uses authored staff point, preserves both perspective camera states, and isolates callbacks',async()=>{
  await metadata()
  PieceBuilder3D.setManifest('2p5d-stylized')
  const contact=resolveSpriteContact('wN','bB')
  assert.equal(contact.calibrated,true)
  assert.ok(Math.abs(contact.tipLocal[1]-contact.blockLocal[1])<1e-9)
  for(const side of ['white','black']) {
    const camera=new CameraController3D(1.3);camera.setOrientation(side);camera.orbit(8,-5);camera.zoom(-1);camera.update(.2)
    const saved=camera.getSnapshot()
    const knight=PieceBuilder3D.createPieceNode('wN','d4'),bishop=PieceBuilder3D.createPieceNode('bB','e6')
    knight.instanceId='knight';bishop.instanceId='bishop';knight.targetPosition.set(1,0,0)
    const stage=new SpriteEncounterStage(null,camera)
    let hits=0,defeats=0,completions=0
    stage.start(knight,bishop,{attackerCode:'wN',attackerSquare:'d4',defenderCode:'bB',defenderSquare:'e6',pacing:'cinematic',onContact:()=>hits++,onDefeat:()=>defeats++,onComplete:()=>completions++},'capture-1')
    const start=stage.startTime
    assert.equal(camera.getSnapshot().owner,'capture-1')
    assert.throws(()=>camera.acquireEncounter('capture-2'),/already owned/)
    stage.update(start+1440.1)
    assert.equal(knight.animator.currentClip,'attack');assert.equal(knight.animator.currentFrame,4)
    assert.equal(bishop.animator.currentClip,'defend');assert.equal(bishop.animator.currentFrame,5)
    stage.update(start+1445);assert.equal(hits,1)
    stage.update(start+5000);stage.update(start+6000)
    assert.equal(defeats,1);assert.equal(completions,1)
    assert.equal(bishop.group.visible,false);assert.deepEqual(knight.group.position.toArray(),[1,0,0])
    assert.deepEqual(camera.getSnapshot(),saved)
    stage.start(knight,PieceBuilder3D.createPieceNode('bP','e6'),{attackerCode:'wN',attackerSquare:'d4',defenderCode:'bP',defenderSquare:'e6',pacing:'cinematic',onContact:()=>hits++},'capture-2')
    stage.cancel();stage.update(start+10000)
    assert.equal(hits,1,'cancelled work cannot invoke a stale hit')
    assert.equal(camera.getSnapshot().owner,null)
  }
})
