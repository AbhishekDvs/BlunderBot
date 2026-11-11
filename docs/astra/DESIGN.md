# White army design specification

## Shared design language

An original Indian-inspired royal army of enchanted carved constructs. This is
historically informed fantasy, not a reconstruction of a single ancient kingdom.
Do not conflate later surviving armor with evidence for ancient warfare. No named
deities, readable sacred texts, or religious icons appear on breakable surfaces.
Use lotus petals and geometric borders as restrained craftsmanship. A cultural
review should check crown, garments and any proposed sacred-thread treatment before
final sculpt approval; the baseline sage design does not require a sacred thread.

Faces and hands are carved warm ivory stone, not flesh. Armor is physically attached
bronze or steel, cloth reads as sculpted textile with restrained articulated edges.
Faces are calm; character comes from stance and mass. No exaggerated anatomy,
fluorescent colors, emissive materials, magical trails, gore or corpses.

| Material | Color reference | Treatment |
| --- | --- | --- |
| Warm ivory | `#E8DDC5` | Fine stone grain, broad matte highlights; no waxy skin |
| Brushed gold | `#B68A3E` | Small royal accents, roughness starting range .32–.48 |
| Aged bronze | `#82613D` | Main armor, darker recesses; roughness .45–.65 |
| Saffron | `#C67E2E` | Infantry sash and headgear, no emission |
| Crimson | `#8D302B` | Royal cloth and saddle blankets |
| Vermilion | `#B84B32` | Tiny rank accents, not dominant |
| Forest green | `#3E5943` | Sage trim, limited to cloth |
| Steel | `#89908B` | Weapon edges; low contrast relative to ivory |
| Sandstone | `#C7A47B` | Fortress structure, visibly distinct from armor |

These are art targets, not measured historical pigments. Metals use metallic 1;
stone and cloth use metallic 0. Avoid painted white highlights that remain fixed
when the piece turns. Sun/key remains upper-left in screen space; shadows are soft,
short and readable on both sandstone squares.

Let S = one square width. Shared circular base diameter .68S, height .07S. Idle
silhouette width ≤ .82S; no spear, cape or horse tail extends into a neighbor's
interaction area. All displayed art including shadow fits one cell in static mode.
Heights below are projected screen heights, including headgear but excluding shadow.
Human master meshes use realistic approximately 7–7.5-head proportions. Change
camera framing rather than enlarging heads and hands to force readability.

## Classes and deployment

| Class | Count / initial squares | Height | Silhouette and model concept |
| --- | --- | --- | --- |
| Raja / Rajarshi — King | 1 / e1 | .87S | Broad shoulders, upright compact tiered crown, straight vertical sword, squared robe hem |
| Samrajni — Queen | 1 / d1 | .94S | Tall flared crown, narrow waist into layered triangular robe, low curved blade, sweeping but contained cape |
| Acharya — Bishop | 2 / c1,f1 | .81S | Slender staff-led silhouette, rounded turban/topknot, diagonal robe fold, no royal crown |
| Ashva Senani — Knight | 2 / b1,g1 | .86S | Horse head and arched neck dominate the profile; rider sits low, upright lance nested inside body envelope |
| Durg — Rook | 2 / a1,h1 | .72S | Broad square battlements above a circular plinth; compact stepped buttresses, central gate relief |
| Padati — Pawn | 8 / a2–h2 | .69S | Simple turban, spear and round shield, short practical lower garment; identical equipment |

### Raja / Rajarshi

Authority through stillness and weight. Engraved breastplate over layered ivory
robes, limited crimson shoulder mantle, gold crown and belt. Both hands can rest on
the sword hilt at idle; during movement the off hand gathers the mantle. Crown has
three broad tiers and a compact central finial, clearly unlike the queen's fan shape.
Sword is ceremonial but properly gripped and weighted. A single lotus border on the
plinth is sufficient. Defeat separates crown, shoulder plate and stone torso shell
into small non-anatomical fragments; never leave a recognizable body on the board.

### Samrajni

The visual focal point: tall flared crown, clean face framing, layered ivory garments
with a crimson outer panel, articulated breastplate, gold shoulder and waist accents.
Practical armor covers the torso; no exposed midriff or impractical high heels.
Curved sword is held low in idle, contrasting with king's vertical blade. Her sword
arm, forward foot and trailing cloth create a strong diagonal during attack. Keep
embroidery away from silhouette edges so she reads at 40px. Defeat releases an armor
panel and carved cloth shards rather than depicting bodily injury.

