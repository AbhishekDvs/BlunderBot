# ASTRA — royal war miniatures

Status: **visual recovery gate CLOSED — no production miniature army**.

See the [2026-11-09 visual audit](recovery/AUDIT.md) and
[benchmark review at full and actual cell sizes](recovery/review.html). The generated
proposal failed production review. The placeholder army is unavailable; Ancient
Battlefield is explicitly an experimental palette. Capture/fracture assets remain missing.
The game still uses its existing chess pieces. No generated concept has been
misrepresented as a rigged asset. No 3D engine or runtime dependency was added.

This package contains:

- [White army design](DESIGN.md): six classes, proportions, materials, rook comparison,
  and three distinct production approaches.
- [Animation direction](ANIMATION.md): choreography, contact, destruction, routing,
  cancellation and special chess moves.
- [Production and integration](PRODUCTION.md): artist handoff, camera contract,
  executable atlas packer, asset delivery, memory budgets and release gates.
- [Verification](VERIFICATION.md): executed checks, limitations, and performance protocol.
- [Pawn / Knight / Queen benchmark](concepts/white-army-benchmark.png): generated
  concept sheet, **not** turnarounds, game sprites, model geometry or animation.
- [Exact concept prompt](concepts/prompt.txt): generated with the built-in imagegen tool.

The frontend includes theme settings persisted in local storage and device-motion
handling. Unavailable army selections are migrated to standard pieces. The existing
black-side animation workaround remains intact. Chess move handlers and engine
scheduling are unchanged by the recovery work.

## Decision

Recommend **artist-sculpted 3D masters, rendered to 2.5D sprites** with an optional
combat overlay. Start with a static playable benchmark before authoring animation.
The current board is flat, 288–500 CSS pixels wide on common phone/desktop sizes;
its cells are roughly 36–62.5 pixels. The silhouette and material grouping must work
there, not only in enlarged promotional renders.

Full cinematic combat remains contingent on production assets and a measured
overlay prototype. If convincing contact and cavalry routing cannot pass the
benchmark on the flat board, keep the static theme and revisit full 3D separately.
Do not disguise a sliding still image as a walking miniature.

## First benchmark review

The generated sheet establishes warm ivory stone, bronze armor, restrained crimson,
and shared carved bases. It is useful as a material target, with these corrections
required before modeling approval:

1. **Pawn:** reduce engraving and shoulder decoration substantially; shorten the
   upright spear to fit the sprite envelope. Keep shield, headgear and stance readable.
2. **Knight:** validate horse limb anatomy, tack clearance, weight and compact base in
   side/front/back views. The single image cannot establish a usable gait or rig.
3. **Queen:** retain the layered silhouette; simplify crown rays and jewelry at 40px.
   Her recognizability must not depend on facial features or fine embroidery.
4. **All:** unify actual base diameters and elevation; the generated camera and scale
   are approximate. Remove human-skin shading. Reduce the decorative pedestal height
   for gameplay so feet and horse legs have enough pixels.

Do not expand to the remaining classes until these three pass the production gates.
