# Flash Release Readiness Handoff

- **Repository:** `https://github.com/AbhishekDvs/BlunderBot`
- **Branch:** `flash/blunderbot-release-readiness`
- **Base commit:** `ba30c98606543875b4a41789f144f7c6ffe2d6ab` (`origin/codex/cinematic-gameplay-stabilization`)
- **Worktree:** `C:/Users/Hp/Documents/myprojs/BlunderBot-flash-release-readiness`
- **Scope boundary:** No Sol-owned files (`GameBoard.tsx`, `ThreeBoardCanvas.tsx`, `apps/frontend/src/lib/three/*`, or `apps/frontend/public/pieces/indian-armies-v1/*`) were modified.

---

## 1. Real Hardware Performance Findings

Measured against the production Next.js build (`yarn --cwd apps/frontend start -p 3100`) on Windows with Google Chrome `157.0.8103.39` and hardware-accelerated WebGL:

- **Device & GPU:**
  - CPU: 11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz (8 logical processors)
  - System RAM: 16 GB (`16,844,595,200` bytes)
  - GPU: Intel(R) Iris(R) Xe Graphics (Driver `32.0.101.7088`)
  - WebGL Renderer (`UNMASKED_RENDERER_WEBGL`): `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)` (WebGL 2.0 / OpenGL ES 3.0 Chromium)
- **Frame Pacing & FPS:**
  - Ordinary gameplay + encounters (headed Chrome, 761 samples): median `16.7 ms` (~60 FPS), p95 `16.8 ms` (~59.5 FPS), p99 `83.4 ms`, max `1199.6 ms` (first-capture 2D sprite draw/decode spike).
  - Final `encounter_browser.test.mjs` Test H (669 frames, hardware Chrome): median `16.7 ms`, p95 `66.7 ms`, 1 persistent `ThreeChessRenderer` (`sameRenderer: true`).
  - Idle rendering (`ThreeChessRenderer.startRenderLoop`): `181` frames rendered in `3002.5 ms` (`60 FPS`, `136` draw calls/frame, `2150` triangles/frame), and `91` frames rendered in `1507.5 ms` even when `pacing === 'off'`.
  - Note: Without `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding`, Chrome headless occlusion throttling introduced `6.5s–24.1s` `rAF` pauses; disabling background throttling or running headed Chrome eliminates those pauses.
- **Cold Load & Texture Decode Footprint:**
  - `apps/frontend/public/pieces/indian-armies-v1`: `32.11 MB` across `42` files (12× `2048×2048` main atlases, 12× `2048×512` ending atlases, 2× impact effect sheets).
  - Headed Chrome cold load to `aria-busy="false"` + 32 decoded atlases: `15.2 s` (`30.9 s` headless), with a `~1.0–1.4 s` background decode spike on Turn 0 (`e4`) while supplementary ending/effect sheets finish decoding asynchronously, and `~0.8 s` on the first 2D `<canvas>` capture draw.
- **Input Latency (Headed Chrome, Steady State Turns 2–3):**
  - Square click to React selection (`data-selected-square`): `45–48 ms` (Playwright mouse roundtrip included).
  - Move click to React `data-fen` update: `52–53 ms`.
- **Stockfish Worker Responsiveness:**
  - `go depth 3` (`easy`): `51.3 ms – 273.9 ms` across 5 opening/middlegame searches (`d7d5` `263.4 ms`, `d8d5` `273.9 ms`, `g8f6` `131.8 ms`, `d5a5` `61.1 ms`, `f6e4` `51.3 ms`).
- **GPU & Heap Resource Stability (6 Repeated Capture + Restart Cycles):**
  - `renderer.info.memory` plateaued at `{ geometries: 75, textures: 48 }` across all 6 cycles (and `{ geometries: 72, textures: 48 }` across 3 cycles in Test I).
  - JS heap (`performance.memory.usedJSHeapSize`): `16.08 -> 22.03 -> 13.77 -> 15.02 -> 17.49 -> 17.90 MB` (no monotonic growth).
  - Per-unit GPU audit (`32` units): `12` shared card atlas `Source`s across `32` UV-offset `Texture`s, but `32` unshared `PlaneGeometry`s, `32` duplicate `64×64` `CanvasTexture` shadow maps, `32` `CircleGeometry`s, and `64` hidden (`visible = false`) `CylinderGeometry`/`TorusGeometry` instances.
- **WebGL Context Loss & Recovery (`WEBGL_lose_context`):**
  - `webglcontextlost` fired with `defaultPrevented === true`; `webglcontextrestored` fired cleanly (`isContextLost() === false`) and rendered `256/256` sampled non-blank pixels after restore.
- **Clock Tick DOM Mutations (`timeControl=10m`):**
  - `5` DOM mutations over `5 s` of idle clock ticking.

---

## 2. Bugs Fixed (Flash-Owned Files)

