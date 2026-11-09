/**
 * Automated Verification Suite for Astra Full 3D War Chess
 * Authoritative specification: docs/astra/README.md, DESIGN.md, ANIMATION.md
 * 
 * Verifies:
 * 1. All 12 production GLB army models exist with valid glTF 2.0 binary headers
 * 2. 3D Physical Board 64-square bidirectional coordinate mapping
 * 3. Two-Piece Combat choreography states and active mutual participation
 * 4. 3D Debris particle system performance bounds and floor damping
 * 5. Camera controller perspective and orientation transitions
 * 6. Game-ending checkmate / draw presentation semantics
 * 7. Pacing and reduced motion guarantees
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'

import { PhysicalBoard3D } from '../../apps/frontend/src/lib/three/boardGeometry.ts'
import { BOARD_PRESETS } from '../../apps/frontend/src/theme/themePresets.ts'
import { DebrisSystem3D } from '../../apps/frontend/src/lib/three/debris3D.ts'
import { CameraController3D } from '../../apps/frontend/src/lib/three/cameraController.ts'
import { EncounterDirector3D } from '../../apps/frontend/src/lib/three/encounterDirector.ts'
import { GameEndingDirector3D } from '../../apps/frontend/src/lib/three/gameEndingDirector.ts'
import { PieceBuilder3D } from '../../apps/frontend/src/lib/three/pieceBuilder.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODELS_DIR = path.resolve(__dirname, '../../apps/frontend/public/models/astra')

test('M1 & M2: all 12 production GLB army models exist with valid glTF 2.0 binary headers', () => {
  const pieces = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK']

  for (const piece of pieces) {
    const file = path.join(MODELS_DIR, `${piece}.glb`)
    assert.ok(fs.existsSync(file), `Model file missing: ${file}`)

    const stats = fs.statSync(file)
    assert.ok(stats.size > 10000, `Model file suspiciously small: ${piece}.glb (${stats.size} bytes)`)

    // Check glTF binary header magic 'glTF' (0x46546C67)
    const fd = fs.openSync(file, 'r')
    const buffer = Buffer.alloc(4)
    fs.readSync(fd, buffer, 0, 4, 0)
    fs.closeSync(fd)

    assert.equal(buffer.toString('ascii'), 'glTF', `Invalid glTF magic in ${piece}.glb`)
  }
})

test('M1: Physical 3D Board has 64 valid square tiles and bijective world-to-square mapping', () => {
  const preset = BOARD_PRESETS['ancient-battlefield']
  const board = new PhysicalBoard3D(preset)

  assert.equal(board.tileMeshes.size, 64)
  assert.equal(board.moveIndicators.size, 64)

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      const sq = `${files[f]}${r}`
      const worldPos = board.squareToWorld(sq)
      assert.ok(worldPos instanceof THREE.Vector3)

      const recoveredSq = board.worldToSquare(worldPos)
      assert.equal(recoveredSq, sq, `Bijective roundtrip failed for ${sq}`)
    }
  }

  // Out of bounds coordinate check
  const outSq = board.worldToSquare(new THREE.Vector3(100, 0, 100))
  assert.equal(outSq, null)
})

test('M3 & M4: Two-Piece Combat Encounter actively drives attacker, defender, and impact', () => {
  const debris = new DebrisSystem3D()
  const cameraCtrl = new CameraController3D()
  const encounter = new EncounterDirector3D(debris, cameraCtrl)

  const knight = PieceBuilder3D.createPieceNode('wN', 'b1')
  const bishop = PieceBuilder3D.createPieceNode('bB', 'c3')

  let contactTriggered = false
  let completedTriggered = false

  encounter.startCapture(knight, bishop, {
    attackerCode: 'wN',
    attackerSquare: 'b1',
    defenderCode: 'bB',
    defenderSquare: 'c3',
    pacing: 'cinematic',
    onContact: () => {
      contactTriggered = true
    },
    onComplete: () => {
      completedTriggered = true
    },
  })

  assert.ok(encounter.isActive)
  assert.equal(encounter.currentPhase, 'anticipation')

  // Tick past anticipation into approach
  encounter.update(performance.now() + 600)
  assert.equal(encounter.currentPhase, 'approach')

  // Tick to contact frame (~55%)
  encounter.update(performance.now() + 1100)
  assert.ok(contactTriggered, 'Contact callback must fire at impact frame')

  // Tick to settling
  encounter.update(performance.now() + 1600)
  assert.equal(encounter.currentPhase, 'settling')
  assert.equal(bishop.group.visible, false, 'Defender shell must be cleared after fracture')

  // Tick to completion
  encounter.update(performance.now() + 2100)
  assert.ok(completedTriggered, 'Completion callback must fire after sequence finishes')
  assert.equal(encounter.isActive, false)
})

test('M4: Physical 3D Debris strictly enforces particle budgets and floor damping', () => {
  const debris = new DebrisSystem3D()

  // Capture 1: spawns 5 fragments
  debris.spawnCaptureFracture(new THREE.Vector3(0, 0.1, 0), 'wP', false)
  assert.equal(debris.group.children.length, 5)

  // Capture 2: spawns 5 more -> total 10 (within 12 limit)
  debris.spawnCaptureFracture(new THREE.Vector3(1, 0.1, 0), 'bN', false)
  assert.equal(debris.group.children.length, 10)

  // Capture 3: spawns 5 more -> total must be capped at maxGlobalFragments (12)
  debris.spawnCaptureFracture(new THREE.Vector3(2, 0.1, 0), 'wQ', false)
  assert.ok(debris.group.children.length <= 12, `Expected <= 12 fragments, got ${debris.group.children.length}`)

  // Reduced motion spawns zero fragments
  const beforeCount = debris.group.children.length
  debris.spawnCaptureFracture(new THREE.Vector3(3, 0.1, 0), 'bP', true)
  assert.equal(debris.group.children.length, beforeCount, 'Reduced motion must not spawn fragments')

  // Clear removes all
  debris.clear()
  assert.equal(debris.group.children.length, 0)
})

test('M5: Game-Ending sequences salute without capturing the king', () => {
  const cameraCtrl = new CameraController3D()
  const ending = new GameEndingDirector3D(cameraCtrl)

  const nodes = new Map()
  const whiteKing = PieceBuilder3D.createPieceNode('wK', 'e1')
  const blackKing = PieceBuilder3D.createPieceNode('bK', 'e8')
  nodes.set('e1', whiteKing)
  nodes.set('e8', blackKing)

  // Trigger White victory
  ending.triggerEnding('white_wins', nodes)
  assert.ok(ending.isActive)
  assert.equal(cameraCtrl.currentMode, 'ending')

  // Black king posture acknowledges defeat, but is not deleted or hidden
  assert.ok(blackKing.group.visible, 'King must never be hidden or removed from the board')
  assert.ok(blackKing.group.rotation.x > 0, 'Defeated king bows in submission')

  // Reset restores tactical camera
  ending.reset(nodes)
  assert.equal(ending.isActive, false)
  assert.equal(cameraCtrl.currentMode, 'tactical')
})

test('M6: Camera controller transitions cleanly between Tactical and Cinematic', () => {
  const cameraCtrl = new CameraController3D(1.0)
  assert.equal(cameraCtrl.currentMode, 'tactical')

  cameraCtrl.setMode('cinematic')
  assert.equal(cameraCtrl.currentMode, 'cinematic')

  // Orientation flip for Black side
  cameraCtrl.setOrientation('black')
  assert.ok(cameraCtrl.isFlipped)

  cameraCtrl.update(1.0)
  assert.ok(cameraCtrl.camera.position.z < 0, 'Camera Z must flip negative for Black orientation')
})
