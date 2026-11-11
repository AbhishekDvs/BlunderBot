# Cross-PC Handoff — Cinematic Gameplay Stabilization

Status: validated on the home PC on 2026-11-10. Keep this work on its feature
branch; do not merge into `main` without a separate review.

## Recovery and Git state

- Repository: `https://github.com/AbhishekDvs/BlunderBot`
- Starting recovery checkpoint: `1b9225cf2115fec76bfe39eecb04d30fcc19a9f7`,
  retrieved from `origin/codex/cinematic-recovery-checkpoint`.
- Verified integration ancestor: `18352da472325d9007b65b56267fdcafc2ea6089`.
- Working branch: `codex/cinematic-gameplay-stabilization`.
- Intermediate pushed checkpoints: `75a0598` and `c7e551b`.
- Final commit: run `git log -1 --format='%H %s'` on this branch.
- Original recovery checkpoint, Sol's art branch and `main` were preserved.
  No resets, rebases, merges, force pushes or regenerated army assets were used.

## Preserved implementation

The recovered immutable visual-event queue, frozen before/after positions,
stable unit identities, serialized encounter stage, cancellation generations,
authored Indian army frames/contact calibration, camera ownership/restoration,
distance-based gait and deferred game endings remain in place.

## Completed changes

- Test C observes the first active Pawn encounter, its stage owner/phase, the
  queued Queen reply and React's real Skip button in the same browser task.
  Bounded state polling replaces the unbounded timing-sensitive loop. It checks
  the exact next encounter, defender removal, actor identities, clean effects,
  final FEN and restoration of the previous tactical camera.
- One Skip/Escape input now resolves only the presentation active at that input.
  Skipping a final capture cannot also skip the ending it starts synchronously.
- Test H starts fresh React games and uses actual board clicks in animated and
  classic modes. Selection is acknowledged before clicking the destination.
  It observes real Stockfish worker replies, validates every resulting FEN with
  chess.js, and checks renderer reconciliation and visible authored Pawn gait.
  No game-event injection or replacement engine is used in H.
- The original H timeout did not reproduce on this PC. No Stockfish or square-hit
  defect was established. Harness problems included renderer-only resets that
  left React's chess state intact, startup reconciliation racing fixtures, and
  a spare fixture renderer competing with the real gameplay renderer.
- The animated viewport exposes startup readiness through `aria-busy`; fixture
  injection waits for initial metadata/atlas loading and reconciliation.
- Encounter framing fits the entire actor movement path at a fixed scale,
  avoiding apparent character growth/shrinkage during approach and settlement.
  Authored contact points and unmirrored artwork are preserved.
- Initial army textures share their decoded/GPU atlas source while retaining
  independent per-character UV offsets. Eight Pawns no longer upload separate
  copies of the same atlas source.
- Missing main/ending atlases use cached repeated-token atlases, so idle and
  walking frame sampling cannot crop away the fallback piece. Missing effects
  use a transparent fallback.
- Saved classic mode waits for theme hydration before mounting a board. It
  creates no transient WebGL renderer or army texture requests during startup.
- Last-move overlays reuse two attached meshes. Previously removing them without
  disposing their GPU geometry caused growth across moves. Reset now clears
  those highlights as well as selection, check and legal-move indicators.

## Final verification

- All 30 unit/asset tests pass: asset gate 5, Three war chess 6, combat/state
  machine 7, motion 2, rig/contact 5, encounter queue 5.
- Complete production Chromium browser suite: **12/12 pass**, one uninterrupted
  final run, approximately 145 seconds.
- Test C passes `1. e4 d5 2. exd5 Qxd5`, skipping only the active first capture.
- Test H passes four player moves, four real Stockfish replies and three captures
  in each mode. Animated Pawn e2–e4 showed nine different authored gait frames
  and changing world positions; the same renderer survived all React updates.
- Browser checks also pass consecutive/rapid captures, restart/undo/theme
  cancellation, legal Knight/Bishop contact, exact camera restoration, White and
  Black mating captures, single ending completion, visible losing King,
  celebration, draw disengagement, ending Skip, both orientations and mobile.
- Missing-atlas browser check verifies visibility in all 64 frame cells, one
  shared Pawn atlas source and eight independent Pawn animation textures.
- Classic mode creates **zero WebGL contexts**, including during hydration.
- Three repeated capture/reset cycles each retain **72 geometries / 48 textures**,
  32 live unit instances, no visible old highlights and no queued/stale encounter.
- Standalone TypeScript, ESLint (no warnings/errors), and Next.js production build
  all pass. Tactical and calibrated contact frames were visually inspected.
- Browser screenshots remain in ignored `.cache/recovery/` only; no screenshots,
  traces, recordings, build outputs, caches or credentials are committed.

## Performance and remaining limits

The final production gameplay sample recorded 332 frame intervals, including
encounters: median **33.4 ms**, p95 **133.3 ms**, with one persistent renderer.
Chromium reported **ANGLE / Vulkan SwiftShader Device (Subzero)**. Default launch
also reported SwiftShader; these are software-rendering measurements, not a
hardware-GPU benchmark. Software rendering still stutters; smooth hardware
performance has not been established here. Allocation counts plateau in the
repeated encounter/reset test; that is bounded regression evidence, not proof
against every possible long-session leak.

Sol's sprites retain their authored fixed three-quarter views. The dedicated
transparent-sprite encounter stage and bounded board camera preserve that
perspective; arbitrary rear views and volumetric characters remain unsupported.
No functional failures remain in the exercised regression cases.

## Re-run

```bash
git fetch origin --prune
git switch codex/cinematic-gameplay-stabilization
git pull --ff-only

for suite in asset_gate three_war_chess combat_and_statemachine motion rig_and_contact encounter_queue; do
  node "scripts/astra/$suite.test.mjs"
done
yarn --cwd apps/frontend tsc --noEmit
yarn --cwd apps/frontend lint
yarn --cwd apps/frontend build
yarn --cwd apps/frontend start -p 3100
```

In a second terminal, set `PLAYWRIGHT_MODULE` to an installed Playwright module
and `PLAYWRIGHT_EXECUTABLE_PATH` to Chromium if they are not found automatically:

```bash
node scripts/astra/encounter_browser.test.mjs
```

Optional: `BLUNDERBOT_TEST_URL` changes the server URL;
`RECOVERY_SCREENSHOTS=1` saves ignored inspection frames;
`BLUNDERBOT_BROWSER_GPU=hardware` omits forced SwiftShader flags, but the printed
WebGL renderer must still be checked before claiming hardware acceleration.