1. **`2D Tilted` (`elevated-2.5d`) mode completely unclickable** — [ChessboardFrame.tsx](file:///apps/frontend/src/components/game/ChessboardFrame.tsx)
   - `transformStyle: 'preserve-3d'` on the tilted board wrapper caused `react-chessboard`'s outer flex container to intercept pointer hit-testing ahead of `[data-square]` tiles. Removing `preserve-3d` preserves the `perspective(1100px) rotateX(4.5deg) translateY(-6px)` presentation while restoring mouse clicks, drag-and-drop, and mobile touch taps across all 64 squares.
2. **Animation-disabled setting ignored in 2D modes** — [ChessboardFrame.tsx](file:///apps/frontend/src/components/game/ChessboardFrame.tsx)
   - `boardAnimationDuration` was hardcoded to `'system'` even when `settings.animationDuration === 0`. Now maps `settings.animationDuration === 0` to `'off'` and disables CSS board transition classes when motion is disabled or reduced.
3. **Silent WebGL / 3D crash risk instead of 2D fallback** — [ChessboardFrame.tsx](file:///apps/frontend/src/components/game/ChessboardFrame.tsx)
   - Wrapped `<ThreeBoardCanvas>` in `ThreeCanvasErrorBoundary` so WebGL unavailability or Three.js initialization failure displays an explicit `role="alert"` notice and falls back seamlessly to playable Classic 2D chess. Added `SvgPieceWithFallback` for broken custom 2D piece SVGs.
4. **Stockfish UCI handshake, command queuing, and stale-search cancellation** — [engineProtocol.ts](file:///apps/frontend/src/lib/stockfish/engineProtocol.ts), [useStockfish.ts](file:///apps/frontend/src/hooks/useStockfish.ts), [GameClient.tsx](file:///apps/frontend/src/app/game/GameClient.tsx), [Navbar.tsx](file:///apps/frontend/src/components/ui/Navbar.tsx)
   - Implemented sequential standard UCI initialization (`uci -> uciok -> isready -> readyok`) with outbound command queuing before `readyok`, search generation invalidation (`stop` + `supersededCount` tracking) when superseded or when `astraHub.onGameReset` / `onGameEnd` fires, `(none)` and `Failed to load stockfish.js` detection, worker `onerror` / `onmessageerror` handling, clean `quit` + `terminate()` on unmount, and an explicit `role="alert"` error banner in `GameClient.tsx` + live telemetry in `Navbar.tsx`.
5. **Human `PlayerCard` incorrectly showing `"Calculating line..."` / `"Thinking"`** — [PlayerCard.tsx](file:///apps/frontend/src/components/game/PlayerCard.tsx)
   - Scoped `showThinking = isBot && isThinking` so only the bot's card renders the thinking indicator when `GameBoard` passes `isThinking={isBotThinking}` to both cards.
6. **Accessibility & keyboard/modal gaps** — [useModalAccessibility.ts](file:///apps/frontend/src/hooks/useModalAccessibility.ts), [PromotionModal.tsx](file:///apps/frontend/src/components/game/PromotionModal.tsx), [GameResultModal.tsx](file:///apps/frontend/src/components/game/GameResultModal.tsx), [ThemeCustomizerModal.tsx](file:///apps/frontend/src/components/ui/ThemeCustomizerModal.tsx), [MoveHistory.tsx](file:///apps/frontend/src/components/game/MoveHistory.tsx), [page.tsx](file:///apps/frontend/src/app/page.tsx), [ThemeContext.tsx](file:///apps/frontend/src/theme/ThemeContext.tsx)
   - Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Tab`/`Shift+Tab` trapping, `Escape` closing, and trigger focus restoration across all 3 modals.
   - Added keyboard chessboard cursor navigation (`Arrow` keys, `Enter`/`Space`, `Escape`) and `aria-live="polite"` turn/check/selection announcements in `ChessboardFrame.tsx`.
   - Converted Home page AI opponent cards from clickable `<div>`s to semantic `<button type="button" aria-pressed>` elements, added `aria-label` / `aria-pressed` to board preset swatches, and respected reduced motion on launch delay.
   - Scoped `MoveHistory.tsx` step buttons & arrow-key navigation to when `onSelectPly` is provided so non-wired buttons aren't clickable no-ops.
   - Hardened `ThemeContext.tsx` `localStorage` hydration against malformed/invalid `perspective`, `soundPackId`, `animationDuration`, and boolean fields.

---

## 3. Bugs & Optimization Proposals Requiring Sol Changes

Because Sol owns `GameBoard.tsx`, `ThreeBoardCanvas.tsx`, `apps/frontend/src/lib/three/*`, and the art pipeline, the following items are documented for final integration rather than edited concurrently:

1. **No Undo UI button & unwired `MoveHistory` ply navigation (`GameBoard.tsx`):**
   - `GameBoard.tsx` has no Undo control and does not pass `activePly` / `onSelectPly` to `<MoveHistory>` (lines 792–798, 836–842), even though `MoveHistory.tsx` already implements ply review props.
   - **Integration fix:** Add an Undo handler in `GameBoard.tsx` that calls `stopSearch()`, clears `botTimeoutRef.current`, reverts 1 or 2 plies in `game.current`, reconciles `astraHub.notifyGameReset()` / `setFen`, and cancels `isBotThinking`.
2. **`handleResetGame` & `handleResign` Stockfish/post-game guards (`GameBoard.tsx`):**
   - Flash's `useStockfish` mitigates stale searches via `astraHub.onGameReset` / `onGameEnd`, but `GameBoard.tsx` should also destructure `{ postMessage, stopSearch } = useStockfish(...)` and call `stopSearch()` explicitly on reset/resign, clear `botTimeoutRef.current` in `handleResign()`, and track a `hasResigned` state so moves cannot be played after resigning before `showResultModal` appears.
3. **`handleCopyPGN` missing `.catch(...)` (`GameBoard.tsx` line 568):**
   - `navigator.clipboard.writeText(pgn).then(...)` lacks `.catch(...)`, risking an uncaught promise rejection if clipboard permissions are denied.
4. **Idle GPU rendering (`ThreeChessRenderer.ts` line 674):**
   - `startRenderLoop()` unconditionally calls `this.renderer.render(...)` at 60 FPS even when `pacing === 'off'` or no camera/move/animator frame changed.
   - **Patch proposal:** Track `dirty` state (camera motion, active moves, debris, ending, hover/highlight changes, or piece animator `currentFrame` change) and skip `renderer.render(...)` when idle and unchanged.
5. **Duplicate shadow textures & unused hidden geometries (`pieceBuilder.ts` lines 419–468):**
   - `build2p5dPiece` creates 32 separate `64×64` `CanvasTexture` shadow maps, 32 `CircleGeometry`s, 32 `PlaneGeometry`s, and 64 hidden (`visible = false`) `CylinderGeometry` / `TorusGeometry` instances.
   - **Patch proposal:** Cache 1 shared radial shadow `CanvasTexture`, 6 shared class `PlaneGeometry`s, and skip hidden plinth/rim meshes when building 2.5D cards (cutting GPU geometry allocations from `70–75` to `~15` and texture allocations from `48` to `~16`).
6. **Explicit `webglcontextlost` / `webglcontextrestored` listeners (`ThreeChessRenderer.ts`):**
   - Pause the `rAF` loop on `webglcontextlost` and force `this.renderer.shadowMap.needsUpdate = true` + `reconcile(...)` on `webglcontextrestored`.
7. **2.5D background decode & first-encounter 2D canvas spike (`pieceBuilder.ts`, `spriteEncounterStage.ts`):**
   - Pre-create the background `LinearGradient` in `SpriteEncounterStage` instead of allocating it per frame in `draw()`, and consider optional `createImageBitmap` off-main-thread decoding or 128 px/cell mobile atlases to reduce the `32.11 MB` / `~248 MB` decoded texture footprint.

---

## 4. Verification Summary (Post-Final-Edit)

| Check | Result | Notes |
| --- | --- | --- |
| `scripts/astra/asset_gate.test.mjs` | **5 / 5 PASS** | Manifests, WebPs, foot pivots, asset gate |
| `scripts/astra/three_war_chess.test.mjs` | **6 / 6 PASS** | GLBs, board mapping, combat, debris, endings, camera |
| `scripts/astra/combat_and_statemachine.test.mjs` | **7 / 7 PASS** | Specs, state machine, en passant, castling, motion, debris |
| `scripts/astra/motion.test.mjs` | **2 / 2 PASS** | Off, black orientation, reduced motion |
| `scripts/astra/rig_and_contact.test.mjs` | **5 / 5 PASS** | Weapon sockets, contact tolerance, base, camera fitting |
| `scripts/astra/encounter_queue.test.mjs` | **5 / 5 PASS** | Queueing, skip, reset generation, Knight/Bishop contact |
| `scripts/astra/stockfish_and_accessibility.test.mjs` | **5 / 5 PASS** | UCI handshake, cancellation, no duplicate AI move, error state |
| `scripts/astra/gameplay_regression.test.mjs` | **4 / 4 PASS** | Chrome `157.0.8103.39` hardware WebGL (`0` errors, `0` rejections) |
| `scripts/astra/encounter_browser.test.mjs` | **12 / 12 PASS** | Chrome `157.0.8103.39` hardware WebGL (`0` errors) |
| `yarn --cwd apps/frontend tsc --noEmit` | **PASS** | 0 type errors |
| `yarn --cwd apps/frontend lint` | **PASS** | 0 ESLint warnings or errors |
| `yarn --cwd apps/frontend build` | **PASS** | Production Next.js 15.5.29 build (`/` 3.95 kB, `/game` 16.4 kB) |

---

## 5. Remaining Release Blockers

- **Integration with Sol (`sol/blunderbot-visual-acceptance`):** Merge/integrate Sol's final visual work with `flash/blunderbot-release-readiness` and apply the `GameBoard.tsx` Undo / `stopSearch()` / `handleResign()` / `handleCopyPGN` `.catch()` fixes listed in Section 3.
- **Optional performance polish (Sol-owned):** Dirty-frame render gating in `ThreeChessRenderer.ts` and shared shadow/geometry caching in `pieceBuilder.ts`.
