# Encounter terrace

Final game asset: `apps/frontend/public/pieces/indian-armies-v1/stage/terrace.webp`
(1536×1024, 165,852 bytes). Original background generated with the built-in
imagegen tool on 2026-11-11. No external photograph, downloaded artwork, character,
text, or trademark is embedded. Existing army paintings and atlases are retained.
The generated PNG was encoded to WebP at quality 88 with Sharp; image content was
not programmatically repainted. This is shipping scenery, not a gameplay screenshot.

## Generation prompt

Use case: stylized-concept. Asset type: original painted background for a 2.5D
ancient Indian epic-fantasy chess combat game. Generate a wide landscape 1536x1024
matte painting of an EMPTY ancient Indian palace terrace at dusk. No people, no
characters, no chess pieces, no weapons, no writing, no UI, no watermark. Polished
hand-painted RTS game art, restrained Warcraft III-inspired rich painterly
materials. Camera looking down at about 40 degrees, long lens, broad open horizontal
warm sandstone floor in bottom 65 percent, quiet simple large slabs and subtly
inlaid aged brass lines. Soft overhead warm light from upper left and cool
desaturated teal atmospheric distance. Upper third: a low carved balustrade and
very distant hazy temple silhouettes. Far left and far right edges have understated
shadowed carved sandstone pavilion columns, center is uninterrupted negative space.
Darkened corners with softly lit central stone ground. The characters will be
composited later with feet at 75 percent of image height and heads near 30 percent,
so keep that central zone subtle and empty, no foreground objects or steps and no
distracting ornaments. Sophisticated low contrast, amber stone and muted deep teal,
matte surface, atmospheric depth, no saturated neon or magical effects. This is an
actual game background texture, not a mockup.

## Minimum additional character views

`source/wP_guard_parts.png` and `source/bP_guard_parts.png` were edited with the
built-in imagegen tool from the corresponding original Pawn part sheets. The
source paintings face left; no runtime UV reflection or pixel reflection is used.
The same rig keeps the weapon on the anatomical right arm and the shield on the
left arm. Only Pawn defense/reaction/fracture uses these extra views; the original
board, walking, attack, victory and King acknowledgement atlases are unchanged.

Reproduce the two 32-frame performances and public copies with:

```
python art-production/indian-armies-v1/tools/render_guard_views.py
```

The exporter retains the existing 8×8 / 256px clip indices and [128,220] foot
pivot. It removes disconnected alpha islands from individual generated parts,
keeps edge antialiasing, and lowers the connected defensive arm to intercept the
existing attack at waist height. Socket positions come from the articulated rig.
The encounter checks the actual guard silhouette at the attack height before
placing either actor. Source SHA-256 values are stored in the guard manifests.

Both image edits used this common prompt:

> Edit the referenced transparent painted cutout rig sheet for a 2.5D ancient
> Indian soldier. Create the minimum opposite-direction DEFENSE view of the SAME
> character. Keep exactly FOUR COLUMNS by THREE ROWS, twelve separate part cells
> in the exact same order and same grid positions as the input; no labels. Top
> row: head/torso, two separate thigh garments, one calf/foot. Middle row: other
> calf/foot, two upper arms, left forearm and round shield. Bottom row: right
> forearm with upright short spear, sash, fragments, dust. Repaint the head and
> torso facing SCREEN LEFT in a three-quarter view, not right. Repaint feet
> pointing left and corresponding opposite-view limb surfaces. Preserve the
> character's exact identity, anatomy, face, moustache, turban, armor decorations,
> cloth colors, and matching painted shading. Preserve ANATOMICAL handedness:
> short spear belongs to the RIGHT HAND, round shield belongs to the LEFT HAND.
> This is a newly painted opposite view, NOT a horizontal reflection of a
> weapon-bearing image. Weapon and shield must not switch hands. Keep parts
> upright in their cells with overlap tabs and similar proportions/pivots to the
> source. Each part remains separate with generous transparent gutters and clean
> alpha edges. No full assembled character, no extra characters, no floor/background.
> Truly transparent background. Maintain the source's polished illustrated RTS
> art, matching warm overhead-left light. The first cell must visibly look left,
> with the same face.

White suffix: “This is the WHITE faction Padati: orange turban, ivory trousers,
warm gold and bronze armor, ivory/light skin, matching the source exactly.”

Black suffix: “This is the BLACK faction Padati: deep burgundy turban and trousers,
dark charcoal armor with bronze trim, brown skin, matching the source exactly.”
