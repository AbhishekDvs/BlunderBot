import test from 'node:test'
import assert from 'node:assert/strict'

import { AstraAnimationStateMachine } from '../../apps/frontend/src/lib/astra/stateMachine.ts'
import { DebrisSystem } from '../../apps/frontend/src/lib/astra/debrisSystem.ts'
import { ASTRA_CLASS_SPECS, getClassSpec } from '../../apps/frontend/src/lib/astra/classSpecifications.ts'

test('all six Astra piece classes have valid design specifications and metrics', () => {
  const classes = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK']
  for (const code of classes) {
    const spec = getClassSpec(code)
    assert.ok(spec, `Missing spec for ${code}`)
    assert.equal(spec.baseDiameter, 0.68)
    assert.equal(spec.baseHeight, 0.07)
    assert.ok(spec.heightMultiplier >= 0.69 && spec.heightMultiplier <= 0.94)
    assert.ok(spec.totalDurationMs >= 600 && spec.totalDurationMs <= 850)
    assert.ok(spec.contactFrameMs > 0 && spec.contactFrameMs <= spec.totalDurationMs)
  }
})

test('state machine transitions: moving -> attacking -> impact -> destruction -> settling -> idle', () => {
  const sm = new AstraAnimationStateMachine()
  assert.equal(sm.getState(), 'idle')

  const plan = sm.planMove(
    {
      from: 'e4',
      to: 'd5',
      piece: 'wP',
      captured: 'bP',
      generation: 1,
      revision: 1,
    },
    { x: 100, y: 100 },
    { x: 160, y: 160 },
    { x: 160, y: 160 },
    60,
    'system',
    false
  )

  assert.ok(plan)
  assert.equal(plan.event.from, 'e4')
  assert.equal(plan.event.to, 'd5')
  assert.equal(plan.event.captured, 'bP')

  // Tick before contact
  sm.tick(plan.startTime + 150, 60)
  assert.equal(sm.getState(), 'attacking')

  // Tick at contact frame
  sm.tick(plan.startTime + plan.contactTime + 10, 60)
  assert.equal(sm.getState(), 'impact')

  // Tick at destruction
  sm.tick(plan.startTime + plan.destructionTime + 10, 60)
  assert.equal(sm.getState(), 'destruction')

  // Tick at settling
  sm.tick(plan.startTime + plan.destructionTime + 50, 60)
  assert.equal(sm.getState(), 'settling')

  // Tick past duration -> settles into idle
  sm.tick(plan.startTime + plan.durationMs + 100, 60)
  assert.equal(sm.getState(), 'idle')
  assert.equal(sm.getActivePlan(), null)
})

test('en passant capture locates victim at (to.file, from.rank)', () => {
  const sm = new AstraAnimationStateMachine()
  const plan = sm.planMove(
    {
      from: 'e5',
      to: 'd6',
      piece: 'wP',
      captured: 'bP',
      isEnPassant: true,
      generation: 2,
      revision: 1,
    },
    { x: 200, y: 100 },
    { x: 150, y: 50 },
    { x: 150, y: 100 }, // d5 victim square coordinates
    60,
    'system',
    false
  )

  assert.ok(plan)
  assert.equal(plan.defenderTrack?.fromSquare, 'd5')
  assert.equal(plan.attackerTrack.toSquare, 'd6')
})

test('castling tracks king and rook movements correctly', () => {
  const sm = new AstraAnimationStateMachine()
  const plan = sm.planMove(
    {
      from: 'e1',
      to: 'g1',
      piece: 'wK',
      isCastling: true,
      generation: 3,
      revision: 1,
    },
    { x: 240, y: 420 },
    { x: 360, y: 420 },
    undefined,
    60,
    'system',
    false
  )

  assert.ok(plan)
  assert.equal(plan.attackerTrack.fromSquare, 'e1')
  assert.equal(plan.attackerTrack.toSquare, 'g1')
  assert.equal(plan.defenderTrack, undefined)
})

test('cancellation clears in-flight state and bumps generation', () => {
  const sm = new AstraAnimationStateMachine()
  sm.planMove(
    {
      from: 'g1',
      to: 'f3',
      piece: 'wN',
      generation: 4,
      revision: 1,
    },
    { x: 360, y: 420 },
    { x: 300, y: 300 },
    undefined,
    60
  )

  assert.notEqual(sm.getState(), 'idle')
  sm.cancel()
  assert.equal(sm.getState(), 'idle')
  assert.equal(sm.getActivePlan(), null)

  const nextGen = sm.bumpGeneration()
  assert.ok(nextGen > 4)

  // Stale event rejected
  const rejected = sm.planMove(
    {
      from: 'e2',
      to: 'e4',
      piece: 'wP',
      generation: 3, // older than nextGen
      revision: 1,
    },
    { x: 240, y: 360 },
    { x: 240, y: 240 }
  )
  assert.equal(rejected, null)
})

test('motion preference off or reduced prevents multi-stage combat and debris', () => {
  const sm = new AstraAnimationStateMachine()
  const offPlan = sm.planMove(
    {
      from: 'e4',
      to: 'd5',
      piece: 'wP',
      captured: 'bP',
      generation: 10,
      revision: 1,
    },
    { x: 100, y: 100 },
    { x: 160, y: 160 },
    { x: 160, y: 160 },
    60,
    'off'
  )
  assert.equal(offPlan, null)
  assert.equal(sm.getState(), 'idle')

  const reducedPlan = sm.planMove(
    {
      from: 'e4',
      to: 'd5',
      piece: 'wP',
      captured: 'bP',
      generation: 11,
      revision: 1,
    },
    { x: 100, y: 100 },
    { x: 160, y: 160 },
    { x: 160, y: 160 },
    60,
    'reduced'
  )
  assert.ok(reducedPlan)
  assert.equal(reducedPlan.durationMs, 100)
  assert.equal(reducedPlan.contactTime, 0)
})

test('debris system strictly enforces particle limits and fade out', () => {
  const debris = new DebrisSystem()
  assert.deepEqual(debris.getCount(), { fragments: 0, dust: 0 })

  // Spawn capture 1
  debris.spawnCaptureDebris(100, 100, 60, 'wP')
  const count1 = debris.getCount()
  assert.ok(count1.fragments <= 6, 'Exceeded 6 fragments per capture')
  assert.ok(count1.dust <= 2, 'Exceeded 2 dust per capture')

  // Spawn capture 2 and 3 to test global capacity cap
  debris.spawnCaptureDebris(160, 160, 60, 'wR')
  debris.spawnCaptureDebris(220, 220, 60, 'wQ')
  const countGlobal = debris.getCount()
  assert.ok(countGlobal.fragments <= 12, 'Exceeded 12 global fragments cap')
  assert.ok(countGlobal.dust <= 8, 'Exceeded 8 global dust cap')

  // Clean wipe on reset
  debris.clear()
  assert.deepEqual(debris.getCount(), { fragments: 0, dust: 0 })
})
