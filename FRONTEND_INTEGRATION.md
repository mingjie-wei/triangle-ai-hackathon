## Continuous West Campus implementation

The user supplied Cyber_Duke_Building_Backup_v1.zip and authorized vector ground/paths with the original pixel-art buildings. All ten original PNGs are copied unchanged to public/buildings. The popup was implemented first and now uses the selected building's individual sprite.

- src/lib/campus-world.ts owns the stable West Campus ID, dimensions, sprite sizes/anchors, stacking, label anchors and reviewed relative positions. The renderer and interactive minimap use the same placements and camera geometry. No East Campus selector is shown.
- Removed district switching and the separate overview dialog. A shared camera persists across building selections and dialog open/close. Fit campus uses configured dimensions. Keyboard arrows/Home and a keyboard-accessible minimap provide camera control.
- Preserved the reviewed landmarks.map layout rather than claiming a georeferenced walking map. Inspected supplied official target metadata and connection rules; no raw ADA routes, entrances, OSM library subdivisions or spawn proposals are imported into the application. No navigability, accessibility route or north-direction claim is made.
- Library connections are schematic vector masses beneath the sprites: Perkins–Rubenstein adjoining, Bostock–Perkins raised connector with an opening. Fitzpatrick's supplied sprite includes its bridge; TEC remains one building for Co-Lab. Wilkinson–TEC and student buildings connect by outdoor paths. These independent artworks have approximate seams; they are not a precise architectural reconstruction.
- No backend IDs, event aliases, API contracts, database records or dependencies changed. Building count/mapping status continues to derive from existing presentation/API merging.
- Supplied source asset manifest and connection rules are preserved under docs/art. Building art is supplied generated artwork, not relabeled as OSM data. The unused raw geodata stays in the source ZIP.
- Mobile overview suppresses secondary building names, retaining numbered labels corresponding to navigation; names appear for the selected building or closer zoom. Map hit areas have at least 44 CSS-pixel height; full building names remain accessible. Decorative trees are vector shapes.

Verification: typecheck, lint, production build and test suite pass (24 tests passed, one PostgreSQL integration test skipped without credentials). Camera tests include custom-world bounds, fit and minimap geometry; placement tests verify unique stable slugs, asset existence and bounds. Browser testing verifies building drag pans without opening a dialog, a subsequent tap opens the popup, and closing retains the identical camera transform. Popup states/filtering/pagination and four-size responsive checks from the preceding phase remain applicable. Physical touch/OS pointer cancellation and live database operation remain unverified. Desktop and phone screenshots are in reports/continuous-map-*.png and reports/building-modal-*.png.

---

## Prior implementation history

## November 7 follow-up: modal implemented, continuous artwork pending

The new continuous-map guide is partially implemented. The user is supplying the original continuous-map source/assets. The ZIP contains four independent scene plates, not transparent sprites or a continuous world. Do not tile those plates or treat the reference screenshot as functional artwork. District rendering remains temporarily; the continuous world, placement adapter, and live minimap remain outstanding.

Completed in this follow-up:
- One native building/event dialog replaces the persistent details panel. Desktop uses about/events columns; phone layout prioritizes events, with compact imagery below. One scrolling body keeps the close and footer actions reachable.
- Native inert background plus explicit Tab boundary handling, initial close-button focus, Escape, focus restoration, and Back to exploring. Event details stay in the same dialog.
- Closing retains selection, URL, camera and loaded results. Locate on map closes and triggers local reveal. Valid deep links open the dialog; initial visits without a place begin with the map.
- Active event filters are summarized with an explicit clear action. All-campus discovery, real event cards, pending mapping, errors/retry and pagination reuse the existing request owner.
- Camera math accepts configured world dimensions. Pure world-viewport and center-point helpers are ready for the eventual minimap; the existing scene renderer still uses its default dimensions. No API/database/schema/dependency changes.

