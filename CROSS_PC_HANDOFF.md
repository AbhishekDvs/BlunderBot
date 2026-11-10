# Cross-PC Handoff — 2.5D Cinematic Encounter Recovery (WIP Checkpoint)

> Status: **WIP Checkpoint** preserving Sol's local recovery changes for cross-PC continuation. Do **not** merge to `main` yet.

## 1. Git State & Branches

- **Repository:** `https://github.com/AbhishekDvs/BlunderBot`
- **Recovery Branch:** `codex/cinematic-encounter-recovery`
- **Base / Parent Commit:** `18352da` (`feature/integrate-sol-2p5d-armies` — verified ancestor)
- **Art Source Branch:** `origin/astra/2p5d-art-production` (`6fecd1f`)
- **Latest Checkpoint Commit:** Created at HEAD of `codex/cinematic-encounter-recovery` right after adding this file (run `git log -1 --oneline`).
- *(Note from original PC: work was developed in worktree `C:\Users\Hp\Documents\myprojs\BlunderBot-cinematic-recovery`; also note `feature/2p5d-stylized-indian-war-chess` at `bc08ac6` and `feature/integrate-sol-2p5d-armies` at `18352da` exist locally on the original machine.)*

## 2. Files Changed in This Checkpoint

### Modified (12)
- `apps/frontend/src/app/game/GameBoard.tsx`
- `apps/frontend/src/components/game/ThreeBoardCanvas.tsx`
- `apps/frontend/src/lib/three/ThreeChessRenderer.ts`
- `apps/frontend/src/lib/three/cameraController.ts`
- `apps/frontend/src/lib/three/encounterDirector.ts`
- `apps/frontend/src/lib/three/gameEndingDirector.ts`
- `apps/frontend/src/lib/three/indianArmiesRuntime.ts`
- `apps/frontend/src/lib/three/pieceBuilder.ts`
- `apps/frontend/src/lib/three/types.ts`
- `apps/frontend/src/theme/astraIntegration.ts`
- `apps/frontend/src/theme/themeTypes.ts`
- `scripts/astra/three_war_chess.test.mjs`

### Newly Created (5)
- `apps/frontend/src/lib/three/visualEventQueue.ts`
- `apps/frontend/src/lib/three/spriteEncounterStage.ts`
- `scripts/astra/encounter_queue.test.mjs`
- `scripts/astra/encounter_browser.test.mjs`
- `CROSS_PC_HANDOFF.md`

*(Ignored local directories `.cache/`, `.next/`, `apps/frontend/next-env.d.ts`, and `node_modules/` are intentionally excluded.)*

## 3. Completed Recovery Work Preserved

- **Serialized Visual Event Queue (`visualEventQueue.ts`):** Every chess move enqueues a frozen `VisualMoveEvent` carrying unique `id`, `generation`, `before`/`after` FENs and `VisualPosition` maps, stable per-piece `VisualIdentity` IDs across captures/castling/promotions, deduplication, and strict lifecycle (`QUEUED -> PREPARING -> APPROACHING -> CONTACT -> IMPACT -> DESTRUCTION -> SETTLEMENT -> COMPLETE`).
- **Isolated 2.5D Encounter Stage (`spriteEncounterStage.ts`):** Uses live character sprites, authored weapon/defense socket contact calibration (`resolveSpriteContact`), per-encounter `effects/{w,b}_impact_debris.webp`, and hides active board tokens during duel playback without cross-contamination.
- **Renderer Reconciliation & Callback Guards (`ThreeChessRenderer.ts`):** Tracks pieces by `instanceId` (`nodesById`), serializes consecutive captures (`1. e4 d5 2. exd5 Qxd5`) and rapid AI replies, safely cancels/skips active animations while advancing queued snapshots, rejects stale post-reset callbacks by generation, and queues `pendingEnding` until active captures complete.
- **Camera Framing & Canvas Proportions (`cameraController.ts`, `ThreeBoardCanvas.tsx`, `pieceBuilder.ts`):** Exclusive encounter camera ownership with snapshot save/restore, updated `0.82` canvas aspect ratio fit, `PieceBuilder3D.orientSprite`, and improved grounded card/shadow presentation.
- **Game Flow Integration (`GameBoard.tsx`, `astraIntegration.ts`, `gameEndingDirector.ts`):** Passes `beforeFen`/`afterFen` metadata into `astraHub`, coordinates checkmate/draw ending completion with the result modal, and preserves visible losing-King acknowledgement (`defeat_acknowledgement`).

## 4. Verification Status

### Confirmed Passing in This Checkpoint
Ran in `BlunderBot-cinematic-recovery` on commit state before committing:
- `node scripts/astra/asset_gate.test.mjs` — **5/5 pass**
- `node scripts/astra/three_war_chess.test.mjs` — **6/6 pass**
- `node scripts/astra/combat_and_statemachine.test.mjs` — **7/7 pass**
- `node scripts/astra/motion.test.mjs` — **2/2 pass**
- `node scripts/astra/rig_and_contact.test.mjs` — **5/5 pass**
- `node scripts/astra/encounter_queue.test.mjs` — **5/5 pass**
- **Total unit/asset tests:** **30/30 pass**
- `yarn --cwd apps/frontend tsc --noEmit` — **exit 0**
- `yarn --cwd apps/frontend lint` — **exit 0** (no ESLint warnings or errors)

