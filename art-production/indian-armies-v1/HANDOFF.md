# Illustrated Indian armies — art review candidate

This is actual transparent animated character artwork, built from matching painted
cutout parts with independent joint articulation. It is isolated from the selected
game assets and all gameplay/runtime code. Base: remote feature branch commit
`4aa2b90109ea512a1682297138f5df96aef1c9ca`.

## Deliverable

All six classes for both factions: Padati/P, Ashva Senani/N, Acharya/B, Durg/R,
Samrajni/Q, Raja/K. Each has a lossless 2048×2048 main WebP atlas with 64 frames,
and a 2048×512 supplementary ending atlas with 16 frames: **960 character frames**.
Two faction effects atlases supply **32 additional transparent effect frames**.
These counts are exported timeline samples, not 960 independently painted images.
`validation.json` reports distinct pixel frames separately.

Main clips exactly retain the verified runtime's 8×8 / 256px layout:

| Clip | Start | Frames | FPS | Loop |
|---|---:|---:|---:|---|
| idle | 0 | 8 | 10 | yes |
| move | 8 | 12 | 14 | yes |
| attack_anticipation | 20 | 4 | 12 | no |
| attack | 24 | 8 | 16 | no |
| defend | 32 | 6 | 12 | no |
| hit | 38 | 4 | 16 | no |
| stagger | 42 | 6 | 12 | no |
| defeat | 48 | 8 | 12 | no |
| victory | 56 | 8 | 12 | no |

Attack contact is **local frame 4**, 250ms after attack start. Supplementary
`defeat_acknowledgement` and `draw_disengagement` each have eight frames at 12 FPS.
Main and supplementary clip manifests include per-frame durations and sockets.

`source/` preserves the actual RGBA paintings: twelve rig sheets, two revised
cavalry accessories, and the shared four-royal torso sheet with intact crowns.
No static concept image is substituted for a completed animation clip.

## Reproduce and revise

Python 3.10+ and Pillow with WebP support are required (`python -m pip install Pillow`).
Run from the repository root:

```powershell
python art-production/indian-armies-v1/tools/render_rigs.py wP wN wB wR wQ wK bP bN bB bR bQ bK
python art-production/indian-armies-v1/tools/package.py
python art-production/indian-armies-v1/tools/validate.py
```

Painting pixels are retained in source files; re-export does not call image
generation or need an API key. Image synthesis itself is not deterministic.
`render_rigs.py` contains editable source-part anchors, skeleton hierarchy, foot
plants, gait phase offsets, authored attack poses, cloth hinges, wheel projection,
and shell-piece trajectories. Source hashes are recorded in each piece manifest.
Only export registration and joint transforms generate the performance; no full
character image is translated, rotated, or shrunk to impersonate walking/breaking.

The discarded independently generated Pawn walk did not alternate the leading
leg reliably. It is excluded from the delivery. The retained articulated approach
keeps the same head, clothing, hands and equipment across every frame.

Local `review/` files are generated for inspection and ignored by Git. They
include looping per-clip GIFs, class pose sheets, 128/64/48px lineups and three
paired duel previews. No screenshots or preview recordings belong in the commit.

## Flash integration

1. Review this branch before selecting any new game assets. `runtime/manifest.json`
   lists piece URLs, effects, verified class card sizes and the base contract.
2. Main atlases are in `runtime/{code}/{code}_atlas.webp`; clip manifests are their
   `{code}_clip.json` siblings. Once approved, the main texture can be copied to the
   existing `{code}_atlas.webp` endpoint without changing its frame indices.
3. Sprite foot pivot is **[128,220]**, normalized **[0.5,0.859375]**. Source facing
   is right three-quarter except Bishops, authored left-facing for the encounter.
   Do not synthesize unprovided directions by flipping weapon hands.
4. Existing cards are centered and do not consume the new foot anchor. Register
   that anchor when selecting these assets. `planeCenterFromFootAnchor` supplies
   the local card-center offset for the verified −0.58 rad tilt; add the desired
   plinth/ground height. Asset metadata cannot fix placement in unmodified code.
5. `encounters.json` supplies White Knight/White Bishop benchmark plus White
   Knight/Black Bishop and Black Knight/White Bishop encounters. Contact occurs
   at 1440ms. The Bishop holds the actual final blocking pose through contact,
   then recoils, staggers and breaks. Both pieces have articulated motion.
   Equal-pixel review offsets and **class-dimension-correct world contact offsets**
   are supplied separately. Align feet first; use the world offsets in game.
6. Synchronize traversal with each piece's `traversal.nominalStridePx`. Grounded
   feet move linearly backward during stance, so matching root travel keeps them
   planted. Knight has four leg chains, neck motion and balancing rider; Rook
   wheel spokes spin inside a stable projected wheel silhouette.
7. Supplementary endings use the supplied **8×2** texture metadata. The current
   hardcoded main-atlas player does not discover these automatically. Bind them
   through Flash's ending integration or the existing generic atlas loader.
   `endings.json` maps White victory, Black victory and draw. A losing king lowers
   its weapon via `defeat_acknowledgement`; **never play destruction for checkmate**.
8. `effects/` provides warm dust and material fragments, placed at the contact
   anchor. Character defeat frames also split their own sculpted shells. No gore.

## Acceptance and limits

This is an **art review candidate, not approved integration**. Technical check
results are in `runtime/validation.json`. They check dimensions, actual alpha,
cropping, clip ranges, nonstatic clips, independent leg motion, planted feet,
rotating wheels, and synchronized contact. They do not establish artistic quality.

Offline visual reviews cover identities, pose changes, crown margins, garment
coverage, fixed face/equipment textures, and small sprite readability. Important
remaining limits: the supplied camera was requested as 48° in the paintings and
has not been mathematically calibrated or tested on the actual game board;
source layers have limited foreshortening; cloth uses articulated panels rather
than new painted folds; shell fragments are stylized cutout pieces; only the
authored fixed views exist. Final board-scale art approval remains open.

No prohibited runtime files, chess logic, selected asset endpoints, or Flash's
animation implementation were modified. No merge into the feature branch or main.
