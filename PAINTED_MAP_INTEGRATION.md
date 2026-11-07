# Painted campus integration

Historical integration report. The subsequent [UI and building registry revision](reports/building-mapping-audit.md) supersedes its six-building mapping status and selection outline.

Integrated the supplied `Cyber_Duke_Integrated_Project.zip` selectively on `codex/ask-map-integration`, starting from `89ba91c`. The guide's archived baseline commit is not present locally, so ancestry could not be verified; files were compared directly. No push or deployment was performed.

## Changes

- `public/campus-explorer/`: supplied artwork, geographic records, painted hit/collision geometry, 54px avatar and Canvas runtime. English controls and status messages; no north/GPS claim. The minimap toggles overview. It does not support click-to-pan.
- `src/components/CampusMap.tsx`, `src/lib/campus-bridge.ts`, `src/lib/campus-session.ts`: same-origin iframe adapter with source/origin/version/slug validation. Every readiness handshake sends current pause and selection. Historical walk requests are consumed, never replayed. Startup has a configurable 20-second deadline, a status message and Retry map.
- `Explorer.tsx`, `AskMap.tsx`, `BuildingDialog.tsx`: host-owned event dialog and chat suspend the map. “Walk there on the map” closes the building dialog and issues a new walk command. Existing event mappings, visual-only pending states, query filters and source actions remain intact.
- `src/app/globals.css`, embedded styles: integrated frame sizing, error overlay and portrait/landscape control placement. Required base artwork and avatar load before optional textures/detail tiles. Optional failure retains working base geometry and navigation.
- Tests cover host lifecycle, bridge validation, embedded interactions and entrance reachability. `package.json` includes the `.mjs` map tests. ESLint excludes the supplied standalone static bundle; its JavaScript is syntax-checked and exercised by the VM tests.

Pause deliberately cancels routes and held input. Closing an overlay does not restart a prior route. Blur, hidden document, pointer cancel and lost capture also clear input. A new movement action resumes exploration. Reduced-motion preference removes camera easing; display density is capped at 2.

The backend, API contracts, database schema, model provider, environment files and dependency versions were not changed.

## Validation on November 7, 2026

- Type checking, ESLint and production build passed.
- `node --import tsx --test tests/*.test.ts tests/*.test.mjs`: 55 passed, 1 database integration test skipped. No disposable database was supplied.
- Static runtime passed `node --check`. Tests exercise all ten entrance routes, asserting walkable positions throughout, repeated ready while selected/paused, timeout/retry, stale walk suppression, foreign messages, pointer cancellation, D-pad capture, blur and visibility changes.
- Browser host flow: Fitzpatrick deep link opened its three fixture events; Walk moved the avatar; Ask Map paused it and cleared the route. Chapel query returned 45 matches and eight grounded source cards; Locate selected/focused Chapel. Clicking Chapel artwork opened the correct host dialog. Escape restored iframe focus. Overview toggled successfully.
- Desktop 1440×900, portrait 390×844 and landscape 844×390 were visually inspected. Landscape and desktop had no horizontal body overflow. Host toolbar, zoom, D-pad and minimap were checked together; landscape banner overlap was corrected. Screenshots are saved under `reports/painted-map-*.png`.
- Temporarily removing the required base image produced the bounded error/retry UI while the building event dialog remained available. Restoring the image and clicking Retry map recovered selection. Removing one optional detail tile retained a usable base map; overview and dialog close worked. All files were restored afterward.

## Limits and remaining checks

Browser checks used the saved November 6 fixture and retrieval-only chat, not live PostgreSQL or model calls. Repeated iframe readiness is regression-tested; an independent in-place iframe reload with two simultaneous overlays was not manually exercised. Physical touch devices, Canvas-disabled browsers, exhaustive filter/pagination UI combinations and every building's painted click target still need a manual device pass. Existing backend/filter tests passed.

The requested controlled cold-load/phone-memory baseline was not captured before integration. Local phone-sized observations after integration reported 58–82 ms to base readiness, but cache and host hardware were uncontrolled, so these are not cold-load or phone-performance claims. The supplied assets total 21,673,973 bytes (~20.7 MiB). Each source PNG decodes to about 6 MiB RGBA; the composed detail canvas alone is about 24 MiB, with additional masks, temporary canvases and browser overhead. Actual peak memory and slow-network performance remain unmeasured.

During browser testing an unattributed MutationObserver error was logged once, alongside the expected intentionally induced missing-image error. No source location was attached to the observer error; its cause was not established. It did not prevent the validated flows. Do not interpret this run as a clean-console certification.
