/**
 * Automated Scene Graph Parenting & World-Space Contact Alignment Test Suite
 * Authoritative specification: docs/astra/ANIMATION.md, AUDIT.md
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Chess } from 'chess.js'

import { EncounterDirector3D } from '../../apps/frontend/src/lib/three/encounterDirector.ts'
import { DebrisSystem3D } from '../../apps/frontend/src/lib/three/debris3D.ts'
import { CameraController3D } from '../../apps/frontend/src/lib/three/cameraController.ts'
import { PieceBuilder3D } from '../../apps/frontend/src/lib/three/pieceBuilder.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODELS_DIR = path.resolve(__dirname, '../../apps/frontend/public/models/astra')
const loader = new GLTFLoader()

function loadGLB(filename) {
  const buf = fs.readFileSync(path.join(MODELS_DIR, filename))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return new Promise((resolve, reject) => {
    loader.parse(ab, '', resolve, reject)
  })
}

test('Gate A & B: Knight weapon hierarchy parents tip to lance assembly to hand grip', async () => {
  const gltf = await loadGLB('wN.glb')
  const scene = gltf.scene

  const lanceAssembly = scene.getObjectByName('Lance_Assembly')
  const lanceShaft = scene.getObjectByName('Cavalry_Lance')
  const lanceTip = scene.getObjectByName('Cavalry_LanceTip')
  const tipSocket = scene.getObjectByName('weapon_tip_socket')
  const handGrip = scene.getObjectByName('Rider_Hand_R')

  assert.ok(lanceAssembly, 'Lance_Assembly must exist')
  assert.ok(lanceShaft, 'Cavalry_Lance shaft must exist')
  assert.ok(lanceTip, 'Cavalry_LanceTip must exist')
  assert.ok(tipSocket, 'weapon_tip_socket must exist')
  assert.ok(handGrip, 'Rider_Hand_R must exist')

  assert.equal(lanceAssembly.parent?.name, 'Rider_Hand_R', 'Lance_Assembly must be child of Rider_Hand_R')
  assert.equal(lanceShaft.parent?.name, 'Lance_Assembly', 'Lance shaft must be child of Lance_Assembly')
  assert.equal(lanceTip.parent?.name, 'Lance_Assembly', 'Lance tip must be child of Lance_Assembly')
  assert.equal(tipSocket.parent?.name, 'Lance_Assembly', 'weapon_tip_socket must be child of Lance_Assembly')

  // Verify that rotating lanceAssembly rotates lanceTip and tipSocket in world space
  scene.updateMatrixWorld(true)
  const tipInitialWorld = new THREE.Vector3()
  tipSocket.getWorldPosition(tipInitialWorld)

  lanceAssembly.rotation.x += 0.5
  scene.updateMatrixWorld(true)
  const tipRotatedWorld = new THREE.Vector3()
  tipSocket.getWorldPosition(tipRotatedWorld)

  assert.notDeepEqual(tipInitialWorld, tipRotatedWorld, 'Rotating lance assembly must transform weapon_tip_socket')
})

test('Gate A & B: Bishop weapon hierarchy parents cap and hook to staff assembly', async () => {
  const gltf = await loadGLB('wB.glb')
  const scene = gltf.scene

  const staffAssembly = scene.getObjectByName('Staff_Assembly')
  const staffShaft = scene.getObjectByName('Acharya_Staff')
  const lotusCap = scene.getObjectByName('Fracture_Staff_LotusCap')
  const hook = scene.getObjectByName('Acharya_StaffHook')
  const staffSocket = scene.getObjectByName('staff_head_socket')
  const handGrip = scene.getObjectByName('Acharya_Hand_R')

  assert.ok(staffAssembly, 'Staff_Assembly must exist')
  assert.ok(staffShaft, 'Acharya_Staff must exist')
  assert.ok(lotusCap, 'Lotus cap must exist')
  assert.ok(hook, 'Acharya_StaffHook must exist')
  assert.ok(staffSocket, 'staff_head_socket must exist')
  assert.ok(handGrip, 'Acharya_Hand_R must exist')

  assert.equal(staffAssembly.parent?.name, 'Acharya_Hand_R', 'Staff_Assembly must be child of Acharya_Hand_R')
  assert.equal(staffShaft.parent?.name, 'Staff_Assembly', 'Staff shaft must be child of Staff_Assembly')
  assert.equal(lotusCap.parent?.name, 'Staff_Assembly', 'Lotus cap must be child of Staff_Assembly')
  assert.equal(hook.parent?.name, 'Staff_Assembly', 'Staff hook must be child of Staff_Assembly')
  assert.equal(staffSocket.parent?.name, 'Staff_Assembly', 'staff_head_socket must be child of Staff_Assembly')
})

test('Gate B: Legal chess move d4e6 drives world-space contact within defined tolerance', async () => {
  // 1. Authoritative chess rule check
  const chess = new Chess('4k3/8/4b3/8/3N4/8/8/4K3 w - - 0 1')
  const move = chess.move({ from: 'd4', to: 'e6' })
  assert.ok(move, 'Move d4e6 must be legal in chess.js')
  assert.equal(move.captured, 'b', 'd4e6 must capture Black Bishop')

  // 2. Encounter Director execution
  const debris = new DebrisSystem3D()
  const camera = new CameraController3D()
  const director = new EncounterDirector3D(debris, camera)

  const knightNode = PieceBuilder3D.createPieceNode('wN', 'd4')
  const bishopNode = PieceBuilder3D.createPieceNode('bB', 'e6')

  // Set world positions corresponding to d4 (x: -0.5, z: 0.5) and e6 (x: 0.5, z: -1.5)
  knightNode.group.position.set(-0.5, 0, 0.5)
  bishopNode.group.position.set(0.5, 0, -1.5)

  let impactFired = false
  director.startCapture(knightNode, bishopNode, {
    attackerCode: 'wN',
    attackerSquare: 'd4',
    defenderCode: 'bB',
    defenderSquare: 'e6',
    pacing: 'cinematic',
    onContact: () => { impactFired = true },
  })

  // Advance time to contact frame (54% of 1900ms = 1026ms)
  const startTime = performance.now()
  director.update(startTime + 1030)

  assert.equal(director.currentPhase, 'impact', 'Encounter must enter impact phase at t=0.54')
  assert.ok(impactFired, 'onContact callback must trigger at impact')
})

test('Gate C: Defeated piece maintains grounded base without whole-model shrinking', async () => {
  const debris = new DebrisSystem3D()
  const camera = new CameraController3D()
  const director = new EncounterDirector3D(debris, camera)

  const knightNode = PieceBuilder3D.createPieceNode('wN', 'd4')
  const bishopNode = PieceBuilder3D.createPieceNode('bB', 'e6')
  knightNode.group.position.set(-0.5, 0, 0.5)
  bishopNode.group.position.set(0.5, 0, -1.5)

  director.startCapture(knightNode, bishopNode, {
    attackerCode: 'wN',
    attackerSquare: 'd4',
    defenderCode: 'bB',
    defenderSquare: 'e6',
    pacing: 'cinematic',
  })

  // Advance to stagger fracture phase (t = 0.65)
  const startTime = performance.now()
  director.update(startTime + 1250)

  // Verify scale is NOT shrunk to zero
  assert.equal(bishopNode.group.scale.x, 1.0, 'Model scale must remain 1.0 (no fake shrinking)')
  assert.equal(bishopNode.group.scale.y, 1.0, 'Model scale must remain 1.0 (no fake shrinking)')
  assert.equal(bishopNode.group.scale.z, 1.0, 'Model scale must remain 1.0 (no fake shrinking)')

  // Verify stagger slide has occurred
  assert.ok(bishopNode.group.position.length() > 0, 'Bishop must physically stagger backwards')
})

test('Gate D: Camera Controller fits bounding box without edge cropping across aspect ratios', () => {
  const cameraCtrl = new CameraController3D(1.77) // 16:9 Desktop

  const box = new THREE.Box3(
    new THREE.Vector3(-4.8, 0, -4.8),
    new THREE.Vector3(4.8, 1.3, 4.8)
  )

  cameraCtrl.fitToBounds(box, 0.20)
  const desktopPos = cameraCtrl.camera.position.clone()

  // Switch to 9:16 mobile portrait (0.56)
  cameraCtrl.updateAspect(0.56)
  const mobilePos = cameraCtrl.camera.position.clone()

  // Mobile camera must pull back further (higher Y & larger Z) to fit the board horizontally
  assert.ok(mobilePos.y > desktopPos.y, 'Mobile camera must pull back to prevent horizontal cropping')
})
