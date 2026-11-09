# Production and integration plan

## Repository constraints

The inspected frontend is Next 15 / React 19, React Chessboard 4.2, chess.js 1.4 and
a Stockfish worker. `GameBoard.tsx` owns a mutable Chess instance and controlled FEN.
Custom pieces currently load SVGs with next/image. The board is capped at 500 CSS
pixels. A 3D renderer would require new picking, camera, asset and disposal systems;
there is no existing mesh/rig loader to extend. Existing local engine and security
changes must be preserved.

Use existing SVGs as fallback. Do not add an ASTRA piece-style option until a complete
approved asset set can load. The new sandstone **board** option is usable with all
existing pieces and makes no claim to supply the miniature army.

## Stage A — benchmark before expansion

1. Artist creates Pawn, Knight and Queen sculpts from the concept sheet and corrections
   in README. Supply front, side, rear and three-quarter clay views, then material
   views. Use a consistent unit system, base and camera. No generative image-to-mesh
   result is accepted without manual topology, anatomy and silhouette cleanup.
2. Approve static renders at 36px, 40px and 62.5px cells, at DPR 1 and 2, on both
   sandstone colors and next to existing black pieces. Test real full-board density
   with eight pawns and both knights, not just isolated portraits.
3. Rig benchmark assets and render one idle, one move, one attack, reaction and break
   per class. Check queen→pawn, pawn→knight and knight→queen contact pairs. Validate
   horse takeoff/landing over occupied pieces before choosing cinematic knight mode.
4. Build a throwaway overlay prototype with these real assets. Measure motion,
   cancellation, loading and memory. If contact is unconvincing, revise assets or
   recommend full 3D; do not inflate effects to conceal poor weapon alignment.
5. Only after review, expand to King, Sage and Durg; assemble 16 white instances from
   six masters. A coherent opposing army requires a separate six-class palette/model
   review, not a crude color-inversion filter. White-only work can be reviewed against
   existing black SVGs, but is not the final two-kingdom experience.

## Artist delivery contract

- Versioned `.blend` master, packed textures, named collections, no external missing
  links. Record Blender version, units and render settings. Keep originals outside
  the web public folder; large source files belong in artifact storage or Git LFS.
- Stable names: `wP`, `wN`, `wQ`, then `wK`, `wB`, `wR`. One master per class; duplicates
  are instances. Texture materials grouped into stone, metal, cloth and weapon.
- Root at base center, Z up, +Y forward. Bind pose feet/hooves on ground. Sword/staff
  grip, weapon-tip, impact, saddle and fragment sockets named. Cloth is bone-driven.
- Clips: `idle`, `move`, `attack`, `react`, `break`; knight additionally `takeoff` and
  `land`, rook ram extension integrated into attack. Root motion exported separately
  from in-place clip. Name contact frame in every attack. Keep initial/final idle
  stance compatible to avoid a one-frame pop. Freeze defeated shell before hiding it.
- Initial master targets: pawn/sage 20–35k triangles, royals 35–60k, knight 60–100k,
  rook 20–40k. These are offline art guidelines, **not browser geometry budgets**.
  Start with 2K PBR maps per class and inspect normal detail at target sprite sizes.
- Rights/source record for every purchased model/texture: creator, URL, acquisition
  date, license, redistribution terms, modifications. Original generated concept is
  identified separately; it is not a license for unrelated third-party 3D assets.

## Camera and frame contract

