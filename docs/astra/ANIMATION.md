# Animation specification — future asset-backed renderer

This is a production contract. Only standard board translation and reduced/off
controls are currently implemented. No capture clips or destruction are shipped.

## Timing and weight

Clip sampling: 24 fps source, time-based playback on requestAnimationFrame. The
render loop interpolates root position; never advances chess state. Routine travel
target 240–420ms, capture target 600–850ms. These are maximum visual budgets, not
delays imposed on the engine. Long-distance travel may require compressed strides;
if it reads as skating, use reduced translation instead of speeding up legs absurdly.

| Class | Idle (4–6s loop) | Move | Capture / contact | Follow-through |
| --- | --- | --- | --- | --- |
| King | Tiny shoulder lift, mantle settles | 2 deliberate weighted steps | 140ms sword lift, 180ms approach, 100ms downward strike; contact ~420ms | 120ms defender break + 160ms occupy and recover; total ~700ms |
| Queen | Slow posture shift, quiet cape edge | Decisive step and contained turn | 100ms anticipation, 150ms approach, 140ms feint into decisive cut; contact ~390ms | 100ms break + 160ms recovery; total ~650ms |
| Sage | Small breath, fingers settle on staff | Measured steps with staff planted | 160ms two-hand brace, 170ms approach, 110ms precise staff strike; contact ~440ms | 120ms break + 140ms settle; total ~700ms |
| Knight | Ear flick, restrained head shift, tail lock motion | Slow-in, compact trot, weight transfer, settle; no gallop in one cell | 120ms gather, 230ms charge approach, 90ms lance thrust; contact ~440ms | 150ms break + 210ms rein-in; total ~800ms |
| Rook | Pennant edge only; structure stays solid | Rollers turn with distance, heavy ease-in/out | 180ms ram brace, 220ms roll, 100ms ram impact; contact ~500ms | 140ms chips + 210ms structural settle; total ~850ms |
| Pawn | Small weight shift, shield arm settles | Disciplined march, spear steady | 100ms brace, 160ms approach, 100ms spear thrust; contact ~360ms | 100ms shield recovery/break + 140ms occupy; total ~600ms |

Human breathing is suggested through construct posture, not visible fleshy chest
deformation. Idle displacement ≤ 1 CSS pixel at a 62.5px cell. A blink is optional
only if visibly carved eyelids can work; do not spend animation memory on invisible
detail. Cloth and banners use authored bones, no perpetual cloth simulation.

## Contact contract

Attacker approaches a stop point outside the defender silhouette. Weapon-tip and
defender contact anchors are authored per direction. At the declared `contactFrame`,
the weapon tip must lie within .04S of the defender's impact anchor. Defender
anticipation cannot precede contact. Impact reaction takes 80–140ms, then the shell
fractures and clears the destination; attacker steps into its canonical square.
For the queen, the feint must not appear to hit and pass through an intact defender.

Each victim class has front/side/rear reaction variants and a `break` clip. A large
rook cannot collapse like a pawn, and a small pawn cannot launch a rook upward.
Reaction direction follows incoming travel. Heavy constructs fracture in place;
small armor fragments carry momentum away from contact. Contact framing must work
with all six defenders, not only a pawn-vs-pawn showcase.

No screen shake by default. No camera rotation or zoom during normal play. Optional
cinematic emphasis may only be considered after accessibility and picking tests.

## Routing and chess exceptions

- Sliding pieces follow the legal rank/file/diagonal route. Their whole silhouette
  stays within the unobstructed movement corridor, with local weapon/cloth clearance.
- Knight legality permits jumping, but a horse cannot visibly walk through other
  pieces. Test a swept-envelope elevated cavalry leap over the intervening cells
  using authored takeoff/landing. If clearance, frame bounds or readability fails,
  skip the full clip and use ordinary board translation; never pretend that a
  collision-free realistic gallop has been solved. The 2.5D benchmark must expose
  this limitation explicitly.
- Castling is one visual event with king and rook tracks, ending at both authoritative
  destinations. No capture or break clip.
- En passant locates the victim at `(to.file, from.rank)`, not the empty destination.
  Use a dedicated passing thrust at that square before occupation of `to`; otherwise
  select the reduced transition. Never invent a defender on the destination.
- Promotion moves the pawn first, then swaps to the selected class at settlement.
  Capture-promotion breaks the defender before the replacement; underpromotion uses
  the actual engine-selected type. No glow or explosion required.
- If the board is flipped or resized mid-action, cancel and show canonical pieces.
  Attack facing comes from screen-space direction plus orientation. Do not mirror
  one-handed weapons or baked lighting to synthesize missing views.

## Fragments and material response

Stone: 2–4 chips with short outward arc, small chalk dust puff. Bronze/steel: 1–2
recognizable plates, one restrained bounce then settlement. Wood: a shaft section,
not splinters spraying across ranks. Cloth breaks as carved shell material; no
biological body underneath. Never show blood, injuries, a skeleton or a corpse.

Cap at 6 fragments per capture, 12 globally, 8 dust sprites globally. Fragment
longest edge ≤ .12S. Reserve destination center and indicator areas; settle fragments
near the inside edge of the capture cell. Fade by 1.2s, hard-remove by 1.8s. New captures
evict oldest effects. No persistent physics engine; use baked paths or seeded
ballistic functions with at most one bounce. All overlays have pointer-events none,
are aria-hidden, and cannot intercept board input. Reduced/off modes leave no debris.

## State and cancellation contract

1. Chess.js accepts a legal move, updates authoritative FEN immediately, and remains
   the sole owner of rules. Visual code receives immutable before/after snapshots,
   verbose move, monotonically increasing revision and reset generation.
2. A presentation controller validates the pair and derives a visual plan. It keeps
   the defender in its own overlay from the pre-move snapshot; it does not put a
   captured piece back into the game. Stable piece IDs travel across moves; promoted
   pieces retain lineage but change visual class.
3. While the overlay draws attacker/defender, matching base sprites are hidden for
   presentation only. Board coordinates, legal indicators and hit testing still use
   authoritative state. Input must remain available; a new move cancels the old show.
4. Every asynchronous load, frame callback and completion checks generation/revision.
   On any newer state, cancel requestAnimationFrame, clear effects, release transient
   references, unhide pieces, and render the current FEN. Never queue a backlog.
5. Undo, replay seek, restart, orientation change, unmount, hidden tab, failed decode,
   reduced/off change and context changes all take this same cancellation path.
   Backward state changes do not play reversed attacks or resurrect rubble.
6. Replay uses accepted moves and stable hashes for idle/debris variation. No Date.now
   or Math.random for choreography. Time is elapsed visual time only; no mutation of
   game, move clock, engine search or bot timers from animation callbacks.
7. Export PNG first cancels the overlay and captures the canonical stable board.

This requires a dedicated overlay/controller integration. React Chessboard's
`customPieces` alone cannot preserve a removed defender or stage weapon contact.
Do not implement combat by adding an independent timeout to every custom piece.

## Motion levels

Current implementation: follow device preference gives 300ms board translation,
or 100ms when the OS requests reduced motion; reduced is always 100ms; off is 0ms.
Black orientation retains the repository's existing 0ms behavior. The media-query
listener is cleaned up on unmount. These settings do not alter move scheduling.

Future full renderer: system normal enables authored motion; reduced uses ≤100ms
translation with no idle, attacks, dust or fragments; off shows the authoritative
position immediately. Pause idles while hidden. Asset failure or repeated slow
frames downgrade to static pieces, then existing SVGs, without resetting the game.
