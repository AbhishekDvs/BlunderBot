/**
 * WebGL Three.js 2.5D Sprite Atlas Renderer
 * Renders 64-frame (8x8 @ 256x256 = 2048x2048) animated sprite sheets for all 12
 * Deva (White) and Asura (Black) Indian War Chess units from the rigged GLBs in
 * apps/frontend/public/models/astra-dev-v02/ at calibrated 48° tactical elevation,
 * with both front-3/4 and back-3/4 directional views for board-flip support.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const MODELS_DIR = path.join(ROOT, 'apps/frontend/public/models/astra-dev-v02')
const THREE_DIR = path.join(ROOT, 'node_modules/three')
const FRAMES_DIR = path.join(os.tmpdir(), 'blunderbot_atlas_sheets')
fs.mkdirSync(FRAMES_DIR, { recursive: true })

function findChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  throw new Error('No Chromium/Chrome/Edge executable found for WebGL atlas rendering')
}

const RENDER_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:transparent">
<script type="importmap">
{
  "imports": {
    "three": "/three/build/three.module.js",
    "three/addons/": "/three/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CELL = 256;
const GRID = 8;
const SIZE = CELL * GRID; // 2048

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setSize(CELL, CELL, false);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = false;

const sheetCanvas = document.createElement('canvas');
sheetCanvas.width = SIZE;
sheetCanvas.height = SIZE;
const sheetCtx = sheetCanvas.getContext('2d');

const scene = new THREE.Scene();

const hemi = new THREE.HemisphereLight(0xfff6e8, 0x342a22, 1.45);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xfff7e6, 2.35);
keyLight.position.set(-4.5, 8.5, 5.5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xdce8ff, 1.15);
fillLight.position.set(4.5, 5.0, 4.0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffcb78, 1.85);
rimLight.position.set(0.5, 5.5, -6.5);
scene.add(rimLight);

const camera = new THREE.OrthographicCamera(-0.6, 0.6, 0.6, -0.6, 0.1, 30);

function applyFactionPalette(root, isBlack, classChar) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const cloned = mats.map((m) => {
      const nm = m.clone();
      const name = (nm.name || '').toLowerCase();
      const meshName = (obj.name || '').toLowerCase();

      if (!isBlack) {
        // White Deva Kingdom: Warm Ivory Marble, Polished Gold, Saffron, Forest Green
        if (name.includes('stone') || name.includes('plinth')) {
          nm.color.setHex(0xf1e8d7);
          nm.roughness = 0.36;
          nm.metalness = 0.05;
        } else if (name.includes('cloth') && !name.includes('green')) {
          nm.color.setHex(meshName.includes('dhoti') || meshName.includes('skirt') ? 0xe8d9be : 0xf4ede0);
          nm.roughness = 0.60;
        } else if (name.includes('saffron') || name.includes('vermilion')) {
          nm.color.setHex(0xde6426);
          nm.roughness = 0.50;
        } else if (name.includes('green')) {
          nm.color.setHex(0x2e6b46);
          nm.roughness = 0.56;
        } else if (name.includes('gold')) {
          nm.color.setHex(0xebb53d);
          nm.roughness = 0.24;
          nm.metalness = 0.88;
        } else if (name.includes('bronze')) {
          nm.color.setHex(0xc89242);
          nm.roughness = 0.30;
          nm.metalness = 0.80;
        } else if (name.includes('steel')) {
          nm.color.setHex(0xdce4ee);
          nm.roughness = 0.18;
          nm.metalness = 0.94;
        } else if (name.includes('timber')) {
          nm.color.setHex(0x6e4427);
          nm.roughness = 0.62;
        }
        if (meshName.includes('plinth')) {
          nm.color.setHex(0xe5d8c0);
        }
        if (meshName.includes('cuirass') && !meshName.includes('trim')) {
          nm.color.setHex(0xc89242);
          nm.metalness = 0.72;
          nm.roughness = 0.32;
        }
        if (classChar === 'Q' && meshName.includes('skirt')) {
          nm.color.setHex(0xc93b2b);
        }
        if (classChar === 'K' && meshName.includes('dhoti')) {
          nm.color.setHex(0xd99b2e);
        }
      } else {
        // Black Asura Army: Volcanic Basalt, Dark Iron, Burnished Brass, Imperial Crimson
        if (name.includes('stone') || name.includes('plinth')) {
          nm.color.setHex(0x222127);
          nm.roughness = 0.28;
          nm.metalness = 0.24;
        } else if (name.includes('cloth') && !name.includes('green')) {
          nm.color.setHex(0x4a161d);
          nm.roughness = 0.52;
        } else if (name.includes('saffron') || name.includes('vermilion')) {
          nm.color.setHex(0xb81d27);
          nm.roughness = 0.45;
        } else if (name.includes('green')) {
          nm.color.setHex(0x751a24);
          nm.roughness = 0.50;
        } else if (name.includes('gold')) {
          nm.color.setHex(0xde9f38);
          nm.roughness = 0.26;
          nm.metalness = 0.88;
        } else if (name.includes('bronze')) {
          nm.color.setHex(0x5b4a3e);
          nm.roughness = 0.32;
          nm.metalness = 0.82;
        } else if (name.includes('steel')) {
          nm.color.setHex(0x909bab);
          nm.roughness = 0.22;
          nm.metalness = 0.92;
        } else if (name.includes('timber')) {
          nm.color.setHex(0x2c1d18);
          nm.roughness = 0.55;
        }
        if (meshName.includes('plinth')) {
          nm.color.setHex(0x18171c);
        }
        if (meshName.includes('body') || meshName.includes('horse') || meshName.includes('bastion') || meshName.includes('turret') || meshName.includes('merlon')) {
          nm.color.setHex(0x27262d);
          nm.roughness = 0.30;
          nm.metalness = 0.22;
        }
        if (classChar === 'Q' && meshName.includes('skirt')) {
          nm.color.setHex(0x75161f);
        }
        if (classChar === 'K' && meshName.includes('dhoti')) {
          nm.color.setHex(0x63151d);
        }
        nm.emissive.setHex(0x1d120d);
        nm.emissiveIntensity = 0.26;
      }
      nm.needsUpdate = true;
      return nm;
    });
    obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
  });
}

// Fix clipping meshes & refine silhouette geometry at load time
function cleanAndTuneMeshes(root, classChar) {
  const hideNames = new Set([
    'Acharya_Debris_Chunk_1', 'Acharya_Debris_Chunk_2', 'Acharya_Debris_Chunk_3',
    'Samrajni_Debris_Chunk_1', 'Samrajni_Debris_Chunk_2', 'Samrajni_Debris_Chunk_3',
    'Raja_Debris_Chunk_1', 'Raja_Debris_Chunk_2', 'Raja_Debris_Chunk_3',
    'Pawn_Debris_Chunk_1', 'Pawn_Debris_Chunk_2', 'Pawn_Debris_Chunk_3',
    'Ashva_Debris_Chunk_1', 'Ashva_Debris_Chunk_2', 'Ashva_Debris_Chunk_3',
    'Durg_Debris_Chunk_1', 'Durg_Debris_Chunk_2', 'Durg_Debris_Chunk_3',
  ]);
  if (classChar === 'B') {
    hideNames.add('Acharya_ShoulderShawl');
  } else if (classChar === 'Q') {
    hideNames.add('Samrajni_Silk_Veil');
    hideNames.add('Samrajni_Pallu_Sash');
  } else if (classChar === 'K') {
    hideNames.add('Raja_Royal_Mantle');
  }

  root.traverse((o) => {
    if (hideNames.has(o.name)) {
      o.visible = false;
      return;
    }
    // Convert rigid lower-body cylinders into knee-length tunics so articulated legs & feet stride visibly!
    if (o.name === 'Acharya_Dhoti' || o.name === 'Samrajni_Sari_Skirt' || o.name === 'Raja_Dhoti') {
      o.scale.set(0.84, 0.44, 0.84);
      o.position.y += 0.14;
    }
    // Connect Cavalry lance shaft solidly to steel spear tip
    if (o.name === 'Cavalry_Lance') {
      o.scale.y *= 1.32;
    }
    // Make Rook wheels more prominent & clearly readable
    if (classChar === 'R' && o.name.startsWith('wheel_') && !o.name.includes('_Rim') && !o.name.includes('_Hub')) {
      o.scale.setScalar(1.22);
    }
  });
}

function captureRestPose(root) {
  const rest = new Map();
  root.traverse((o) => {
    if (o.isBone || o.name.startsWith('wheel_') || o.name === 'chassis' || o.name === 'ram' || o.name === 'banner' || o.name === 'portcullis' || o.name === 'turret') {
      rest.set(o.name, {
        pos: o.position.clone(),
        rot: o.rotation.clone(),
        quat: o.quaternion.clone(),
      });
    }
  });
  return rest;
}

function resetPose(root, rest) {
  root.traverse((o) => {
    const r = rest.get(o.name);
    if (r) {
      o.position.copy(r.pos);
      o.quaternion.copy(r.quat);
    }
  });
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
}

function applyProceduralPose(root, rest, classChar, clipName, u) {
  const get = (name) => root.getObjectByName(name);
  const addRot = (name, rx, ry, rz) => {
    const obj = get(name);
    const r = rest.get(name);
    if (!obj || !r) return;
    const delta = new THREE.Euler(rx, ry, rz, 'XYZ');
    const qDelta = new THREE.Quaternion().setFromEuler(delta);
    obj.quaternion.copy(r.quat).multiply(qDelta);
  };
  const addPos = (name, px, py, pz) => {
    const obj = get(name);
    const r = rest.get(name);
    if (!obj || !r) return;
    obj.position.set(r.pos.x + px, r.pos.y + py, r.pos.z + pz);
  };

  if (classChar === 'P' || classChar === 'B' || classChar === 'Q' || classChar === 'K') {
    // Natural martial posture (removes any T-pose rest artifact)
    if (classChar === 'B') {
      addRot('upper_armL', 0.25, 0.15, -0.92);
      addRot('forearmL', 0.55, 0, -0.20);
      addRot('upper_armR', 0.35, -0.25, 0.78);
      addRot('forearmR', 0.65, 0.20, 0.10);
    } else if (classChar === 'Q') {
      addRot('upper_armL', 0.12, 0, -0.45);
      addRot('forearmL', 0.35, 0, -0.15);
      addRot('upper_armR', 0.28, 0, 0.40);
      addRot('forearmR', 0.42, 0, 0.10);
    } else if (classChar === 'K') {
      addRot('upper_armL', 0.15, 0.15, -0.58);
      addRot('forearmL', 0.45, 0, -0.25);
      addRot('upper_armR', 0.25, -0.15, 0.52);
      addRot('forearmR', 0.45, 0, 0.20);
    } else if (classChar === 'P') {
      addRot('upper_armL', 0.15, 0, -0.28);
      addRot('upper_armR', 0.20, 0, 0.28);
    }

    if (clipName === 'idle') {
      const breath = Math.sin(u * Math.PI * 2);
      addPos('pelvis', 0, breath * 0.012, 0);
      addRot('chest', breath * 0.04, 0, 0);
      addRot('head', -breath * 0.03, Math.sin(u * Math.PI * 2) * 0.06, 0);
      addRot('upper_armR', breath * 0.05, 0, 0);
      addRot('upper_armL', -breath * 0.04, 0, 0);
    } else if (clipName === 'move') {
      const phase = u * Math.PI * 2;
      const swing = Math.sin(phase);
      const liftL = Math.max(0, Math.sin(phase));
      const liftR = Math.max(0, -Math.sin(phase));
      const strideAmp = classChar === 'K' ? 0.56 : (classChar === 'Q' ? 0.62 : 0.66);

      addRot('thighL', swing * strideAmp, 0, 0);
      addRot('thighR', -swing * strideAmp, 0, 0);
      addRot('shinL', -liftL * 0.78, 0, 0);
      addRot('shinR', -liftR * 0.78, 0, 0);
      addRot('footL', liftL * 0.36, 0, 0);
      addRot('footR', liftR * 0.36, 0, 0);

      const doubleBob = Math.abs(Math.sin(phase));
      addPos('pelvis', 0, doubleBob * 0.04, 0);
      addRot('pelvis', 0.07, swing * 0.14, 0);
      addRot('chest', 0.09, -swing * 0.18, 0);
      addRot('head', -0.06, swing * 0.06, 0);

      addRot('upper_armL', -swing * 0.48, 0, 0);
      addRot('forearmL', 0.28 + liftR * 0.25, 0, 0);
      addRot('upper_armR', swing * 0.44, 0, 0);
      addRot('forearmR', 0.22 + liftL * 0.22, 0, 0);
    } else if (clipName === 'attack_anticipation') {
      const t = u;
      addRot('chest', -0.22 * t, -0.35 * t, 0);
      addRot('upper_armR', -1.15 * t, 0, 0.35 * t);
      addRot('forearmR', -0.40 * t, 0, 0);
      addRot('upper_armL', 0.35 * t, 0.3 * t, -0.2 * t);
      addRot('thighL', -0.25 * t, 0, 0);
      addRot('thighR', 0.20 * t, 0, 0);
    } else if (clipName === 'attack') {
      const p = Math.sin(Math.min(1, u * 1.15) * Math.PI);
      const lunge = u < 0.5 ? u * 2 : 1 - (u - 0.5) * 1.2;
      addPos('pelvis', 0, -0.04 * lunge, 0.08 * lunge);
      addRot('chest', 0.32 * p, 0.45 * p, 0);
      addRot('upper_armR', -1.0 * (1 - u * 1.6) + 0.9 * p, -0.25 * p, 0.2 * p);
      addRot('forearmR', 0.45 * p, 0, 0);
      addRot('thighL', 0.45 * lunge, 0, 0);
      addRot('thighR', -0.45 * lunge, 0, 0);
      addRot('shinL', -0.35 * lunge, 0, 0);
    } else if (clipName === 'defend') {
      const p = Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5);
      addPos('pelvis', 0, -0.04 * p, -0.03 * p);
      addRot('chest', 0.14 * p, -0.28 * p, 0);
      addRot('upper_armL', -0.75 * p, 0.45 * p, -0.2 * p);
      addRot('forearmL', 0.55 * p, 0, 0);
      addRot('upper_armR', -0.55 * p, -0.35 * p, 0.35 * p);
      addRot('thighL', 0.30 * p, 0, 0);
      addRot('thighR', -0.25 * p, 0, 0);
    } else if (clipName === 'hit') {
      const p = Math.sin(u * Math.PI);
      addRot('chest', -0.42 * p, 0.18 * p, -0.12 * p);
      addRot('head', -0.35 * p, 0, 0);
      addRot('upper_armL', -0.3 * p, 0, -0.4 * p);
      addRot('upper_armR', -0.3 * p, 0, 0.4 * p);
    } else if (clipName === 'stagger') {
      const p = Math.sin(u * Math.PI);
      addPos('pelvis', 0, -0.05 * p, -0.10 * p);
      addRot('chest', -0.35 * p, 0, 0.15 * p);
      addRot('thighL', -0.40 * p, 0, 0);
      addRot('thighR', 0.30 * p, 0, 0);
    } else if (clipName === 'defeat') {
      const p = Math.min(1, u * 1.25);
      if (classChar === 'K') {
        addPos('pelvis', 0, -0.22 * p, 0);
        addRot('thighL', 0.95 * p, 0, 0);
        addRot('shinL', -1.25 * p, 0, 0);
        addRot('thighR', -0.35 * p, 0, 0);
        addRot('shinR', -1.05 * p, 0, 0);
        addRot('chest', 0.35 * p, 0, 0);
        addRot('head', 0.55 * p, 0, 0);
        addRot('upper_armR', 0.45 * p, 0, 0);
      } else {
        addPos('pelvis', 0, -0.28 * p, -0.08 * p);
        addRot('chest', -0.75 * p, 0.25 * p, 0.25 * p);
        addRot('thighL', 0.85 * p, 0, 0);
        addRot('shinL', -1.1 * p, 0, 0);
        addRot('upper_armL', -0.5 * p, 0, -0.7 * p);
        addRot('upper_armR', -0.4 * p, 0, 0.6 * p);
      }
    } else if (clipName === 'victory') {
      const pump = Math.abs(Math.sin(u * Math.PI * 2));
      addRot('chest', -0.12, 0, 0);
      addRot('upper_armR', -1.35 - pump * 0.25, 0, 0.25);
      addRot('forearmR', -0.25, 0, 0);
      addRot('upper_armL', -0.55 - pump * 0.20, 0, -0.35);
      addPos('pelvis', 0, pump * 0.03, 0);
    } else if (clipName === 'draw') {
      const p = Math.sin(u * Math.PI * 0.5);
      addRot('chest', 0.18 * p, 0, 0);
      addRot('head', 0.28 * p, 0, 0);
      addRot('upper_armR', 0.35 * p, 0, 0.15 * p);
    }
  } else if (classChar === 'N') {
    if (clipName === 'idle') {
      const b = Math.sin(u * Math.PI * 2);
      addPos('horse_spine', 0, b * 0.015, 0);
      addRot('horse_neck', b * 0.06, 0, 0);
      addRot('horse_head', -b * 0.05, 0, 0);
      addRot('rider_torso', b * 0.04, 0, 0);
    } else if (clipName === 'move') {
      const p = u * Math.PI * 2;
      const fSwing = Math.sin(p);
      const bSwing = Math.sin(p + 0.8);
      addPos('horse_spine', 0, Math.abs(Math.sin(p)) * 0.065, 0);
      addRot('horse_spine', Math.cos(p) * 0.14, 0, 0);
      addRot('horse_neck', Math.sin(p) * 0.18 - 0.10, 0, 0);
      addRot('horse_head', -Math.sin(p) * 0.12, 0, 0);

      addRot('leg_FL_upper', fSwing * 0.62, 0, 0);
      addRot('leg_FL_lower', Math.max(0, fSwing) * 0.72, 0, 0);
      addRot('leg_FR_upper', Math.sin(p + 0.5) * 0.62, 0, 0);
      addRot('leg_FR_lower', Math.max(0, Math.sin(p + 0.5)) * 0.72, 0, 0);

      addRot('leg_BL_upper', -bSwing * 0.58, 0, 0);
      addRot('leg_BL_lower', Math.max(0, bSwing) * 0.55, 0, 0);
      addRot('leg_BR_upper', -Math.sin(p + 1.3) * 0.58, 0, 0);
      addRot('leg_BR_lower', Math.max(0, Math.sin(p + 1.3)) * 0.55, 0, 0);

      addRot('rider_torso', 0.14 + Math.cos(p) * 0.08, 0, 0);
      addRot('rider_arm_R', Math.sin(p) * 0.22, 0, 0);
    } else if (clipName === 'attack_anticipation') {
      const t = u;
      addPos('horse_spine', 0, 0.12 * t, 0);
      addRot('horse_spine', -0.48 * t, 0, 0);
      addRot('leg_FL_upper', -0.85 * t, 0, 0);
      addRot('leg_FL_lower', 0.90 * t, 0, 0);
      addRot('leg_FR_upper', -0.75 * t, 0, 0);
      addRot('leg_FR_lower', 0.85 * t, 0, 0);
      addRot('rider_torso', 0.22 * t, 0, 0);
      addRot('rider_arm_R', -0.65 * t, 0, 0);
    } else if (clipName === 'attack') {
      const p = Math.sin(u * Math.PI);
      addPos('horse_spine', 0, 0.04 * p, 0.08 * p);
      addRot('horse_spine', 0.24 * p, 0, 0);
      addRot('leg_FL_upper', 0.65 * p, 0, 0);
      addRot('leg_FR_upper', 0.45 * p, 0, 0);
      addRot('rider_torso', 0.35 * p, 0, 0);
      addRot('rider_arm_R', 1.15 * p, 0, 0);
    } else if (clipName === 'defend') {
      const p = Math.sin(u * Math.PI * 0.5);
      addRot('horse_spine', 0, 0.35 * p, 0);
      addRot('rider_arm_R', -0.35 * p, 0.4 * p, 0);
    } else if (clipName === 'hit' || clipName === 'stagger') {
      const p = Math.sin(u * Math.PI);
      addRot('horse_spine', -0.25 * p, 0.18 * p, 0);
      addRot('rider_torso', -0.35 * p, 0, 0);
    } else if (clipName === 'defeat') {
      const p = Math.min(1, u * 1.25);
      addPos('horse_spine', 0, -0.24 * p, 0);
      addRot('horse_spine', 0.35 * p, 0, 0.45 * p);
      addRot('rider_torso', 0.5 * p, 0, 0.35 * p);
    } else if (clipName === 'victory') {
      const p = 0.7 + 0.3 * Math.sin(u * Math.PI * 2);
      addPos('horse_spine', 0, 0.08 * p, 0);
      addRot('horse_spine', -0.32 * p, 0, 0);
      addRot('leg_FL_upper', -0.65 * p, 0, 0);
      addRot('leg_FR_upper', -0.55 * p, 0, 0);
      addRot('rider_arm_R', -1.1 * p, 0, 0);
    } else if (clipName === 'draw') {
      const p = Math.sin(u * Math.PI * 0.5);
      addRot('horse_neck', 0.22 * p, 0, 0);
      addRot('rider_torso', 0.18 * p, 0, 0);
    }
  } else if (classChar === 'R') {
    if (clipName === 'idle') {
      const b = Math.sin(u * Math.PI * 2);
      addRot('banner', 0, b * 0.18, b * 0.12);
      addPos('chassis', 0, b * 0.008, 0);
    } else if (clipName === 'move') {
      const angle = u * Math.PI * 2;
      addRot('wheel_FL', angle, 0, 0);
      addRot('wheel_FR', angle, 0, 0);
      addRot('wheel_BL', angle, 0, 0);
      addRot('wheel_BR', angle, 0, 0);
      addPos('chassis', 0, Math.abs(Math.sin(angle * 2)) * 0.036, 0);
      addRot('chassis', Math.sin(angle * 2) * 0.045, 0, Math.cos(angle * 2) * 0.032);
      addRot('banner', -0.18, Math.sin(angle * 2) * 0.30, Math.cos(angle) * 0.22);
    } else if (clipName === 'attack_anticipation') {
      addPos('ram', 0, 0, -0.20 * u);
      addRot('chassis', -0.08 * u, 0, 0);
    } else if (clipName === 'attack') {
      const p = Math.sin(u * Math.PI);
      addPos('ram', 0, 0, 0.40 * p);
      addPos('chassis', 0, 0.025 * p, 0.08 * p);
      addRot('chassis', 0.08 * p, 0, 0);
    } else if (clipName === 'defend') {
      const p = Math.sin(u * Math.PI * 0.5);
      addPos('portcullis', 0, -0.20 * p, 0);
    } else if (clipName === 'hit' || clipName === 'stagger') {
      const p = Math.sin(u * Math.PI);
      addRot('chassis', -0.16 * p, 0, 0.12 * p);
    } else if (clipName === 'defeat') {
      const p = Math.min(1, u * 1.2);
      addPos('turret', 0, -0.20 * p, 0);
      addRot('chassis', 0.14 * p, 0, 0.20 * p);
    } else if (clipName === 'victory') {
      const p = Math.abs(Math.sin(u * Math.PI * 2));
      addPos('chassis', 0, p * 0.035, 0);
      addRot('banner', 0, Math.sin(u * Math.PI * 2) * 0.40, 0.22);
    } else if (clipName === 'draw') {
      addPos('ram', 0, 0, -0.06 * u);
    }
  }
}

const CLIPS = [
  ['idle', 8],
  ['move', 12],
  ['attack_anticipation', 4],
  ['attack', 8],
  ['defend', 6],
  ['hit', 4],
  ['stagger', 6],
  ['defeat', 6],
  ['victory', 6],
  ['draw', 4],
];

const ORTHO_SCALE = {
  P: 0.72,
  R: 0.78,
  N: 0.94,
  B: 0.84,
  Q: 0.82,
  K: 0.88,
};

const TARGET_Y = {
  P: 0.50,
  R: 0.54,
  N: 0.58,
  B: 0.62,
  Q: 0.62,
  K: 0.66,
};

const loader = new GLTFLoader();
const pieces = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK'];

for (const pieceCode of pieces) {
  const isBlack = pieceCode.startsWith('b');
  const classChar = pieceCode.slice(1);
  const srcCode = 'w' + classChar;
  const gltf = await loader.loadAsync('/models/' + srcCode + '.glb');
  const root = gltf.scene;

  cleanAndTuneMeshes(root, classChar);
  applyFactionPalette(root, isBlack, classChar);

  const wrapper = new THREE.Group();
  wrapper.add(root);
  scene.add(wrapper);

  const rest = captureRestPose(root);

  const frontAzimuthDeg = classChar === 'N' ? 132 : (classChar === 'R' ? 32 : 24);
  const backAzimuthDeg  = classChar === 'N' ? 42  : (classChar === 'R' ? 148 : 148);

  for (const [dirName, azDeg] of [['front', frontAzimuthDeg], ['back', backAzimuthDeg]]) {
    const elev = THREE.MathUtils.degToRad(48);
    const az = THREE.MathUtils.degToRad(azDeg);
    const dist = 6.0;
    const h = ORTHO_SCALE[classChar];
    camera.left = -h;
    camera.right = h;
    camera.top = h;
    camera.bottom = -h;
    camera.updateProjectionMatrix();

    const horiz = dist * Math.cos(elev);
    camera.position.set(
      horiz * Math.sin(az),
      TARGET_Y[classChar] + dist * Math.sin(elev),
      horiz * Math.cos(az)
    );
    camera.lookAt(0, TARGET_Y[classChar], 0);

    sheetCtx.clearRect(0, 0, SIZE, SIZE);

    let cellIdx = 0;
    for (const [clipName, count] of CLIPS) {
      for (let i = 0; i < count; i++) {
        const u = count > 1 ? i / count : 0;
        resetPose(root, rest);
        applyProceduralPose(root, rest, classChar, clipName, u);
        root.updateMatrixWorld(true);

        renderer.clear();
        renderer.render(scene, camera);

        const col = cellIdx % GRID;
        const row = Math.floor(cellIdx / GRID);
        sheetCtx.drawImage(renderer.domElement, col * CELL, row * CELL, CELL, CELL);
        cellIdx++;
      }
    }

    const blob = await new Promise((resolve) => sheetCanvas.toBlob(resolve, 'image/png'));
    const buf = await blob.arrayBuffer();
    await fetch('/save?name=' + encodeURIComponent(pieceCode + '_sheet_' + dirName + '.png'), {
      method: 'POST',
      body: buf,
    });
  }

  scene.remove(wrapper);
}

await fetch('/done', { method: 'POST', body: 'ok' });
</script>
</body>
</html>`;

let proc;
let timeoutId;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(RENDER_HTML);
  } else if (url.pathname === '/save') {
    const name = path.basename(url.searchParams.get('name') || 'out.png');
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => {
      const outPath = path.join(FRAMES_DIR, name);
      fs.writeFileSync(outPath, Buffer.concat(chunks));
      console.log('Saved', name);
      res.writeHead(200);
      res.end('ok');
    });
  } else if (url.pathname === '/done') {
    res.writeHead(200);
    res.end('done');
    clearTimeout(timeoutId);
    proc?.kill();
    server.close();
    console.log('Packing WebP atlases via pack_animated_atlases.py...');
    execFileSync('python', [path.join(ROOT, 'scripts/astra/pack_animated_atlases.py'), FRAMES_DIR], {
      stdio: 'inherit',
    });
  } else if (url.pathname.startsWith('/three/')) {
    const rel = url.pathname.replace('/three/', '');
    const fp = path.join(THREE_DIR, rel);
    res.writeHead(200, { 'Content-Type': fp.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } else if (url.pathname.startsWith('/models/')) {
    const rel = url.pathname.replace('/models/', '');
    const fp = path.join(MODELS_DIR, rel);
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
    fs.createReadStream(fp).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const chrome = findChrome();
  console.log('Launching headless WebGL atlas renderer on port', port);
  proc = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    `http://127.0.0.1:${port}/`,
  ], { stdio: 'ignore' });
  timeoutId = setTimeout(() => {
    console.error('Atlas rendering timed out');
    proc?.kill();
    server.close();
    process.exit(1);
  }, 240000);
});
