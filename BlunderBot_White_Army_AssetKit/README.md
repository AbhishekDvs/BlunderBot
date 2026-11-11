# BlunderBot — White Army Asset Handoff (Development Geometry, v0.1)

Six valid **3D glTF/GLB geometry studies** are provided for the White army, along with editable Python source, PBR material assignments, class-specific silhouettes, screenshot previews, 2.5D illustrative concepts and integration notes. Generated from the user's handoff specifications.

**Important: THESE ARE NOT FINISHED PRODUCTION ART.** They are intentionally isolated from `apps/frontend/public/models/astra/` and were not integrated into or tested in a running BlunderBot browser. The renders show simplified human anatomy and stylized construction. They do **not** meet the premium, believable historical-fantasy sculpture quality benchmark in `docs/astra/`. They are not rigged, do not ship skeletal animations, and do not contain fracture shell meshes. Their existence must not reopen the Astra visual gate.

## What is included

- `models/wP.glb`, `wN.glb`, `wB.glb`, `wR.glb`, `wQ.glb`, `wK.glb`: six White **development model meshes**. These are new files generated in this handoff, not renamed copies of the submitted models.
- `models/asset-index.json`: per-class bounds, polygon counts, bytes and development status.
- `source/build_white_army.py`: reproducible 3D geometry generator, using Python `trimesh`, `numpy` and `scipy`. It produces structurally valid GLB files and can be modified by Flash for prototyping.
- `source/render_previews.py`: offline preview renderer for each class and a six-piece contact sheet (requires `vtk` and Pillow).
- `previews/contact-sheet.png`: **render of the actual generated GLBs**. Use this image for honest quality review; it is not a concept render.
- `reference/illustrative_white_army_sheet.png`: higher-fidelity **concept illustration**, supplied in the discussion, *not* evidence of a modeled or rigged 3D asset.
- `reference/approved_identity_concept_cutouts/` and `previews/approved-identities-2p5d-concepts.png`: single-view **illustrative reference artwork** for all six approved class identities; not a rendered 3D model, sprite animation, or evidence of production readiness.
- `reference/cutouts/`: experimental single-view 2.5D illustrations from the alternative concept image. These are not actual GLB renders, coherent motion clips or approved game sprites. The concept's elephant Bishop and chariot Rook are **not** the approved Astra Acharya and Durg choices; do not integrate them as final themes.
- `docs/ASSET_HANDOFF.md`: approved class decisions, naming, color, transform, rig/socket and visual acceptance checklist.
- `source/validate_assets.py`: validates GLB loading, scale, materialized meshes, required naming. This test cannot measure realism or artistic quality.

## Rebuild

```bash
python3 -m pip install numpy scipy trimesh
python3 source/build_white_army.py
python3 source/validate_assets.py
# Optional: image previews (needs vtk + Pillow)
python3 -m pip install vtk Pillow
python3 source/render_previews.py
```

The generated meshes are in Y-up glTF coordinates with 1 chess square as the target design unit. They are roughly 0.69–0.93 units tall, with a shared 0.68-unit-diameter base.

## Do not overwrite shipped assets yet

Keep `apps/frontend/public/models/astra/w*.glb` unchanged until a *new* production-level sculpt passes a side-by-side actual-board-scale art review. Use a new experimental version or branch to load these prototype meshes if desired. Set explicit experimental UI labeling; never suggest this kit contains completed real-time cinematic combat.

## Production work still required

Artist-quality organic sculpting and coherent historical armor/cloth construction; consistently readable 32–64px chess-piece silhouettes; manually checked UV and PBR maps; armature and skin weighting; rider/horse skeletons; actual animation clips; contact sockets under articulated grip constraints; authored fracture shells; tested browser capture and ending evidence; 3D camera framing and measured frame times. These cannot be inferred or fabricated from the included reference image.

## Named sources

Creative direction and specifications: user-provided `docs/astra/README.md`, `DESIGN.md`, `ANIMATION.md`, `PRODUCTION.md`, and recovery audit. No third-party 3D model assets have been incorporated in this kit. The concept visual is an illustration only.
