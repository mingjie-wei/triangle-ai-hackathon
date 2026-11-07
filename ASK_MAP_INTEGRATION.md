# Ask Map integration

Ask Map runs inside the existing Next.js application. Open the floating blue launcher, ask a question, then follow an official source, locate its mapped building, or open the existing building popup. No Python server or SQLite file participates in the integrated path.

## Git handoff

Starting checkout: 4cd4fd9, with uncommitted continuous-map work. With user approval, created codex/ask-map-integration and checkpoint 26ab045. Fetched origin/main at c15fad5; verified its changes were only nine added chatbox files. Merge 6a97b86 preserves both histories without conflicts. The standalone prototype remains under chatbox as a reference. Its sample records, placeholder links, styles and local IDs are not imported. No branch was published or merged into local main.

## Contract and architecture

- src/lib/chat-contract.ts: strict request validation and shared response types. Questions are 1–1000 characters, history at most six bounded user/assistant entries, previous event IDs at most eight UUIDs. Request bodies are bounded to 20 KB even without Content-Length.
- src/app/api/chat/route.ts and src/server/chat/handler.ts: Node POST route with no-store responses and stable INVALID_REQUEST, DATA_UNAVAILABLE and RATE_LIMITED errors.
- src/server/chat/retrieve.ts: calls the existing search service directly in fixture/live mode. Keeps existing eligibility, stable IDs, categories, source links and metadata. Explicit building names override selected context. Campus-wide is the default, even when a map building is selected.
- src/server/chat/answer.ts: optional Claude extractive selection with server-built actions, strict citation/title validation, bounded 8-second provider timeout, bounded output and factual retrieval fallback.
- src/components/AskMap.tsx: React transcript, starters, scope, opt-in filters, sources, pending/error/retry state and typed callbacks. One request in flight; retry replaces the failed turn, closing does not cancel/duplicate it, unmount aborts. No browser or database persistence.
- Explorer wiring reuses choose/reveal and the building dialog. Locate collapses chat and focuses the map. Building details closes chat before opening the existing dialog. No geometry, mapping or event aliases changed.
- src/app/page.tsx supplies one server-created discovery clock to both Explorer and Ask Map, including when the index is unavailable. There is no clock drift between map and chat.

The response carries reply, up to eight sources, resolvedScope (place, interval, filters, total match count, notes), and existing metadata plus answerMode and clarification/fallback reason. Live data and model answer modes are independent.

## Supported questions and limitations

Examples:

- “What music events are coming up?”
- “What is happening at Duke Chapel?”
- “What events are happening this weekend?”
- “What events are tomorrow?”
- “Events on 2026-11-15”
- “Which of those are tomorrow?” refines only the immediately previous displayed event IDs, revalidated against eligible records.

Topics use small explicit synonyms (music/concert/recital, art/exhibit, AI/artificial intelligence, talks/seminars, workshops). Remaining keywords must all match a record group; the whole sentence is not passed to literal substring search. This is a constrained event finder, not a general-purpose campus assistant. Unsupported time/distance/access/audience constraints ask for clarification. Building history, opening hours and accessibility are not inferred. Place answers use existing reviewed name/kind only; visual-only buildings explicitly report pending mapping.

Today/tomorrow/weekends use America/New_York. Weekend is Saturday 00:00 through Monday 00:00; Sundays refer to the current weekend. Every request intersects the authoritative discovery window. Fixture clock is fixed at November 6, 2026, 10 PM Eastern; live clock is validated within 24 hours of server time. Past eligible portions and future out-of-window portions are clipped with an explanation. No distance search exists: “near the Chapel” means Chapel-related results.

Use current filters defaults off; opted-in filters are shown and intersected. Conflicting dates request clarification. Chat never silently edits map filters. Historical answers retain their request context; changing the scope selector affects only future requests. Follow-ups use validated IDs, not free-form history inference.

## Optional Claude and cost control

Retrieval-only mode requires no API key. Set server-only variables from .env.example:

- CHAT_MODEL_ENABLED=true
- DEEPSEEK_API_KEY
- DEEPSEEK_MODEL: an exact DeepSeek model ID available to the account (e.g. `deepseek-flash`); no prototype default is assumed.

