# White Army — Production Modeling Handoff

## Source of truth

Follow `docs/astra/DESIGN.md` in the user's repository: stylized ancient Indian military sculptural fantasy, *not* documentary reconstruction; historically respectful and with no sacred figures or inscriptions placed on destructible objects. Palette: warm ivory `#E8DDC5`, brushed gold `#B68A3E`, aged bronze `#82613D`, saffron `#C67E2E`, crimson `#8D302B`, forest green `#3E5943`, steel `#89908B`. Matte stone/cloth must have **metalness 0**; metal can use metalness 1.

## Six actual chess identities

| GLB | Chess class | Final sculpt direction | Distinct recognition landmark | Core combat action |
|---|---|---|---|---|
| `wK` | King / Raja | Broad shoulders and mantle, compact three-tier crown, two-handed vertical sword | Tall square king crown and central weapon | downward sword strike; defeat: crown/shoulder shell |
| `wQ` | Queen / Samrajni | Flaring crown fan, layered garment and real armor, low curved talwar | Diagonal low blade and broad triangular hem | feint and decisive curved-blade cut |
| `wB` | Bishop / Acharya | Adviser with wrapped round turban, diagonal shawl and two-handed capped staff | Tall narrow staff and draped shoulder | precise brace and staff defense |
| `wN` | Knight / Ashva Senani | Connected, anatomically convincing horse with four rigged legs, seated rider and reins | Full horse head/neck and lower rider | charge, defender reaction, physical lance contact |
| `wR` | Rook / Durg | Square fortification on bronze wheeled siege carriage; recessed gate | Horizontal block mass and crenellations | battering-ram push and fractured stone courses |
| `wP` | Pawn / Padati | Simplified infantry with cloth wrap, round shield and short spear | Shield disk and compact spear | shield brace and thrust |

The illustrated concept reference in this package depicts an *alternative* elephant/chariot vocabulary. **Do not use those as authoritative for the Bishop or Rook.** The written Astra sculpt specification has priority.

## Geometry and presentation rules

- Base centered at `(0,0,0)`, ground at `Y=0`, **+Y up**, front facing `+Z`.
- Shared round base 0.68 square widths across and ~0.07 high. Avoid any artwork interfering with adjacent square selection.
- All six class heights are intentionally distinct: King ~0.87S, Queen ~0.94S, Bishop ~0.81S, Knight ~0.86S, Rook ~0.72S, Pawn ~0.69S.
- Review real board screenshots, from both sides, under typical 40–64px cell sizes. Close-up 3D detail is secondary to instant piece recognition.
- Use a consistent three-quarter camera for source-turnaround comparisons; capture game footage in the actual renderer before approving material or scale.

## Model hierarchy, sockets and the current limitations

The development GLBs include semantic names such as `Raja_Sword_Assembly`, `Samrajni_Talwar_Assembly`, `Acharya_Staff_Assembly`, `Pawn_Spear_Assembly`, and `Lance_Assembly`; mesh descendants must remain attached under those parents. They are *transform groups*, **not bone-skin rigs**. Before animating, parent each complete weapon assembly to a proper animated wrist/hand joint, keep the gripping hand in place, and supply the tip/contact sockets in **local** coordinates. Check matrices after animation using `Object3D.updateWorldMatrix(true, true)`. The supplied prototype sockets are only placeholders and not validated combat contact points.

**Required animation set per finished asset:** idle, move, attack, defend/react, break; horse additionally takeoff and land if a collision-safe knight move is used. Export completed animations in a versioned GLB or clip collection. No such clips ship here.

**Required defeat effect:** authored segmented sculpture/armor shells; plinth grounded; no whole-piece shrink/tipping; 3–6 debris pieces with one bounce, clear before blocking interactions. No gore, bodies or a defeated king being captured.

## Visual acceptance / stop conditions

1. Side/front/back clay views show convincing body, clothing volume, horse anatomy, hands actually gripping weapons.
2. Full-res materials show clear differences between armor, cloth, stone and steel in both White and Black presentation.
3. Recognition passes for each class at normal gameplay distance and camera; no unidentifiable upright tokens.
4. Capture shows *both* pieces preparing and reacting; weapon-tip/contact anchor distance is checked at the actual impact frame.
5. Destroyed units fracture into sculpted components rather than uniformly shrink.
6. Camera frames full royal ranks; no results modal obscures victory cinematography.
7. Measured frame-time traces and memory budgets exist for real app usage.

The current geometry studies fail item 1. Do not extrapolate acceptance from file format validity, and do not assign 3D/combat completion to Flash on their basis.