Validation: typecheck, lint and production build pass. Node test suite: 23 passed, one PostgreSQL integration test skipped (no database credentials). Added custom-world fit/center/minimap geometry coverage. Browser checked at 1440×900, 1024×768, 390×844 and 844×390: no horizontal dialog overflow; long event detail scrolls; close remains reachable. Verified Tab wrap, Escape, repeated selection, pending mapping, empty search, filter clearing, all-campus mode and pagination from 40 to 80 cards. Saved desktop/mobile modal screenshots in reports/building-modal-{desktop,mobile}.png. Existing error/retry and stale-request logic retained; fault injection and reduced-motion emulation were not exercised in this follow-up. Fixture checks do not certify live data. Continuous-world interaction testing awaits assets.

---

## Previous iteration notes (historical)

# Autumn pixel frontend integration

This branch replaces the illustration and page shell with the approved autumn pixel direction while keeping the existing Next.js route handlers, data adapter, schema, filters, event identities, pagination and error contract.

## Run with the existing backend

```sh
npm ci
cp .env.example .env
npm run dev
```

The supplied example selects `DATA_MODE=fixture`: the original sanitized November 6 snapshot and fixed discovery clock remain clearly labeled in the UI. It is a backend-served fixture, not a new hardcoded frontend event array. No event dates are changed. With your existing configured PostgreSQL instance, follow the repository's migration/seed/sync instructions and use `DATA_MODE=live`; the same frontend requests continue to work. No database was created, migrated or accessed by this change, and live database verification remains pending.

## API connections preserved

- `/api/locations` supplies configured places and filter-consistent event counts.
- `/api/events` supplies all-campus results.
- `/api/locations/:uuid/events` supplies a selected configured building.
- Event details use the returned record and retain the official source URL.
- Query, category, Eastern-time date, food tag, as-of and cursor parameters are unchanged.
- Request cancellation prevents stale selections or filters from replacing current results. Configuration failures still produce error UI rather than successful empty results.

## Ten visual landmarks vs six backend-configured places

Existing configured places: Chapel, Fitzpatrick, Rubenstein Library, Bryan, Brodhead and Bostock. The UI additionally shows Penn, Wilkinson, Perkins and Co-Lab/TEC as `visual:` entries. They are not fabricated backend UUIDs: selecting one does not request a nonexistent place-events route, does not invent event counts, and displays an explicit mapping-pending message. When a matching backend slug is added later, the real record automatically replaces the visual-only entry.

Do not add broad feed aliases just to make counts look full. Extend reviewed mappings in `config/places.ts`, then seed/import intentionally according to the backend documentation. The same frontend supports additional backend places outside the initial ten.

## What changed

- `src/components/Explorer.tsx`: functional parchment sidebar and real event/API state, separate building search, scene navigation, panel open/close and deep links.
- `src/components/CampusMap.tsx`: four generated scene plates, real DOM selection targets and labels, zoom/drag, location overview dialog with Escape/focus handling. Text, filters and controls are not baked into an image.
- `src/components/PlacePanel.tsx`: building introduction, event cards/detail, loading/empty/error/pending states.
- `src/app/globals.css`: autumn pixel UI, responsive mobile navigation and bottom details panel, reduced-motion handling.
- `src/lib/presentation.ts`: local presentation metadata; does not change backend place IDs, aliases or ingestion.
- `public/scenes/*.webp`: four integrated autumn environment illustrations.
- `tests/presentation.test.ts`: verifies backend records/counts stay intact and unmapped landmarks are not mistaken for empty configured places.

Illustrations show characteristic buildings and connection topology, including the library group and Fitzpatrick bridge. Scene hotspot coordinates are artistic presentation positions, not GIS or walking navigation. The compact overview is a relative location reference, not a precise minimap tied to a moving player. No character movement, collision, interior, chat, account, live AI guide or simulated live activity feed is claimed.

