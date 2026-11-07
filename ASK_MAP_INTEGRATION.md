# Ask Map integration

Ask Map runs inside the existing Next.js application. Open the floating blue launcher, ask a question, then follow an official source, locate its mapped building, or open the existing building popup. No Python server or SQLite file participates in the integrated path.

## Git handoff

Starting checkout: 4cd4fd9, with uncommitted continuous-map work. With user approval, created codex/ask-map-integration and checkpoint 26ab045. Fetched origin/main at c15fad5; verified its changes were only nine added chatbox files. Merge 6a97b86 preserves both histories without conflicts. The standalone prototype remains under chatbox as a reference. Its sample records, placeholder links, styles and local IDs are not imported. No branch was published or merged into local main.

## Contract and architecture

- src/lib/chat-contract.ts: strict request validation and shared response types. Questions are 1–1000 characters, history at most six bounded user/assistant entries, previous event IDs at most eight UUIDs. Request bodies are bounded to 20 KB even without Content-Length.
- src/app/api/chat/route.ts and src/server/chat/handler.ts: Node POST route with no-store responses and stable INVALID_REQUEST, DATA_UNAVAILABLE and RATE_LIMITED errors.
- src/server/chat/retrieve.ts: calls the existing search service directly in fixture/live mode. Keeps existing eligibility, stable IDs, categories, source links and metadata. Explicit building names override selected context. Campus-wide is the default, even when a map building is selected.
- src/server/chat/answer.ts: optional DeepSeek extractive selection with server-built actions, strict citation/title validation, bounded 8-second provider timeout, bounded output and factual retrieval fallback.
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

## Optional DeepSeek and cost control

Retrieval-only mode requires no API key. Set server-only variables from .env.example:
- CHAT_MODEL_ENABLED=true
- DEEPSEEK_API_KEY
- DEEPSEEK_MODEL: an exact model ID available to the account; no prototype default is assumed.

The adapter uses native fetch to POST `https://api.deepseek.com/chat/completions`, with Bearer authorization, the configured model ID, JSON-object output, a 500-token budget, and thinking disabled for this bounded extractive task. There is no model-preflight request or SDK dependency. [Official API reference](https://api-docs.deepseek.com/api/create-chat-completion/). No example model ID is assumed to be available to the account.

This first release deliberately allows DeepSeek to select exact title extracts from at most eight retrieved records, not generate unverifiable practical advice. Unknown citations, duplicate citations, invented text, malformed JSON and provider failures fall back to retrieved facts. URLs/IDs/actions never come from model output. User questions and records are sent as untrusted data; no tool execution, secrets, arbitrary actions or conversation logging. Optional model calls send the question and bounded candidate records to DeepSeek; history is accepted for contract compatibility but not forwarded or persisted.

In production, model access fails closed to retrieval-only unless a shared Redis REST limiter is configured:
- CHAT_RATE_LIMIT_URL and CHAT_RATE_LIMIT_TOKEN (dedicated HTTPS Redis REST endpoint, e.g. Upstash)
- CHAT_MODEL_REQUESTS_PER_MINUTE (default 20, validated range 1–100)

An atomic EVAL increments a global minute bucket and sets expiry. Exceeded limits return RATE_LIMITED/429; missing/broken limiter returns factual retrieval fallback without calling DeepSeek. This is cross-instance model cost control, not per-user authentication or a daily spend budget. Use provider spend limits and hosting request protection before public rollout; retrieval/database abuse protection remains a hosting responsibility. Never expose these secrets with NEXT_PUBLIC_. No model key is needed for builds or tests.

## Current revision and verification

The November 7 revision selectively integrates Ask Map changes from `origin/main` at `5fd283177bb6d806b59b8d08d0f2996ee3994c6e` into design HEAD `89ba91cec57c81834b8cfb78cb978ed6019ab897`, preserving pending painted-map and ten-building work. This is an uncommitted file-level integration, not a Git merge commit. See [revision report](reports/ask-map-collision-revision.md) for checks, geometry changes, evidence and limits. The earlier Git handoff above is historical.

The UI counts only event cards in “Showing X of Y events”; Y is the retrieved total. Model-selected highlights can be fewer than the complete displayed source list. Citation keys and all retrieved cards are retained. `onOpenChange` and combined chat/dialog pause state remain wired to the iframe; source actions close chat before locating a canonical place or opening the existing dialog.

Provider mocks cover grounded extracts, friendly replies, malformed output, altered titles, unknown/duplicate/place citations, failures, missing configuration and production limiter behavior. No real DeepSeek smoke test was run: this environment has no configured key/model and model use is disabled. A successful retrieval response is not evidence of model execution. Inspect `meta.answerMode` and `meta.fallbackReason` when validating a configured provider. No live PostgreSQL validation was available; database integration tests are explicitly skipped without a disposable test database.
