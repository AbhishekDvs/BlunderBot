import test from 'node:test'
import assert from 'node:assert/strict'
import { boardAnimationDuration } from '../../apps/frontend/src/lib/astra/motion.ts'

test('off and black orientation never animate', () => {
  for (const reduced of [false, true]) {
    for (const side of ['white', 'black']) {
      assert.equal(boardAnimationDuration('off', reduced, side), 0)
    }
    for (const preference of ['system', 'reduced', 'off']) {
      assert.equal(boardAnimationDuration(preference, reduced, 'black'), 0)
    }
  }
})

test('system preference and explicit reduced mode shorten white movement', () => {
  assert.equal(boardAnimationDuration('system', false, 'white'), 300)
  assert.equal(boardAnimationDuration('system', true, 'white'), 100)
  assert.equal(boardAnimationDuration('reduced', false, 'white'), 100)
  assert.equal(boardAnimationDuration('reduced', true, 'white'), 100)
})
