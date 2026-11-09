# BlunderBot: 2.5D Stylized Indian War Chess & Combat Animation Roadmap

## 1. Executive Summary & Status

BlunderBot has pivoted from static figurine sculpts to an ancient Indian medieval military chess game inspired by classic RTS and tactical battle games (Warcraft III, Mosslight Isle). Units feature authentic character movement, weight transfer, weapon anticipation, synchronized two-character melee/ranged clashes, impact trauma, and physical construct fractures.

### Current Implementation State
- **Branch**: `feature/2p5d-stylized-indian-war-chess`
- **Render Engine**: Three.js WebGL with orthographic-projected 2.5D animated sprite billboarding tilted at $-33.2^\circ$ ($-0.58$ rad) facing a calibrated $48^\circ$ tactical camera.
- **Sprite Architecture**: 8×8 grid lossless WebP texture atlases ($2048 \times 2048$ px, 64 frames per unit at $256 \times 256$ px per cell). Instanced Three.js materials share GPU texture memory and independently cycle UV coordinates per instance.
- **Armies**:
  - **White (Deva Kingdom)**: Raja (King), Samrajni (Queen), Acharya (Bishop), Ashva Senani (Knight), Durg (Rook), Padati (Pawn). Finished in polished white marble, warm beaten gold, lapis lazuli accents, and saffron robes.
  - **Black (Asura Army)**: Volcanic basalt stone, hammered dark iron, antique brass mounts, and imperial crimson silks.
- **Animation Clips per Unit (10 actions)**:
  1. `idle` (12 frames, 10 fps, looping)
  2. `move` (12 frames, 14 fps, looping)
  3. `attack_anticipation` (6 frames, 12 fps, hold last frame)
  4. `attack` (6 frames, 16 fps, one-shot)
  5. `defend` (6 frames, 12 fps, hold)
  6. `hit` (6 frames, 16 fps, one-shot)
  7. `stagger` (6 frames, 12 fps, one-shot)
  8. `defeat` (4 frames, 10 fps, hold last frame)
  9. `victory` (4 frames, 8 fps, looping)
  10. `draw` (2 frames, 4 fps, looping)

---

## 2. Technical Architecture & Delivered Pipeline

```
Procedural Blender Rig (build_*.py)
  ├── Explicit PoseBone XYZ Euler Rotations
  ├── 10 Authored Skeletal Actions
  └── Exported .blend & .glb Assets
         │
         ▼
Blender Headless Renderer (render_animated_atlases.py)
  ├── 48° Elevation Orthographic Camera
  ├── Deva (White) & Asura (Black) Material Variant Shaders
  └── 64 PNG Frames per Piece (256x256)
         │
         ▼
Atlas Packing Engine (pack_animated_atlases.py)
  ├── 8x8 Grid Packing to Lossless WebP (2048x2048, ~250-600 KB each)
  ├── Per-Piece Manifests ([piece]_clip.json)
  └── Master Manifest (public/pieces/2p5d-animated/manifest.json)
         │
         ▼
Three.js Runtime Client Engine
  ├── pieceBuilder.ts: Texture clone instancing & UV offset animator
  ├── ThreeChessRenderer.ts: Traversal & Knight arc trajectories (Y_max = 0.42)
  ├── encounterDirector.ts: 5-Phase Warcraft III combat sequencer
  └── cameraController.ts: Calibrated 48° tactical camera with edge damping
```

---

## 3. Delivered Production Assets

All runtime assets are located in `apps/frontend/public/pieces/2p5d-animated/`:

| Piece Code | Class Name | Atlas File | Size | Manifest File |
|---|---|---|---|---|
| `wP` | White Padati (Pawn) | `wP_atlas.webp` | 604 KB | `wP_clip.json` |
| `wN` | White Ashva Senani (Knight) | `wN_atlas.webp` | 580 KB | `wN_clip.json` |
| `wB` | White Acharya (Bishop) | `wB_atlas.webp` | 572 KB | `wB_clip.json` |
| `wR` | White Durg (Rook) | `wR_atlas.webp` | 452 KB | `wR_clip.json` |
| `wQ` | White Samrajni (Queen) | `wQ_atlas.webp` | 263 KB | `wQ_clip.json` |
| `wK` | White Raja (King) | `wK_atlas.webp` | 256 KB | `wK_clip.json` |
| `bP` | Black Padati (Pawn) | `bP_atlas.webp` | 604 KB | `bP_clip.json` |
| `bN` | Black Ashva Senani (Knight) | `bN_atlas.webp` | 579 KB | `bN_clip.json` |
| `bB` | Black Acharya (Bishop) | `bB_atlas.webp` | 577 KB | `bB_clip.json` |
| `bR` | Black Durg (Rook) | `bR_atlas.webp` | 452 KB | `bR_clip.json` |
| `bQ` | Black Samrajni (Queen) | `bQ_atlas.webp` | 267 KB | `bQ_clip.json` |
| `bK` | Black Raja (King) | `bK_atlas.webp` | 260 KB | `bK_clip.json` |

