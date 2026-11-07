# Explore with AI revision — November 7, 2026

## Scope and baseline

Starting branch: `codex/ask-map-integration`, HEAD `b68215d2ce0a2fa53d959f162e575b6be66db383`. Fetched `origin/main` at `8ef88cfeb3fab4830468b6ed14b75fc4a479f4a8`; its file tree matched HEAD. No teammate changes were overwritten. This revision remains uncommitted; no push, deployment, credentials change, database migration, art or physics change.

Locally replayed the original HEAD retrieval module against the saved fixture (no model):

| Prompt | Before | After in Explore mode (real DeepSeek, fixture events) |
| --- | --- | --- |
| Alex: new here, AI, entrepreneurship, shy | “Select a building…”; zero matches | Penn Pavilion, event-backed “Invented at Duke 2026” |
| Freshman, AI, suggest a campus route | No matching events | Innovation Co-Lab / TEC, event-backed Codex webpage workshop; one virtual destination |
| “What about entrepreneurship?” | “Which building would you like to explore?” | Wilkinson Engineering, Founders Friday Monthly Mentoring |

Normal event search keeps its existing scope, dates, filters, citation validation and retrieval fallback. Only the isolated `here`/`about` false-positive rules were narrowed. Broad personal requests belong in the explicit Explore mode, not a fragile automatic intent classifier.

## Contract and implementation

`src/lib/chat-contract.ts` adds optional-on-input `mode: events | explore` (default events), bounded prior recommendation slug, optional recommendation and non-sensitive diagnostics. Existing six-message history and request-size limits remain.

`src/server/chat/provider.ts` is the shared DeepSeek JSON transport and production limiter for both modes. Same timeout and shared global rate bucket; no second unprotected API path. Explore uses a 1,200-token output budget; event extraction retains 500. Server-only environment settings and real `.env` are unchanged.

`src/server/chat/recommend.ts` holds candidate preparation, `EXPLORE_PROMPT`, strict discriminated output schema, grounding validation and server enrichment. It loads the ten registered, persisted building identities with modest purpose tags. Explicit buildings or selected scope narrow that allowlist; otherwise all ten remain even with no eligible events. Up to 18 mapped, eligible events are drawn from a union of topic matches, balanced across topic/building buckets. Source descriptions are cleaned and bounded to 700 characters; titles/categories are bounded too. Eligibility, cancellations, time windows and opt-in filters are reused. Truncation and candidate counts are exposed in diagnostics. Unknown-topic recall remains limited by this modest vocabulary; the ten place candidates prevent an event-retrieval miss from automatically ending exploration.

Supported dates are enforced; conflicting/out-of-window or unsupported time/duration requirements clarify instead of silently broadening. Unknown destinations are not silently replaced. Multiple named buildings are alternatives for one destination, not a multi-stop route.

The one model call receives current message, at most six recent messages, prior target slug and bounded candidates. Current preferences override older ones. History is context, never factual evidence.

### Deliberately constrained explanations

Instead of accepting arbitrary factual recommendation prose, the model chooses a destination, an exact user preference, an evidence key and an exact supplied fact. The server constructs the short reason from those validated pieces. This retains model interpretation/selection while reducing invented factual claims. An event must match the selected canonical place and current request eligibility; a place-only result must have a null event ID. Unknown keys, IDs, extra fields, commands and inconsistent pairs are rejected. Names, UUIDs, dates, URLs and source cards come from server records. Request and recommendation IDs are generated per request, not by the model.

Both quest stages are included in the response: a constrained virtual exploration task and a short hypothetical social opening line. Generated text is rendered as React text. Social-line validation rejects markup, links and some unsupported guarantees; this is not a general semantic proof. Relevance and hypothetical wording still require evaluation. Partial-fit and real-world limitations are explicit. Arrival-triggered Quest 2, attendance and multi-stop planning are **not implemented**.

