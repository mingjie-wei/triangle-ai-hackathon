# Ask Map and character collision revision — November 7, 2026

## Integration status

- Branch: `codex/ask-map-integration`.
- Starting design HEAD: `89ba91cec57c81834b8cfb78cb978ed6019ab897`.
- Freshly fetched `origin/main`: `5fd283177bb6d806b59b8d08d0f2996ee3994c6e`.
- Common ancestor is the starting HEAD. Main includes PR2 (`fdfb486`) and provider/reply commit `90d229c`, merged by `5fd2831`.
- Selectively integrated the six changed files: `.env.example`, `ASK_MAP_INTEGRATION.md`, `src/app/globals.css`, `src/components/AskMap.tsx`, `src/server/chat/answer.ts`, `tests/chat.test.ts`. Three-way source integration retained pending local changes; CSS and documentation were reconciled manually.
- This is **uncommitted file-level integration**, not a Git merge commit; branch ancestry has not changed. No push, reset, deployment or actual environment-file edit occurred.
- Pre-edit source checkpoint: `/tmp/duke-before-ask-merge-collision.tar.gz`. Includes tracked and nonignored pending source; excludes actual `.env`, dependencies and build output. Existing uncommitted work remains in the working tree.

## Ask Map

Adopted native-fetch DeepSeek chat completions, friendly server-built wording from validated exact titles/citations, and retrieval fallback. Unknown, duplicate and non-event citations are rejected. Provider input includes only event candidates. JSON output, an eight-second timeout and a bounded token budget remain; thinking is disabled for extractive selection. All retrieved source cards and their citation keys remain visible, even when the model selects fewer highlights.

The UI explicitly counts event cards, separately from total matches. Browser fixture query “What is happening at Bryan Center?” displayed **Showing 8 of 9 events** with a retrieval-only label. Typing retained position `1198.6,2206.7` and `data-paused=true`. Locate closed chat, selected `bryan-center` and resumed map input. Building details opened exactly one Bryan Center dialog and kept the map paused.

Server-only configuration names: `CHAT_MODEL_ENABLED`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `CHAT_RATE_LIMIT_URL`, `CHAT_RATE_LIMIT_TOKEN`, `CHAT_MODEL_REQUESTS_PER_MINUTE`. Configure an exact model ID available to the account. Production model access still requires the shared limiter. No credentials/model are configured here; model use remains disabled. No real provider request was made. Mocked model success and fallback tests do not establish production readiness. See [provider API](https://api-docs.deepseek.com/api/create-chat-completion/).

## Collision and depth are separate

The old point-only occupancy accepted a Chapel-side foot position at world `1165.7,1608.6` whose foot footprint overlapped the wall. The screenshot uses controlled diagnostic placement, not a recording of a manual walking reproduction. The new footprint rejects that position and startup/debug recovery selects nearby clear ground (`1168.0,1634.0`). Ordinary movement never invokes recovery/teleportation.

`physics.js` provides one world-space 8×5 foot ellipse, exact polygon edge/corner distance checks and swept segment checks. Elliptical obstacles use a circumscribed 48-sided approximation (less than 0.22% inflation). Manual/touch/sprint movement, navigation nodes and edges, first/final connectors, arrival snaps and recovery share this model. Two-unit substeps and deterministic manual wall sliding remain. A disconnected nearest goal can use a reachable safe nearby node. All ten entrance routes pass footprint checks on every simulated frame.

Ground solids, clickable regions and visual occluders remain separate. Fitzpatrick's raised connector and the library passage stay open. Added narrowly targeted bases for two Chapel planters and a student-life tree; original art, avatar size, entrances and building IDs are unchanged.

The old global color mask covered the avatar's head while it stood **in front** of the student-life planter at world `1098.4,2177.2`. The paired screenshots use the same position and camera. Local cropped masks now use foot depth; color extraction is limited to authored canopy polygons. Walls are opaque. Sloping building fronts use the local facade baseline at the avatar's x-coordinate. Canopies and trunks have separate masks; entrance markers stay below the avatar and labels above the scene.

## Visual evidence and developer controls

| Case | Evidence |
| --- | --- |
| Planter, same position/camera | [Before](collision-planter-before.png), [after](collision-planter-after.png) |
| Chapel invalid wall position → nearby recovery | [Before](collision-chapel-before.png), [after](collision-chapel-after.png) |
| Chapel front steps remain visible | [After](collision-chapel-steps-after.png) |
| Fitzpatrick underpass → front, real browser route | [Under connector](collision-fitzpatrick-after.png), [emerged in front](collision-fitzpatrick-front-after.png) |
| Library passage → front, real browser route | [Passage](collision-library-passage-after.png), [front](collision-library-front-after.png) |
| Ask Map count | [Desktop](ask-map-merged-count.png) |
| Responsive building dialog | [390×844](merged-dialog-mobile.png), [844×390](merged-dialog-landscape.png) |

Open `/campus-explorer/index.html?debug=1` for opt-in controls. Choose a probe and Place character (recovers blocked points), or Walk to probe (normal route planner). Toggle Show geometry for the foot ellipse/anchor, solids, route and occlusion boundaries. This is absent in the regular embedded product UI.

## Preservation and verification

- Preserved the continuous autumn artwork, 54px avatar, camera/minimap, unnumbered readable labels, subtle selection/entrance markers, iframe lifecycle and strict message checks.
- Preserved all ten canonical building identities, aliases, database seeding/backfill work, mapping-status distinctions and official source links.
- Preserved combined chat/dialog suspension, input clearing, source actions and native dialog. Responsive dialog bounds fit 390×844 and 844×390 with no horizontal document overflow.
- `npm run test:map`: **22 passed**.
- Full suite via `node --import tsx --test tests/*.test.ts tests/*.test.mjs`: **75 passed, 2 PostgreSQL tests skipped, 0 failed** (77 total). This is the guide's equivalent test runner; both TypeScript and map JavaScript tests execute.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: **passed**.
- Tests cover thin obstacles, edges/corners, narrow passages, manual/diagonal/sprint/touch under long frames, safe route endpoints, disconnected goal selection, all ten entrances, suspension and camera/DPR-independent depth.

Limits: no disposable PostgreSQL database was available, so migration/backfill integration remains unverified against a running database. No live DeepSeek smoke test was possible. Browser inspection covers the listed positions/routes, not every pixel of the flattened illustration. Sustained manual keyboard, sprint and touch collision checks were simulated in the runtime tests, not verified on physical devices. Local canopy masks are a targeted correction, not a complete per-object depth atlas of every tree/furnishing.