---

## 4. Pending Work & Future Roadmap

The following tasks represent the outstanding roadmap items and technical extensions for upcoming milestones:

### 4.1. Directional Sprite Multi-Angle Support (High Priority)
- **Current Limitation**: Current 2.5D atlases are rendered from a south-facing tactical perspective ($0^\circ$ azimuth, $48^\circ$ elevation). If the player flips the board or rotates the camera to Black's perspective, units are viewed from the same front-facing angle.
- **Pending Deliverable**:
  - Update `render_animated_atlases.py` to render 4 camera azimuth angles ($0^\circ$ South, $90^\circ$ East, $180^\circ$ North, $270^\circ$ West) or 8 isometric angles.
  - Extend atlas manifest with an `angle` dimension: `clips[clipName].angles[azimuthIndex]`.
  - In `pieceBuilder.ts`, read `cameraController.getAzimuthHeading()` on orientation change and adjust the base row offset to display the facing direction.

### 4.2. Normal Maps & Dynamic Lighting Shaders (High Priority)
- **Current Limitation**: Atlases currently store diffuse/albedo with baked key-and-rim lighting. Dynamic Three.js board lights and mouse-hover point lights do not cast specular highlights across unit relief.
- **Pending Deliverable**:
  - Export companion normal-map atlases (`[piece]_normal.webp`) from Blender world-space / tangent-space normal passes.
  - Switch `MeshBasicMaterial` in `pieceBuilder.ts` to `MeshStandardMaterial` or a custom `ShaderMaterial` accepting `map` and `normalMap`.
  - Pass board lighting uniforms into the card shader for specular glints on armor, gold embroidery, and weapon edges.

### 4.3. Class-Specific Combat Sound Effects (Medium Priority)
- **Current Limitation**: Combat currently utilizes synthesizer-based fallback audio triggers via Web Audio API.
- **Pending Deliverable**:
  - Integrate dedicated audio sound packs for ancient Indian military combat:
    - **Ashva Senani (Knight)**: Hoof gallop stride, horse whinny, heavy lance impact.
    - **Durg (Rook)**: Rumbling stone-and-timber wheels, bronze gate creak, battering ram thud.
    - **Samrajni & Raja (Royals)**: Steel talwar blade unsheath, curved blade slash, royal battle cry.
    - **Acharya (Bishop)**: Wood staff floor strike, sacred mantra ward resonance.
    - **Padati (Pawn)**: Spear thrust, shield block rattle.
  - Connect audio cues to `encounterDirector.ts` phase triggers (`onImpact`, `onAnticipation`, `onDefeat`).

### 4.4. GPU Instanced Particle Systems & Impact Shaders (Medium Priority)
- **Current Limitation**: Construct fracture debris currently spawns individual Three.js `Mesh` instances with Euler physics in CPU memory.
- **Pending Deliverable**:
  - Replace individual mesh debris with an `InstancedMesh` particle pool ($N = 120$ shards) managed on the GPU.
  - Implement a dissolving noise burn/fracture shader on defeated character cards during `phase 4` (`stagger` into `defeat`).
  - Add screen-space shockwave distortion on critical captures (Queen/Rook captures).

### 4.5. Game-Over Victory Sequences (Medium Priority)
- **Current Limitation**: Checkmate displays standard victory modal without triggering synchronized army-wide victory / defeat animations.
- **Pending Deliverable**:
  - Wire checkmate state in `ThreeChessRenderer.ts`:
    - Winning army pieces switch from `idle` to `victory` loop (cheering postures, weapon salutes).
    - Defeated King transitions to `defeat` sequence while remaining army units bow/kneel (`defend`/`stagger`).
    - Camera smoothly transitions to cinematic victory orbit around the winning King.

### 4.6. Settings Modal & Asset Theme Switcher (Low Priority)
- **Current Limitation**: The 2.5D Animated War Chess set is hardcoded as the default visual presentation in `pieceBuilder.ts`.
- **Pending Deliverable**:
  - Expose a 3-way visual toggle in the game Settings dialog:
    - `Stylized 2.5D Indian War Chess (Animated)` (Default)
    - `Full 3D Classical Miniature Figurines`
    - `Minimalist 2D Vector Board`
  - Ensure hot-swapping between rendering modes cleanly disposes Three.js textures and animators without memory leaks.

---

## 5. Verification & Quality Checklist

Before submitting further changes against this feature, verify the following baseline passes:

```bash
# 1. Typecheck frontend code
yarn --cwd apps/frontend tsc --noEmit

# 2. Run unit and integration tests
node scripts/astra/three_war_chess.test.mjs
node scripts/astra/combat_and_statemachine.test.mjs
node scripts/astra/motion.test.mjs
node scripts/astra/rig_and_contact.test.mjs

# 3. Next.js production build verification
yarn --cwd apps/frontend build
```