`clarification`, `no_match` and provider `unavailable` responses have no destination or action. The client retains its last valid recommendation. The session guard rejects stale responses; requests are serialized and unmount aborts pending work. Retry reconstructs current mode/context instead of blindly replaying stale filters. No personal prompts are logged by default; the optional saved-demo diagnostics display validated response data and counts, not credentials or hidden reasoning.

## UI and map verification

Ask Map now offers Find events / Explore with AI, plus an Alex starter. Free-text Explore mode was tested independently of the starter. One active recommendation card shows its place/event distinction, reason, two stages and limitations. Official source cards include bounded source descriptions. The disclosure explains that enabled AI sends the request and recent context to DeepSeek.

Real browser checks:

- Alex response highlighted `penn-pavilion` immediately, with chat open, map paused and no blocking building dialog.
- Show on Map closed chat and focused the same canonical target.
- Walk there virtually closed chat, cleared pause, and started a route (`route=27`); it completed at feet `907.6,2318.0`, `route=0`. Existing pathfinding/foot collision code was reused.
- Session test asserts ordered `pause(false) → focus-building → walk-to`, exactly once, with no replay on iframe reload.
- “I have one hour” clarified while retaining Penn Pavilion and its valid card.
- Official-source href was the server's Duke Calendar URL for Invented at Duke 2026.
- Desktop and 390×844 phone layout inspected; phone dialog bounds fit viewport with document width/scroll width both 390. Request submit disabled during the pending call. Active recommendation is visible on reopening chat.

Screenshots: [desktop](explore-alex-desktop.png), [phone](explore-alex-mobile.png). Browser testing used the actual configured provider, not intercepted/mock responses.

## Real-model evaluation

[Recorded synthetic evaluation responses](explore-real-model-evaluation.json): 11 prompts, all with fixture data. Seven accepted recommendations, three pre-model clarifications, one model clarification. Accepted model responses explicitly report `answerMode: model`, `validation: accepted`, and server-resolved targets. Real model latency was roughly 1–2.2 seconds in this sample, not a service guarantee.

| Case | Observed result / review |
| --- | --- |
| Alex | Penn / Invented at Duke; entrepreneurship fit, not a claim of combined AI coverage or a shy-friendly event |
| Freshman AI route | Co-Lab / Codex workshop; AI supported by source description; virtual single-stop action |
| Entrepreneurship follow-up | Wilkinson / Founders Friday; mentoring and entrepreneurship supported by description |
| AI + music | Co-Lab / Codex workshop; AI partial fit, no invented combined event |
| No eligible events, engineering virtual visit | Fitzpatrick place-only; no scheduled-event claim |
| Within 60 minutes | Pre-model duration clarification; no action |
| One hour | Pre-model virtual-vs-real clarification; no action |
| Wilkinson and Bostock | Initially model asked to narrow; prompt corrected and retested: Wilkinson / Athena seminar, with single-stop limitation |
| Imaginary Hall | Pre-model unknown-destination clarification; no substitution |
| Entrepreneurship on 2026-11-17 | Penn event on that date, source-backed |
| Only scuba diving in an underwater laboratory | Model clarification, no action; offered asking about a related underwater-robotics seminar. That seminar exists in the actual candidate bundle and was checked locally. No scuba event was fabricated. |

These are observed choices, not hardcoded expected destinations. Provider output is nondeterministic. Automated tests use mocks and fixed fixture candidates; real evaluation is separate.

## Checks and limits

**Final checks:** `npm run test:map` — 22 passed. Full suite via `node --import tsx --test tests/*.test.ts tests/*.test.mjs` — 89 passed, 2 PostgreSQL tests skipped, 0 failed (91 total). Typecheck, ESLint, production build and `git diff --check` passed. The regression suite covers legacy event search, Explore mode, place-only recommendations, date and scope constraints, invalid IDs/evidence/commands, source injection, provider failure/production limiter, late response ordering, all ten map entrance routes and iframe pause/reload handling.

Live PostgreSQL integration remains unverified (two database tests require a disposable database). Provider success here uses the saved fixture, not live event availability or production infrastructure. No physical-device or production hosting validation is claimed. Quest 2 arrival tracking is a later milestone.
