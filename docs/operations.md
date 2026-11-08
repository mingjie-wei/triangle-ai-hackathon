# Setup and release operations

Duke Valley runs from the repository root as a Next.js application. Use Node.js 22+ and the committed lockfile.

## Local setup

```sh
npm ci
cp .env.example .env
npm run dev
```

Preserve an existing `.env`. Open [localhost:3000](http://localhost:3000).

The default `DATA_MODE=fixture` uses a saved snapshot with a fixed November 6, 2026, 10 PM Eastern clock. It needs no database. Find events works without AI credentials; Explore with AI needs the model settings below. Live mode requires PostgreSQL and never falls back to fixtures.

## Configuration

Keep secrets server-side. [.env.example](../.env.example) lists the variables and safe defaults.

| Variable | Use |
| --- | --- |
| `DATA_MODE` | `fixture` or `live` |
| `DATABASE_URL` | PostgreSQL connection for live discovery, seed, and sync |
| `DATABASE_MIGRATION_URL` | Optional direct connection to the same database for migrations |
| `CHAT_MODEL_ENABLED` | Set to `true` to enable model calls |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | Provider key and an available model ID |
| `CHAT_RATE_LIMIT_URL`, `CHAT_RATE_LIMIT_TOKEN` | Shared Redis REST limiter; required for production-mode model calls, including Preview and `npm start` |
| `CHAT_MODEL_REQUESTS_PER_MINUTE` | Shared model limit, default `20`, range `1`–`100` |
| `STALE_AFTER_HOURS` | Index freshness threshold, default `24` |
| `SYNC_SECRET` | Optional Bearer secret for `POST /api/admin/sync`; unset disables the endpoint |

Restart local processes after configuration changes. Configure Preview and Production variables separately and redeploy to apply hosted changes.

## Live database and refresh

Initialize the intended PostgreSQL database (for example Neon) explicitly:

```sh
npm run db:migrate
npm run db:seed
npm run sync:duke
```

Verify connection targets first. Migration uses `DATABASE_MIGRATION_URL` when set; seed and sync use `DATABASE_URL`, regardless of data mode. Use a separate development database for testing. Set `DATA_MODE=live` to serve the imported events.

Run `npm run sync:duke` to refresh the index. There is no configured automatic schedule. Check the last successful import and freshness indicator. Builds do not migrate, seed, or sync.

## Deployment and release checks

Use Vercel’s Next.js preset with the repository root, `npm ci`, and `npm run build`. Preserve the existing `vercel.json`, API routes, public asset URLs, and migrations.

Before release:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs these checks on pull requests and pushes to main in fixture mode. Map tests are included in `npm test`; run `npm run test:map` for map-only checks. Two database tests are skipped unless `TEST_DATABASE_URL` is exported for a disposable database. Never use production for those tests.

On the deployed preview, check event loading/filtering, building details, Aura’s two modes, Alex’s recommendation, follow-ups, source links, both map buttons, and mobile layout. `/api/health` checks process readiness only; test the actual flows to verify database, model, and Redis access.

The public experience is [Duke Valley](https://duke-valley.vercel.app/). No repository license has been selected; maintainer confirmation of code/artwork reuse terms remains outstanding.
