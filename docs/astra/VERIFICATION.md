# Verification — 9 November 2026

## Executed

| Check | Result |
| --- | --- |
| `npm run build` in apps/frontend | Passed production compilation, lint/type validation and static generation |
| `tsc --noEmit --incremental false` in apps/frontend | Passed |
| ESLint on GameBoard, GameClient, themes, motion policy and motion hook | Passed |
| `node scripts/astra/motion.test.mjs` (Node 24.14.1) | 2 policy tests passed: off, black-side compatibility, device preference, explicit reduced |
| `python3 -m unittest discover -s scripts/astra -p 'test_*.py' -v` (Pillow 10.2.0) | 5 tests passed: alpha-preserving round trip, ordering, hash, dimensions, contact bounds, invalid input, immutable output, atlas limits |
| Built app in in-app browser at localhost:3098/game | Loaded successfully; no warning/error logs reported at inspection |
| Sandstone button | Computed square colors `rgb(234,217,183)` / `rgb(148,112,75)` match palette |
| Motion selector | Off and Reduced selections visibly reflected in UI |
| Move smoke check | With Off: e2→e4 moved white pawn; bot replied d7→d5 |
| Capture smoke check | With Reduced: e4×d5 moved white pawn, cleared e4 and reduced visible pieces from 32 to 31 |

[Browser evidence](game-smoke.png) shows the sandstone board, Reduced selector and
position after e4 / d5. The capture check was performed subsequently. Existing SVG
pieces in this screenshot are intentional fallback art, not ASTRA miniatures.

Production build reports `/game` at 49.9 kB route size and 153 kB first-load JS.
This is a build-size observation, not a measured runtime speedup. No renderer
dependency was added. The ~2.7 MiB concept PNG stays under docs, outside public and
the application import graph. No benchmark assets are loaded during gameplay.

## Mechanics scope

This task changed presentation imports/props, the animation duration calculation,
the settings selector and board palette. It did not edit chess move handlers,
promotion handling, FEN generation, engine protocol, bot scheduling or game-over
logic. The repository already contained local modifications to these areas before
this task; a diff against Git HEAD includes those earlier edits and must not be
mistaken for this task's scope.

The browser checks verify ordinary movement, a bot response and capture for the
new presentation settings. They are not exhaustive chess regression coverage.
No undo/replay interface is implemented by this task; their required future visual
behavior is specified in ANIMATION.md. No claims are made about existing engine
bugs beyond the tested flows.

## Required before animated release

The following tests are **pending**, because production meshes/clips and a combat
renderer do not yet exist:

1. Run identical accepted move sequences with full/reduced/off rendering; assert
   byte-identical FEN and PGN after every ply. Include ordinary capture, en passant,
   both castlings, all four promotion choices, capture-promotion, checkmate and draw.
2. Interrupt at anticipation/contact/break/recovery using restart, undo, replay seek,
   resize, board flip, style switch and component unmount. Assert no stale victims,
   hidden attackers, effects, callbacks or changed legal position.
3. Feed rapid consecutive states while clip decoding is pending; obsolete loads
   cannot reappear. Test failed/corrupted atlas and hidden-tab resume. Verify stable
   PNG export and no CORS/CSP regressions.
4. Confirm live OS reduced-motion changes and keyboard/touch controls on desktop and
   real phones. Use Off to verify there are zero combat/idle/effect frames scheduled.
5. Profile final art at 320, 390 and 1440px viewport widths and DPR 1/2. Record exact
   device, OS, browser, renderer revision and resource transfer/decode sizes. Use a
   representative midrange phone as well as desktop; CPU throttling is supplemental.
6. Record cold-load, 32-piece idle for 60 seconds, repeated captures, 100 rapid replay
   plies and 20 restarts. Measure p50/p95 frame interval, long tasks, input latency,
   resident decoded art and heap after settling. Compare to the existing SVG baseline.
7. Require no retained growth across restarts and compliance with PRODUCTION.md's
   budgets. Inspect trace spikes around first decode and bitmap eviction. Verify
   quality downgrade without losing input or changing FEN.

No full-army frame-rate, GPU-memory, model-gait or cinematic-contact measurements
are reported as passed. The delivered output follows the request's explicit
asset-specification/pipeline alternative where finished assets cannot be produced.

## Implementation Verification (`feature/astra-war-chess`)

| Check | Suite / Command | Result | Notes |
| --- | --- | --- | --- |
| Motion Policy Suite | `node scripts/astra/motion.test.mjs` | 2/2 PASS | Reduced motion & off checks verified |
| Atlas Packer Suite | `python3 -m unittest discover -s scripts/astra` | 5/5 PASS | Roundtrip, limits, hash, integrity verified |
| Combat & State Machine Suite | `node scripts/astra/combat_and_statemachine.test.mjs` | 7/7 PASS | Strict 6-state lifecycle, en passant, castling, cancel, debris bounds verified |
| Total Automated Tests | Combined 14 tests across Node & Python | 14/14 PASS | 0 failures, 0 regressions |
| Production Build | `yarn --cwd apps/frontend build` | PASS (exit 0) | Next.js 15.5.29 prerendered static routes |
| ESLint & Typecheck | `yarn --cwd apps/frontend lint` | PASS (exit 0) | 0 warnings, 0 errors |
| Security Audit | `yarn audit` | PASS (exit 0) | 0 vulnerabilities found |
| Default Theme Status | `apps/frontend/src/theme/themePresets.ts` | Configured | Default set to `ancient-battlefield` + `astra-medieval` + `elevated-2.5d` + `stone` sound |