## Interaction refinement — November 7, 2026

Integrated the supplied `files/` source bundle once into the clean MVP checkout on `main`; did not apply its patch a second time. Backend, source mappings, dependencies and package lock are unchanged.

- Camera geometry lives in `src/lib/map-camera.ts`, with a centered CSS-pixel origin: screen = visible center + pan + scale × (world point − world center). Art and anchors use one uniform transform. Reset contains the whole 1536 × 1024 scene; zoom is bounded from 1× to 3× overview scale. Smaller dimensions stay centered. Labels counter-scale to remain readable with at least 44 CSS-pixel targets. Compact mobile labels for Wilkinson and Co-Lab avoid overlap; accessible names and full panel titles remain unchanged.
- `useMapCamera` owns pointer IDs, the 6px threshold, capture, cancellation, normalized pan and keyboard controls. Deltas are incremental, so dragging beyond an edge does not create an overshoot dead zone. A pointer drag suppresses its click; keyboard button clicks still work. A second touch cancels a single-pointer gesture. Scene-keyed camera instances and cancelled animation frames prevent old-scene resets.
- The gesture surface excludes navigation and other fixed controls. Desktop reserves a details column; portrait mobile reserves a bottom panel; landscape has a compact sidebar and separate details column. Resize preserves the visible-center world point where bounds allow, then minimally reveals the selected landmark. Detail/sidebar scrolling is separate from map gestures.
- Arrow keys pan only when the map surface itself has focus; Home resets. E opens details outside editable fields, links, buttons and dialogs, with modified shortcuts ignored. Keyboard focus reveals a hotspot. The location overview traps focus and supports Escape.
- Repeated selection reopens details and reveals the landmark while preserving the loaded list and making no new request. Filter chips no longer enter loading when reselected without a query change. The hotspot is one accessible button; the former nested clickable “View details” span is removed.
- All four scenes remain separate compositions. Dragging never navigates between scenes or fetches event data. Visual-only landmarks remain mapping-pending and never request a `visual:` place-events endpoint.

## Verification for this refinement

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass. Test result: 22 passed, 1 PostgreSQL integration test skipped. The initial sandboxed `npm test` could not create its tsx IPC socket; the approved run outside the sandbox passed.

- Camera tests cover overview containment at desktop/portrait/landscape sizes, center-preserving zoom and resize, stored bounds, minimal landmark reveal, pointer jitter/threshold and immediate reversal at a clamped edge. Presentation and existing event/API tests remain in the suite.
- Browser checks used the existing fixture-mode Next.js server at 1440×900, 1024×768, 390×844 and 844×390. Inspected all four districts; verified repeated selection, sidebar selection revealing a zoomed-offscreen landmark, map Home/arrow controls, E shortcut/input protection, panel open/close resize, and mapping-pending Perkins.
- Temporary browser-console instrumentation around completed fetch calls verified a normal configured-place selection issues the locations and place-events requests, while repeated selection/zoom/label drag did not add requests. A drag starting on unselected Brodhead retained Bryan selection and the URL (request count stayed 11); a subsequent tap selected Brodhead. Perkins requested locations only, with no visual-ID event request. Instrumentation was removed after inspection. No browser console errors were observed.
- Screenshots: `reports/map-desktop-overview.png`, `reports/map-desktop-zoom.png`, `reports/map-mobile-overview.png`, `reports/map-mobile-zoom.png`.
- Physical multi-touch/pen, OS-triggered pointer cancellation, and interruption during an active captured drag were not exercisable with this browser-control interface. Cancellation/release paths are implemented but need a real-device follow-up. Mobile checks used responsive viewport emulation and mouse input, not physical touch. API error behavior is covered by existing HTTP tests; a browser network outage was not injected.
- PostgreSQL integration remains skipped without `TEST_DATABASE_URL`; fixture success does not verify live imports or deployment. No commit, push or deployment was performed.
