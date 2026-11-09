# ASTRA visual recovery audit — 2026-11-09

**Result: visual acceptance FAILED. Only release gating is complete.**

## Observed evidence

Inspected the actual locally running `/game` in the browser, not just source or a mockup.
[Before screenshot](before.png), [after gating](after.png), [theme selector](theme-gate.png).
Compared against `../README.md`, `../DESIGN.md`, `../ANIMATION.md`,
`../PRODUCTION.md` and the full-resolution approved concept sheet.

| Area | Actual output and discrepancy |
| --- | --- |
| Anatomy | Circular heads and trapezoid torsos; no articulated arms, hands, knees or believable weight. Horse has a largely continuous geometric body with no convincing four-legged anatomy or seated rider. |
| Materials | Flat fills and outlines instead of sculpted stone, metal roughness, textile weave, layered plates, beveled edges and physically consistent highlights. |
| Craftsmanship | Armor, tack, reins, overlapping garments, fasteners and weapon grips are missing. Indian-inspired detailing is reduced to a saffron cap and generic crown shapes. |
| Silhouette | Knight reads as a small abstract shape; queen and king are triangular dresses with graphic crowns. Weapons are isolated strokes. No miniature-quality construction survives enlarged inspection. |
| Scale | Symbols fit cells but lack the shared physical scale, realistic human proportions and low common bases in the design contract. |
| Lighting/contact | Ellipse plinth shadows do not establish convincing grounded foot/hoof contact or self-shadowing. CSS elevation tilts the whole board and its flat pieces together. It adds no piece volume. |
| Board | Uniform tan/brown rectangles. No material grain, modeled joints, bevels, physical slab construction or coherent scene illumination. Rounded frame and drop shadow cannot stand in for a crafted physical board. |
| Interface | Black/gray rounded cards, badges, yellow buttons and technical engine copy dominate. No integrated warm material scene or cinematic composition. “Cinematic Chess” label overstates the output. |
| Animation | Board translation is not walking or cavalry gait. Overlay source draws a translucent yellow circle and generic debris; it does not draw an attacker striking, a reaction, or a sculpted shell fracturing. No real clip atlas is delivered. |
| Release state | Army was enabled by default and called royal miniatures despite the original package explicitly disallowing placeholder substitution. All six classes were exposed before the three-class gate. |

## Completed containment changes

- ASTRA piece set is unavailable and excluded from normal selection.
- Fresh sessions default to Royal Walnut and standard chess pieces.
- Stored and programmatic selections of unavailable piece sets fall back to standard pieces; other preferences are retained.
- Ancient Battlefield palette remains explicitly **Experimental**, with an asset-unavailable notice. Its board material quality has not been declared repaired.
- Removed vector-army and prototype combat imports from the live board. Historical prototype sources remain available, clearly labeled as retired.
- Removed the navigation claim “Cinematic Chess”. No move/engine handlers changed.

## Benchmark attempt and review

[Full-resolution generated proposal](benchmark-proposal.png) is a 2172×724 RGBA image,
created by the built-in imagegen tool using the approved sheet as reference.
[Review page](review.html) shows the full image and 36, 40 and 62.5 CSS-pixel cell tests.
This is **generated concept imagery, not imagery rendered from delivered 3D models**.
It therefore cannot satisfy the requested 2.5D provenance requirement.

Reject for production: inconsistent base diameters, projected heights not matching
the contract, narrow weapons, oversized cavalry spear, excessive infantry ornament,
colored alpha-edge contamination, and unverified equine limbs/tack from one view.
The improved surface appearance does not establish rear geometry, deformation,
weapon grips, or animation continuity. No additional classes were produced.
The diagnostic strip is not evidence of actual board integration.

## Exact missing production steps

Blender 5.2.2 LTS successfully launches in background mode. The repository contains
no `.blend`, `.glb`, `.fbx` masters or rendered clip atlases. An available renderer
is not a sculpted army. The connected image tool produces still imagery, not an
editable anatomically validated mesh/rig. Production-quality artwork meeting the
full request was **not generated** in this recovery pass.

1. Sculpt three original masters: realistic human and horse anatomy; cleanup of
   hands, feet, face, horse joints, reins, saddle/stirrups; practical armor and cloth.
   Review front/side/back and three-quarter clay views before materials.
2. Retopologize, UV and author stone/bronze/steel/textile PBR maps. Use the same
   `.68S × .07S` bases, locked orthographic camera at 30° elevation, upper-left
   key and fixed scale. Deliver packed `.blend` sources and asset provenance.
3. Render true transparent static benchmarks at 128/256 px and inspect at
   36/40/62.5 CSS px, DPR 1/2, both square colors and full pawn density. Correct
   scale and silhouette before expanding the army or changing live presentation.
4. Rig humans, horse and rider with saddle constraints, weapon grip/tip sockets,
   restrained cloth controls and separate root motion. Author planted steps,
   breathing/weight-shift idles, lance charge, queen sword attack and impact recoil.
5. Author a queen→pawn capture: anticipation, step, blade contact at a named frame,
   recoil, then non-anatomical sculpted shell fracture. Render actual broken surfaces
   and 3–6 stone/armor fragments with physically grounded settling. Leave a few
   fragments temporarily, then fade them. No glow, gore or body remains.
6. Render eight action directions with consistent lighting/anchor, separate contact
   shadows, reaction and fracture clips. Use existing `scripts/astra/pack_atlas.py`
   only after the images pass human visual review; packing is not art validation.
7. Produce a matched board scene: actual stone/wood slab depth, fine surface detail,
   bevels, brass joints and soft contact/shadow passes; keep texture contrast below
   piece silhouettes. Recompose the interface around the board. Do not overlay
   a photographed board at a conflicting camera angle.
8. Integrate reviewed idles/atlases into an isolated actual-board benchmark; then
   validate capture contact at full and quarter speed, interruption/cancellation,
   special moves, full-board density and responsive input. Record lossless screenshots
   and video, measure frame/input timings on desktop and phone, and only then reopen
   the selection gate. See the existing production document for detailed budgets.

## Acceptance matrix

| Requirement | Status |
| --- | --- |
| Three high-fidelity production benchmark pieces | FAIL — generated reference only |
| Consistent actual-board rendering | NOT STARTED — benchmark rejected |
| Correct proportions/scale | FAIL — generated bases differ |
| Realized capture sequence | MISSING — no rigged attack clips |
| Believable destruction | MISSING — no modeled fracture assets |
| No noticeable performance degradation | UNMEASURED for new art; no new art is loaded in game |
| Browser evidence | Before/after gate and review screenshots; no production animation evidence |

Do not interpret passing code checks as passing this art gate.

## Executed verification

- TypeScript `tsc --noEmit`: passed.
- Next production build, including lint/types and all eight static pages: passed.
- Asset gate regression tests: passed (unavailable/default selection, persisted and
  programmatic fallback, valid/unknown IDs and preference preservation).
- Existing motion and combat/state-machine test files: passed. These verify technical
  behavior only; they do not validate animations or artwork.
- Existing Python atlas packer tests: 5 passed.
- Actual browser: verified persisted experimental palette with standard pieces;
  customizer shows only the three available piece sets and explicit experimental notice.
- [Browser benchmark review screenshot](benchmark-review.png), full-resolution image
  and actual cell-size diagnostics saved. [Exact generation prompt](prompt.txt).
- No new animated assets exist, so no animation video or new-art performance pass
  is claimed. Board and interface visual redesign remain outstanding.