### Incomplete / Unverified
- `yarn --cwd apps/frontend build`: Not re-run during this emergency checkpoint save (existing `.next/BUILD_ID` `Vh_sHfQnX6grNVT-4tUf8` from prior session on `2026-11-10T11:48:44Z`; re-run after browser fixes).
- `scripts/astra/encounter_browser.test.mjs` (Playwright browser suite A–H): **Not run in this checkpoint session.** Per Sol's report prior to limit interruption, Tests A, B, D, E, F, G passed earlier while **two browser tests remain open**:
  1. **Test C (`Skip` during consecutive captures):** Skip test input missed the first duel's active window (`reset()` defaults to `pacing = 'fast'` and `requestAnimationFrame(skip)` in `encounter_browser.test.mjs` checks React's asynchronously rendered `Skip` button while the first duel is active — verify timing/cinematic pacing or UI visibility synchronization).
  2. **Test H (Real-input UI + Stockfish reply in 2.5D and `flat-2d`):** Timed out waiting for real board click -> Stockfish engine reply and `flat-2d` SAN move button render in headless Chromium.

## 5. Known Notes & Environment Setup

- **Playwright in `encounter_browser.test.mjs`:** Expects Playwright (`PLAYWRIGHT_MODULE` or `.cache/browser-tools/node_modules/playwright` or global/local `playwright`), plus Chromium (`PLAYWRIGHT_EXECUTABLE_PATH` if needed) launched with `--use-angle=swiftshader --enable-unsafe-swiftshader` for headless WebGL. Expects Next.js app served on `http://localhost:3100` (or override `BLUNDERBOT_TEST_URL`).
- **2.5D Fixed Source Views:** Sol's `indian-armies-v1` atlases provide fixed three-quarter views only (Bishops screen-left, others screen-right), without mirrored back textures.

## 6. Commands & Exact Next Tasks on Home PC

### Setup & Start App
```bash
git fetch origin --prune
git checkout codex/cinematic-encounter-recovery
git pull origin codex/cinematic-encounter-recovery

yarn install --frozen-lockfile
```

### Run Unit/Asset Tests, Typecheck, Lint & Build
```bash
node scripts/astra/asset_gate.test.mjs
node scripts/astra/three_war_chess.test.mjs
node scripts/astra/combat_and_statemachine.test.mjs
node scripts/astra/motion.test.mjs
node scripts/astra/rig_and_contact.test.mjs
node scripts/astra/encounter_queue.test.mjs

yarn --cwd apps/frontend tsc --noEmit
yarn --cwd apps/frontend lint
yarn --cwd apps/frontend build
```

### Continue Browser Verification (`encounter_browser.test.mjs`)
1. Start the frontend server on port `3100` (dev or production `start`):
   ```bash
   yarn --cwd apps/frontend start -p 3100
   # or: yarn --cwd apps/frontend dev -p 3100
   ```
2. Install Playwright if not installed on the new machine (`npm install --no-save playwright` into `.cache/browser-tools` or set `PLAYWRIGHT_MODULE` / `PLAYWRIGHT_EXECUTABLE_PATH`).
3. Run the browser regression suite:
   ```bash
   node scripts/astra/encounter_browser.test.mjs
   ```
   *(Optionally set `RECOVERY_SCREENSHOTS=1` to write temporary inspection PNGs under `.cache/recovery/` — keep `.cache/` uncommitted.)*
4. **Immediate Next Tasks:**
   - Debug & stabilize **Test C** (ensure `Skip` click hits while the first capture `wP x bP` is in its active React + stage window and queued `Qxd5` proceeds cleanly).
   - Debug & stabilize **Test H** (verify real square click hit-testing in 2.5D and `flat-2d` modes and confirm Stockfish WASM worker initialization/reply timing in Playwright).
   - Inspect live desktop & mobile gameplay frames (`1. e4 d5 2. exd5 Qxd5` and `4k3/8/4b3/8/3N4/8/8/4K3` `d4e6`) to sign off final 2.5D visual polish, re-run `yarn --cwd apps/frontend build`, then push and open PR once green.

## Home-PC continuation — intermediate checkpoint (2026-11-10)

- Recovered the complete `origin/codex/cinematic-recovery-checkpoint` at
  `1b9225cf2115fec76bfe39eecb04d30fcc19a9f7`; verified `18352da` is an ancestor.
- Working branch: `codex/cinematic-gameplay-stabilization`. Original checkpoint,
  art branch and `main` remain unchanged.
- Original browser Tests C and H both passed against the production build here.
  The original PC's timeout was not reproduced; no engine or hit-test defect has
  been established. Test weaknesses were renderer-only reset versus React game
  state, sleeps around selection, unbounded polling, and broad SAN selectors.
- Reworked C to click the real Skip button atomically with active-stage identity,
  phase and queued-reply checks. It verifies exact next ownership, removed units,
  effects cleanup, final FEN and restoration of the previous camera.
- Reworked H to use fresh actual UI games, selection acknowledgement, real worker
  `bestmove` messages and exact chess.js/FEN reconciliation in both modes, with
  multiple moves/captures and authored gait-frame/movement checks.
- Fixed one Skip input also skipping an ending started by that capture.
- Fixed encounter-stage scale changing as actors approach/settle; frame the full
  movement path once while preserving authored contact and artwork.
- Production build, standalone TypeScript, ESLint and all 30 unit/asset tests pass.
- Expanded browser run: A–G passed, including new C and stable-scale contact
  assertion. New Black/draw/UI tests exposed test harness assumptions (no stage
  has undefined effects ownership; Playwright actionability can outlast an ending
  under SwiftShader). These harness fixes are under revalidation, not yet signed off.
- Screenshots are in ignored `.cache/recovery/` only. No evidence artifacts staged.
- Browser invocation on this PC: set `PLAYWRIGHT_MODULE` to the installed runtime's
  `node_modules/playwright` and `PLAYWRIGHT_EXECUTABLE_PATH` to installed Chromium.
  `BLUNDERBOT_BROWSER_GPU=hardware` omits forced SwiftShader flags; report the
  actual WebGL renderer before attributing measurements to hardware GPU rendering.
