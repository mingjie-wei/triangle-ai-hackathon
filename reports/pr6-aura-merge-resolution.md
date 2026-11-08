# PR #6 Aura merge resolution

Merged main `ccf8e84133d9a5c3af6a450d32fe57574513b9d1` into Aura branch head `1e53ea2c8e069248ee605070b506b67e6dad8204`.

Resolved overlapping changes in AskMap.tsx and globals.css by retaining main's chronological conversation, recommendation cards, source guards, destination state, map actions, and mode-specific behavior, together with Aura's launcher, welcome portrait, answer identity, and styles. Images use Next Image with explicit dimensions and appropriate alt text. Increased small Aura text sizes and stacked the welcome layout on narrow screens. Constrained the scope grid to prevent horizontal overflow at 375px.

Validation:

- Node test runner: 91 tests, 89 passed, 2 PostgreSQL integration tests skipped, 0 failures.
- Typecheck, ESLint, and production build passed.
- No conflict markers or whitespace errors.
- Browser: Alex example returned Penn Pavilion with event evidence; an AI follow-up returned Innovation Co-Lab / TEC. Both turns retained their own evidence and actions in chronological order.
- Show on Map selected Innovation Co-Lab / TEC. Walk there virtually closed the dialog, focused the map, and displayed its walking status.
- Closing/reopening preserved session state. Find events returned a reply and eight source cards with official links.
- Existing automated tests cover provider failures and fallback behavior; provider outages were not induced in the running browser.
- Desktop welcome and 375px mobile screenshots included. Mobile dialog clientWidth and scrollWidth both measured 355px after the fix.

No environment, database, dependency, or production deployment changes. Remote mergeability and CI must be checked after pushing this local resolution. PR remains open.