The adapter checks GET /v1/models/{id} before POST /v1/messages. Uses native fetch, the documented 2023-06-01 version header and no SDK dependency. API reference: [Messages](https://platform.claude.com/docs/en/api/messages/create) and [Models](https://platform.claude.com/docs/en/api/models/list).

This first release deliberately allows the model (DeepSeek, `POST https://api.deepseek.com/chat/completions`) to select exact title extracts from at most eight retrieved records, not generate unverifiable practical advice. Unknown citations, duplicate citations, invented text, malformed JSON and provider failures fall back to retrieved facts. URLs/IDs/actions never come from model output. User questions and records are sent as untrusted data; no tool execution, secrets, arbitrary actions or conversation logging. Optional model calls send the question and bounded candidate records to DeepSeek; history is accepted for contract compatibility but not forwarded or persisted.

In production, model access fails closed to retrieval-only unless a shared Redis REST limiter is configured:

- CHAT_RATE_LIMIT_URL and CHAT_RATE_LIMIT_TOKEN (dedicated HTTPS Redis REST endpoint, e.g. Upstash)
- CHAT_MODEL_REQUESTS_PER_MINUTE (default 20, validated range 1–100)

An atomic EVAL increments a global minute bucket and sets expiry. Exceeded limits return RATE_LIMITED/429; missing/broken limiter returns factual retrieval fallback without calling DeepSeek. This is cross-instance model cost control, not per-user authentication or a daily spend budget. Use provider spend limits and hosting request protection before public rollout; retrieval/database abuse protection remains a hosting responsibility. Never expose these secrets with NEXT_PUBLIC_. No model key is needed for builds or tests.

## Verification

Typecheck, ESLint, production build and automated tests pass. Suite: 40 passed, one PostgreSQL integration test skipped without a test database. Sixteen chat tests cover strict input, Eastern DST intervals, real retrieval, explicit/context precedence, pending/unknown buildings, unsupported dates, filter conflict, follow-up ID revalidation, cancellations, unmapped sources, missing/failed providers, invalid generated claims/citations, valid model extracts, production limiter gating and route errors.

Browser verified at 1440×900 and 390×844: real music results, tomorrow follow-up, transcript retained after close/reopen, source Locate focusing the existing map, source Building details opening exactly one native dialog, Escape and Tab containment, mobile overflow and long source lists. Screenshots: reports/ask-map-desktop.png, ask-map-mobile.png and ask-map-source-action.png. Provider failures and database failures use deterministic tests; no live DeepSeek smoke test or live database check was run. Physical device keyboards/touch and hosting-level limits still require deployment testing.

Existing map camera, event filters, pagination and popup code remain intact. Integrated /api/chat compiles as a Next route. No account, vector database, schema migration, new ingestion pipeline or additional building coverage was introduced.

## Live DeepSeek test

Retrieval-only (default, no key): `DATA_MODE=fixture CHAT_MODEL_ENABLED=false npm run dev`.

Live model test (shell only; never commit keys):

```
export DEEPSEEK_API_KEY=...          # server-side only
export DEEPSEEK_MODEL=deepseek-flash # confirm the ID in your DeepSeek account
DATA_MODE=fixture CHAT_MODEL_ENABLED=true npm run dev
```

Outside production, no Redis limiter is required. In production, `CHAT_RATE_LIMIT_URL` and `CHAT_RATE_LIMIT_TOKEN` are required or the model is skipped.

Tell DeepSeek from fallback in the `/api/chat` response: `data.meta.answerMode` is `"model"` only when DeepSeek answered and validation passed (the reply opens with a short "events to check out" recommendation). `"retrieval"` means fallback, and `data.meta.fallbackReason` says why: `MODEL_NOT_CONFIGURED`, `MODEL_LIMIT_UNAVAILABLE`, `PROVIDER_UNAVAILABLE` (non-2xx or bad model ID), or `PROVIDER_OR_VALIDATION_FAILURE` (timeout, malformed or ungrounded output). Questions with no event results or needing clarification skip the model and return plain retrieval with no `fallbackReason`.
