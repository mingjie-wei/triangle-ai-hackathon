# Around Duke

A Next.js / React / TypeScript campus event explorer: select a place, filter upcoming and ongoing events, and open the official Duke listing. The illustration is intentionally replaceable and is **not walking navigation**. Independent student project; not affiliated with Duke University.

## Run the demo

Use Node.js 22 LTS or newer (tested here with Node 25.7). From this directory:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:3000. `.env.example` explicitly selects `DATA_MODE=fixture`. Demo mode uses a sanitized real Duke feed snapshot fetched November 6, 2026, with contact information removed. Its discovery clock is fixed at November 6, 10 PM Eastern; event dates are never shifted to pretend they are current. The demo badge remains visible. Live mode never falls back to fixtures.

## Set up the live database

Create **one** hosted PostgreSQL database (for example Neon). Copy its provider-issued pooled URL to `DATABASE_URL` in local `.env`; retain provider TLS parameters. If the provider needs a direct migration connection, set `DATABASE_MIGRATION_URL` too. Never paste credentials into chat or commit them. For Supabase transaction pooling, prepared statements are disabled in the driver.

```sh
npm run db:migrate
npm run db:seed
npm run sync:duke
```

Then set `DATA_MODE=live` in `.env` and run `npm run dev`. Migration is explicit, never performed at build time or on a request. The idempotent seed configures six reviewed places, room aliases, and illustrative normalized positions. Runtime uses Drizzle with postgres.js, a small pool, connection timeout, and idle expiry. Separate preview/test databases from production.

No database account has been provisioned by this project. Hosted database validation is pending credentials. Do not claim the fixture preview verifies a live database import.

## Deploy to Vercel

1. Create a Vercel account and the PostgreSQL database above. Push this repository to your Git provider, then import it into Vercel as a **Next.js** project. Use repository root, `npm ci`, and `npm run build` with Node 22 or newer.
2. Set server environment variables in Vercel: `DATA_MODE=live`, provider pooled `DATABASE_URL`, and optionally `STALE_AFTER_HOURS=24`. No `NEXT_PUBLIC_` secrets. To deploy a clearly labeled demo first, set only `DATA_MODE=fixture`.
3. Run migrations, seed, and import explicitly from your machine against the intended production database before enabling live discovery. The direct migration URL is only needed locally, not by the frontend.
4. Deploy. Vercel assigns the actual `*.vercel.app` URL. No site has yet been deployed and this repository does not claim a deployment URL.
5. Smoke-check `/api/health`, `/api/locations`, the main page, a building selection, its event source link, and a deliberately empty filter. Confirm live metadata and latest successful sync.

Alternatively, after logging into Vercel CLI, run `npx vercel` for a preview and `npx vercel --prod` for production. Configure environment variables in the Vercel dashboard first. This repo has no linked Vercel project or credentials.

Manual `npm run sync:duke` is sufficient for this milestone. If enabling `POST /api/admin/sync`, set a long random `SYNC_SECRET` on the server and send it as a Bearer token. It is disabled without that secret. It has a 60-second function limit; larger feeds should be imported with the CLI. No unauthenticated GET scheduler route or cron schedule is installed. Confirm your Vercel plan's scheduling frequency before adding cron; do not assume frequent runs are included.

## Source, freshness, and known coverage limits