Render orthographic at 30° elevation, consistent framing and fixed screen-space
upper-left key light. Rotate model/root for direction, not the lighting rig. Gameplay
idle uses one reviewed three-quarter presentation per army; actions use eight yaw
views. Reverse board orientation needs separately rendered compatible views, not
mirrored textures. [Blender's camera documentation](https://docs.blender.org/manual/id/5.1/render/cameras.html)
describes orthographic scale; use a locked camera in the master scene.

Square RGBA PNG frames: 128×128 standard, 256×256 optional inspection/high-density.
Use transparent film, consistent color management, and an anchor of `(0.5, 0.86)`
normalized within the frame at the center of the base's ground contact. Keep at least
2px transparent edge padding. Do not auto-trim individual frames. Static images and
small baked contact shadows must fit inside the cell; large attack excursions belong
to a separate overlay envelope with authored contact anchors, never oversized DOM
hitboxes. Render effects on separate layers so they can be disabled.

The [transparent-film render setting](https://docs.staging.blender.org/manual/en/latest/render/eevee/render_settings/film.html)
allows compositing onto the board. Test halos on both light and dark tiles. Do not
bake a parchment background into game sprites. Generated concept images are not
coherent animation frames and must not be cut up to impersonate a rigged model.

Source directory convention:

```text
art/astra/v001/wP/attack/NE/128/0000.png
art/astra/v001/wP/attack/NE/128/0001.png
...
```

Each directory contains exactly one class/clip/view/resolution and zero-padded
sequential frame names. Stance and contact are artist-reviewed; no tool can certify
that a weapon actually connects from an image dimension check.

## Executable atlas packaging

Use Python 3.10+ and Pillow with WebP support (`python3 -m pip install Pillow` in an
asset-production environment). This is an offline dependency; it is not added to
the browser or Next application.

From the repository root:

```bash
python3 scripts/astra/pack_atlas.py art/astra/v001/wP/attack/NE/128 build/astra/v001/wP/attack/NE --cell 128 --fps 24 --contact 8
python3 -m unittest discover -s scripts/astra -p 'test_*.py' -v
node scripts/astra/motion.test.mjs
```

Output: lossless `atlas.webp` and `clip.json`, including frame count/order, dimensions,
anchor, contact index, frame rate, transfer bytes, estimated decoded RGBA bytes and
SHA-256. The packer rejects empty/opaque images, mismatched dimensions, invalid
contact indices, more than 64 frames, textures over 2048px, clips over 2 MiB and
overwriting an existing revision. It preserves full frames/alpha and never synthesizes
geometry. Test fixtures are colored boxes **only inside temporary test directories**,
not artistic deliverables.

The manifest is clip-level metadata, not a complete release approval. Artist/reviewer
must still verify camera, sequential timing, silhouette, alpha edges, clothing,
licensing and all six class assignments. Validate checksum, decoded dimensions,
frame bounds and schema before accepting an asset at runtime. Publish only versioned
same-origin paths under `/pieces/astra/<revision>/...` after the release gates pass.

## Renderer integration sequence

1. Static loader: request manifest only when ASTRA is selected; decode all six white
   idle sprites before atomically switching style. Memoize custom piece components
   by style/revision. Failed fetch/decode/checksum → existing SVGs, with game intact.
2. Keep concept PNGs under docs; they must not enter the game route bundle or public
   sprite cache. No all-directions/all-clips prefetch at game startup.
3. Add one pointer-transparent overlay per board. Read immutable accepted-move
   events and FEN snapshots; implement the controller contract in ANIMATION.md.
   Separate canonical chess state from displayed overlay state. Set React Chessboard
   translation to zero only while that overlay owns the animation, preventing double
   movement. If assets are late, skip the action immediately and show canonical state.
4. Canvas2D is the first rendering experiment, not a new 3D engine. Atlas sampling and
   translations run off React state; one rAF draws active actions. Dirty rendering or
   low-rate idles reduce work. Pause while hidden; stop the loop entirely when idle
   motion is disabled and no action/effect is active.
5. Reuse decoded atlases by URL/version with a bounded LRU. Evict inactive clips;
   close ImageBitmaps, revoke generated blob URLs and cancel requests/frames on teardown.
   Keep currently visible static assets pinned. Do not dispose a shared atlas still in use.
6. Export stable board imagery using same-origin static sprites; cancel combat first.
   Verify html-to-image with atlas-backed pieces. Avoid adding cross-origin fetches
   that conflict with the current CSP or taint the export canvas.

## Proposed budgets — acceptance targets, not measured results

| Resource | Normal | Reduced / low-power |
| --- | --- | --- |
| Initial six-class white idle transfer | ≤1 MiB total, lazy | Existing SVG fallback if not ready |
| Active clip transfer | ≤2 MiB per atlas; preload only likely action | No attack atlases fetched |
| Resident decoded art | ≤48 MiB including pinned idles | ≤12 MiB or SVG fallback |
| Texture edge | ≤2048px | ≤1024px preferred |
| Display target | 60 fps; p95 frame ≤16.7ms on reference desktop | 30 fps; p95 ≤33.3ms on reference phone |
| Added input latency | p95 <16ms desktop, <33ms phone | Same; never await assets |
| Effects | ≤12 fragments + 8 dust sprites globally | 0 |
| Root translation | ≤420ms ordinary, capture ≤850ms | ≤100ms / off 0ms |

A 2048² RGBA atlas costs 16 MiB decoded regardless of its compressed file size; a
48 MiB cache cannot hold dozens of direction variants. Default 128px cells and
short separate clip atlases keep paging practical. During 120 measured visible
frames, sustained p95 over the tier budget should downgrade effects first, then
idles, then static assets. Do not switch quality repeatedly within a move.

## Release gates

Pass all before describing the theme as production-ready:

- Pawn/Knight/Queen material and silhouette benchmark approved at board scale.
- All six masters, orientations, clips, licenses and opposing-side presentation reviewed.
- Real weapon contacts and horse gait inspected at full speed and quarter speed.
- FEN/PGN identical with full/reduced/off rendering; special moves and interruptions pass.
- Decode failures, offline cache misses, resize, teardown, rapid replay and PNG export pass.
- Reference desktop and real lower-power phone measured with final assets; no retained
  atlas growth across repeated restarts. Record device/browser/viewport and raw traces.

Currently there are no approved 3D masters or animation atlases. Therefore there is
no asset-backed renderer enabled and no claim that these runtime budgets have passed.