### Acharya

A royal adviser, not a European bishop or wizard. Ivory wrapped robes, forest-green
border and a small bronze clasp. High, rounded head wrap; sparse jewelry, no crown.
Staff with a carved geometric cap is thicker than the pawn spear and has no blade.
Its long diagonal is visible beside a narrow body. Calm downward chin and dignified
shoulders. Do not assume a priestly identity or caste marker for decoration. Attack is
a precise two-handed staff strike; no spell, lightning or glowing religious symbol.
Defeat leaves a staff section, clasp and two small stone chips.

### Ashva Senani

Powerful horse with a naturally arched neck, planted hooves and believable shoulder,
barrel and hindquarter masses. Compact stance and slightly turned head preserve the
horse profile. Bronze chamfron, limited segmented neck protection, leather-colored
tack, ivory carved hide, crimson saddle cloth. Rider's simpler turban-helm must not
compete with the horse. Model reins, stirrup clearance and saddle contact; don't glue
the rider to a moving torso. Mane and tail are few sculpted locks. Separate horse and
rider skeletons with saddle constraints. Defeat breaks the miniature's outer shell;
no fallen horse or rider anatomy remains.

### Durg — rook alternatives and choice

| Criterion | Ratha chariot | Durg fortress |
| --- | --- | --- |
| Silhouette | Wheels, horses and crew compete with knight | Broad crenellated mass reads immediately |
| Cell footprint | Convincing horse team needs roughly two squares | Fits .82S including buttresses |
| Motion | Natural wheel rotation but turning radius exceeds a cell | Requires a clearly authored enchanted mechanism |
| Destruction | Many thin spokes/reins; difficult small-screen debris | Stone courses and bronze gate give clean material breaks |
| Production | Several rigs and contact systems | One rigid assembly with gate and base mechanism |

**Choose Durg.** A sandstone watchtower on a low bronze siege carriage concealed
within the plinth, with four visible recessed rollers at the corners. Rollers justify
translation without suggesting a floating building. Crown is squared merlons, not
temple spires; gate carving is military geometry. A short integrated bronze ram
extends only during contact. No deity niche or sacred text is destroyed. Dense stone
mass, restrained crimson pennant, shallow lotus course at base. Stones shift a few
millimeters under impact and settle. Reject the design if the base mechanism cannot
be read in a close inspection render.

### Padati

The army's repeated rhythm. Plain bronze scale/lamellar-inspired vest, ivory lower
garment with broad folds, saffron turban and sash, small domed shield. Spearhead is
steel, shaft dark wood. Minimal trim; more economical than every royal model. Shield
provides the primary mass, spear the vertical recognition cue. Eight instances share
one mesh, rig, texture set and clips. Stable square/piece identity selects one of
three subtle idle phase offsets, never random outfit differences. Spear thrust and
shield recovery stay inside the action envelope. Defeat yields shield rim, spear
section and two stone chips, not a prone soldier.

## Art approaches

| Approach | Look and advantages | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Sculpted PBR masters → pre-rendered 2.5D | Rich stone, metal and cloth; baked contact shadows; deterministic authored fracture | Fixed camera, view atlases, hard cavalry routing and contact | **Recommended benchmark** for existing flat board |
| Full real-time PBR miniatures | True depth, weapon contact, lighting, inspection orbit | New renderer, camera/picking integration, GPU/memory cost, context-loss fallback | Reconsider only after measured prototype proves 2.5D insufficient |
| Hand-painted sculptural relief sprites | Painterly carved-stone relief with hand-authored frame animation; lowest runtime complexity | Less volumetric realism; cavalry and breaking require extensive drawing | Viable reduced-art direction, weaker match for cinematic brief |

## Reference boundaries

The [National Museum arms collection](https://nationalmuseumindia.gov.in/en/collections/index/9)
provides references for plate construction and red/black/gold shield decoration.
The [Met's North Indian shield](https://www.metmuseum.org/art/collection/search/34132)
provides a reference for shallow-domed shield construction and restrained raised
ornament. These are object references, not proof of an ancient-period ensemble.
Record date, region, source and interpretation for every borrowed visual cue in the
artist handoff. Use original ornament layouts rather than copying sacred artifacts.