- Fixed upstream URL: `https://calendar.duke.edu/events/index.json?future_days=30&feed_type=simple`.
- All returned records are considered; no six-building ingestion restriction. The checked snapshot contained 448 records, no repeated exact source IDs, and 14 equal start/end entries. These are observations, never test constants.
- Null location, literal `None`, unknown categories, online venues, and unresolved places remain discoverable in **All campus events**. Original room labels are preserved. The location inventory is grouped by deterministic focus + normalized label (or label/link), sorted by occurrence count and distinct titles.
- Exact `maps.duke.edu` host only; focus values are strings, including alphanumeric area IDs. Reviewed reference mappings precede exact normalized aliases. Conflicts remain unresolved. Bryan Center uses two observed theater aliases; its theater focus is not broadly merged. Change `config/places.ts`, run the seed, and reimport to update reviewed mappings.
- Overall schema validation happens before event mutations. Individual invalid records are counted; if any are rejected, the entire import is refused and the prior index is retained. No partial refresh is labeled successful. Transaction-scoped advisory locking prevents overlapping mutation phases. Fetches use timeouts and bounded retry/backoff.
- Occurrence identity is `(source, source_event_id, starts_at)`. Unchanged imports upsert rather than duplicate. A single known occurrence plus a single incoming occurrence preserves its UUID on reschedule; multiple occurrences never collapse by title. This relies on the source maintaining stable IDs; ambiguous recurring schedule changes require review. Absent records are retained, because completeness is unverified. Explicit cancellations are hidden.
- Equal start/end indicates no source duration: timed entries use missing-end eligibility; all-day entries use the next local midnight. True inverted intervals are rejected. Supplied positive all-day intervals are preserved: the feed contains non-midnight values, and a universal exclusive-end convention could not be verified. No fabricated duration or rounded supplied time is shown.
- Store UTC instants; display America/New_York. Calendar-day filters honor 23/25-hour DST days. Ongoing intervals overlap the selected window; timed events with no end must start inside it. Map counts and lists share the same eligibility function and `as_of` instant.
- The database is a working index, not an authoritative archive. A failed import preserves last-success metadata and prior data, with a stale indicator after a configurable interval. Records carry `lastSeenAt`; missing records are not automatically deleted. A retention/removal policy is deferred until coverage can be established.
- Duke's API catalog and feed builder/help do not establish a verified pagination or completeness contract for this response. No speculative pagination parameters are used. UI/API explicitly warn that coverage is unverified.
- Duke recommends live feeds and discourages copied/cached data. **Before public live rollout, confirm this synchronized-index approach and refresh interval with Duke's calendar maintainers.** This remains an external rollout dependency, not a claim of approval. Official links remain authoritative.

## API

`GET /api/health` is process readiness, not a database health guarantee. Discovery endpoints:

- `GET /api/locations`
- `GET /api/locations/:uuid/events`
- `GET /api/events`
- `GET /api/events/:uuid`

List queries accept `as_of`, `start`, `end` (ISO timestamps), `day` (New York date), `category`, `q` (max 200), `food=true`, `limit` (1–100), and `cursor`. Date overrides the explicit window; default is now through 30 local-calendar days. Windows cap at 32 days. Pagination sorts by start then UUID. Responses use `{data,meta}`; errors use `{error:{code,message}}`. Invalid requests return 400; unknown IDs 404; configuration/database failures 503, never successful empty results. Event detail is retrievable outside the discovery window and exposes source status. `?place=brodhead-center` opens a place directly.

Category mappings are explicit in `src/lib/domain.ts`; events can match multiple groups. Food is independent and only indicated by the source tag. Source descriptions are stripped to plain text and rendered by React; only http/https links are retained. No frontend database credentials or Duke fetches.

## Commands and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run inventory:duke
# Or inspect a saved source response without network access:
npm run inventory:duke -- /absolute/path/feed.json
```

Unit tests cover malformed/null source fields, safe URLs/focus IDs, mapping conflicts, room aliases, time overlaps, missing ends, all-day boundaries, DST, category/food rules, stable pagination, singleton reschedules versus recurrence, and shared map/list counts. Browser validation covers building selection and details, source link, and empty state. Live PostgreSQL migration/upsert/lock behavior and Vercel deployment require external setup and must be verified there. Set `TEST_DATABASE_URL` to a dedicated disposable PostgreSQL database before `npm test` to enable the integration test; it applies migrations and rolls back its event writes. Without it, that test is explicitly skipped. The checked location inventory is in `reports/duke-location-inventory.json` (165 observed combinations).

## Project structure

- `src/components`: replaceable CampusMap, LocationList, EventFilters, PlacePanel, EventCard, FeedStatus.
- `src/app/api`: thin same-origin Route Handlers using Node runtime.
- `src/server/services`: shared retrieval; `src/server/sources`: validated Duke adapter; `src/server/sync`: transactional imports.
- `src/server/db`: portable Drizzle schema and pooled client; `drizzle`: versioned SQL migrations.
- `config/places.ts`: reviewed mapping and illustrative positions.
- `tests/fixtures`: sanitized real snapshot used only in explicit demo mode.

Ask Map is intentionally deferred until the live Phase 1 acceptance checks pass. No accounts, social graph, geocoding, or separate backend are included.

## Documentation checked

[Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs), [connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions), [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Duke API catalog](https://api-catalog.oit.duke.edu/apis/6), [Duke feed builder](https://urlbuilder.calendar.duke.edu/), and [Duke calendar guidance](https://calendar.duke.edu/help).
