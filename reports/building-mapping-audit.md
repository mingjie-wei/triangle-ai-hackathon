# Ten-building mapping audit — November 7, 2026

All ten illustrated destinations now have canonical registry UUIDs and explicitly reviewed event mappings. This is a code/fixture result, **not a deployed database claim**. Neither `DATABASE_URL` nor `TEST_DATABASE_URL` was configured. Docker was installed but its daemon was unavailable. No database, migration, seed or sync write was run.

## Canonical registry

IDs below are the configured defaults; a database row already present under the same slug retains its existing UUID during seed and sync. Existing six IDs were retained. Four new IDs were allocated only after checking the current registry; no live rows were available to inspect.

| Building / slug | Configured UUID | Reviewed match | Eligible saved-feed events |
| --- | --- | --- | ---: |
| Duke Chapel / `duke-chapel` | `00000000-0000-4000-8000-000000000001` | reference 290, exact Chapel alias | 45 |
| Bryan Center / `bryan-center` | `00000000-0000-4000-8000-000000000004` | two exact theater aliases; no broad reference assignment | 9 |
| Penn Pavilion / `penn-pavilion` | `00000000-0000-4000-8000-000000000007` | reference 331, exact pavilion alias | 1 |
| Fitzpatrick Center / `fitzpatrick-center` | `00000000-0000-4000-8000-000000000002` | reference 98 | 3 |
| Wilkinson Engineering / `wilkinson-building` | `00000000-0000-4000-8000-000000000008` | reference 366, four exact room aliases | 7 |
| Perkins Library / `perkins-library` | `00000000-0000-4000-8000-000000000009` | reference 392, exact Link Classroom 2 alias | 1 |
| Bostock Library / `bostock-library` | `00000000-0000-4000-8000-000000000006` | reference 399, exact library alias | 3 |
| Rubenstein Library / `rubenstein-library` | `00000000-0000-4000-8000-000000000003` | reference 1872 | 8 |
| Innovation Co-Lab / TEC / `innovation-co-lab` | `00000000-0000-4000-8000-000000000010` | reference 206, two exact TEC/Telecommunications aliases | 3 |
| Brodhead Center / `brodhead-center` | `00000000-0000-4000-8000-000000000005` | reference 35 | 2 |

Counts are observations for the saved November 6 feed and its fixed discovery clock, not invariants or today's live schedule. All-campus eligibility remains 407; twelve existing fixture events formerly unresolved now resolve to the four additional buildings. No events were added or changed. Fixture event UUID generation and fixture order are unchanged.

## Evidence

The [official Duke JSON feed](https://calendar.duke.edu/events/index.json?future_days=30&feed_type=simple) was fetched successfully on November 7, 2026. Exact observed source labels, references, links and aliases for every canonical building are recorded in [building-mapping-audit.json](building-mapping-audit.json). The existing [location inventory](duke-location-inventory.json) and saved fixture were also compared. The freshly fetched raw feed was kept in a temporary file, not committed or substituted for the sanitized demo fixture.

- Penn: the current feed pairs the pavilion label with [focus 331](https://maps.duke.edu/?focus=331).
- Perkins: the current feed pairs the Link Classroom 2 location with [focus 392](https://maps.duke.edu/?focus=392).
- Wilkinson: [this official Duke event](https://calendar.duke.edu/show?fq=id%3ACAL-8a00ec8b-979413b9-0199-52ccdab4-00005817demobedework%40mysite.edu) explicitly provides directions using focus 366. Current/saved feed locations identify rooms 017, 132, 419 and 021 in Wilkinson. Only those exact observed spellings were added as aliases; no generic engineering substring rule was added.
- TEC: the current feed pairs the TEC location with focus 206. The [official 2023 Co-Lab event](https://calendar.duke.edu/show?fq=id%3ACAL-8a0290b4-860465b2-0186-796b9057-00004267demobedework%40mysite.edu) links its Telecommunications Building location to the same reference. [Duke OIT's TEC page](https://oit.duke.edu/service/technology-engagement-center/) confirms the Co-Lab/TEC relationship within that building. Generic Co-Lab mentions and other campuses are not aliases.
- The original six mappings were rechecked against exact current feed locations. Bryan remains alias-based; theater focus 1879 is not generalized to the entire building. No new interpretation of that reference was introduced.

The maps site's static HTML exposes only a JavaScript shell. A guessed focus URL alone was not accepted as proof; the explicit official calendar associations above supplied verification.

## Identity, reconciliation and truthful states

`seedPlaces` runs inside a transaction and takes the same advisory lock used by sync. It checks configured IDs against existing slugs, reuses a persisted slug's ID, rejects IDs owned by a different slug, and upserts placements/aliases using that persisted identity. It backfills Duke source-location mappings without rewriting events or event IDs. Sync translates config resolver IDs to persisted slug identities too, avoiding a later foreign-key failure when an existing row has a different UUID. Seeding must precede syncing a new database.

The shared resolver remains config-based for both fixture and live input. Only reviewed entries participate. Exact reference/alias disagreement remains unresolved/conflicting. Fixture places propagate their explicit review status; seed writes it explicitly instead of relying on the schema default. Pending mapping, empty filtered events and failed event retrieval have separate UI paths. All ten places are enumerated even when filtering yields zero events; known empty places return 200, while unknown UUIDs remain 404.

## Validation and limitations

Automated: 61 tests passed, 2 PostgreSQL tests skipped; typecheck, lint, production build and static runtime syntax check passed. Added tests cover ten unique stable UUIDs; exact mappings/conflicts; canonical chat actions; known-empty API results; pending status; selection clearing; non-overlapping 15px label placement at DPR 1 and 2; and all ten collision-safe entrance routes. The added database test covers repeated seed, preserved existing slug IDs, source-location backfill and event foreign keys, but **has not been executed against PostgreSQL**.

Browser: desktop 1440×900 and phone portrait/landscape inspected. Chapel selected label replaces the dashed outline; All campus events clears it. Sidebar names compute to 17px and event titles to 20px on desktop. Penn Pavilion opens its real fixture event. Mobile event metadata and close/back actions remain accessible. Additional screenshots and final interaction checks accompany this audit.

Remaining deployment acceptance: run the two database tests with `TEST_DATABASE_URL` pointing at an empty disposable PostgreSQL database, then seed twice and sync the intended development database and compare IDs/counts. No production database was inspected. Physical-device testing and actual browser DPR switching remain unverified; DPR behavior is covered in the rendering tests. Mapping review does not establish complete event coverage or walking/GPS accuracy.

## Screenshots and final browser checks

Before: [map](painted-map-desktop.png), [event dialog](building-modal-desktop.png).
After: [desktop map](revision-map-desktop.png), [desktop events](revision-events-desktop.png), [portrait map](revision-map-mobile.png), [portrait events](revision-events-mobile.png), [landscape map](revision-map-landscape.png).

The final browser pass also verified Penn Pavilion's Ask Map query returns its fixture source, and Locate sets `penn-pavilion` with one selected label. Near-edge selection stays visible in portrait and landscape. Escape closes the native building dialog. Label placement reserves the map HUD and host controls; low-space overview labels can be omitted while selected/hovered labels get priority rather than shrinking the font. Keyboard action hints are 14px desktop and 13px portrait. No navigation geometry or source assets were edited.
