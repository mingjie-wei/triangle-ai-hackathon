import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adapt,
  focus,
  parseFeed,
  resolveLocation,
} from "../src/server/sources/duke";
import {
  dayWindow,
  eligible,
  filters,
  pageEvents,
  safeUrl,
} from "../src/lib/domain";
import { rescheduleTarget } from "../src/server/sync";
import { search } from "../src/server/services/search";
const raw = {
  id: "test",
  summary: "A &amp; B",
  start_timestamp: "2026-11-07T18:00:00Z",
  end_timestamp: "2026-11-07T20:00:00Z",
};
const event = {
  ...adapt(raw).event,
  id: "10000000-0000-4000-8000-000000000001",
};
const f = filters(new URLSearchParams(), new Date("2026-11-07T19:00:00Z"));
test("null and None fields survive without invented places", () => {
  const { event: e, location } = adapt({
    ...raw,
    categories: null,
    location: { address: "None" },
  });
  assert.equal(e.locationLabel, null);
  assert.deepEqual(e.categories, []);
  assert.equal(location.placeId, null);
  assert.equal(e.title, "A & B");
});
test("focus accepts numeric and alphanumeric references only at exact host", () => {
  assert.equal(focus(" https://maps.duke.edu/?focus=2003-E24 "), "2003-E24");
  assert.equal(focus("https://maps.duke.edu/?focus=290"), "290");
  assert.equal(focus("https://maps.duke.edu.evil.test/?focus=290"), null);
  assert.equal(focus("https://evil.test/?focus=290"), null);
  assert.equal(safeUrl("javascript:alert(1)"), null);
});
test("reviewed room aliases and conflicts, without broad name matching", () => {
  assert.equal(
    resolveLocation("Sheafer Lab Theater Bryan Center West Campus", null)
      .placeId,
    resolveLocation("Bryan Center Reynolds Industries Theater", null).placeId,
  );
  assert.equal(resolveLocation("Bryan Research", null).placeId, null);
  assert.equal(resolveLocation("Rubenstein Arts Center", null).placeId, null);
  assert.equal(
    resolveLocation("Bostock Library", "290").reviewStatus,
    "conflict",
  );
});
test("ongoing, missing end, cancelled and exact time boundaries", () => {
  assert.equal(eligible(event, f), true);
  assert.equal(eligible({ ...event, endsAt: f.start }, f), false);
  assert.equal(eligible({ ...event, endsAt: null }, f), false);
  assert.equal(eligible({ ...event, startsAt: f.end, endsAt: null }, f), false);
  assert.equal(eligible({ ...event, status: "CANCELLED" }, f), false);
});
test("DST uses New York calendar days", () => {
  const spring = dayWindow("2026-03-08"),
    fall = dayWindow("2026-11-01");
  assert.equal(Date.parse(spring.end) - Date.parse(spring.start), 23 * 3600000);
  assert.equal(Date.parse(fall.end) - Date.parse(fall.start), 25 * 3600000);
});
test("all-day without end uses next local midnight; invalid intervals rejected", () => {
  assert.equal(
    adapt({
      ...raw,
      start_timestamp: "2026-11-01T04:00:00Z",
      end_timestamp: null,
      allday: true,
    }).event.endsAt,
    "2026-11-02T05:00:00.000Z",
  );
  assert.throws(() => adapt({ ...raw, end_timestamp: "2026-11-06T10:00:00Z" }));
  assert.throws(() => parseFeed({ items: [] }));
  assert.equal(parseFeed({ events: [raw, { bad: true }] }).rejected.length, 1);
});
test("multi-category and food rules are explicit", () => {
  const e = { ...event, categories: ["Theater", "Lecture/Talk"] };
  assert.equal(eligible(e, { ...f, category: "arts" }), true);
  assert.equal(eligible(e, { ...f, category: "talks" }), true);
  assert.equal(eligible(e, { ...f, food: "true" }), false);
});
test("stable pagination does not skip equal timestamps", () => {
  const events = [
    event,
    { ...event, id: "10000000-0000-4000-8000-000000000002" },
  ];
  const first = pageEvents(events, { ...f, limit: 1 });
  const second = pageEvents(
    events,
    filters(
      new URLSearchParams({
        as_of: f.asOf,
        limit: "1",
        cursor: first.next_cursor!,
      }),
    ),
  );
  assert.equal(second.items[0].id, events[1].id);
  assert.equal(second.next_cursor, null);
});
test("reschedules preserve singleton identity; recurrence is not collapsed", () => {
  const old = [{ id: "a", startsAt: "2026-11-07T18:00:00Z" }];
  assert.equal(
    rescheduleTarget(old, [{ startsAt: "2026-11-08T18:00:00Z" }]),
    "a",
  );
  assert.equal(rescheduleTarget(old, [{ startsAt: old[0].startsAt }]), null);
  assert.equal(
    rescheduleTarget(old, [
      { startsAt: "2026-11-08T18:00:00Z" },
      { startsAt: "2026-11-09T18:00:00Z" },
    ]),
    null,
  );
  assert.equal(
    rescheduleTarget(
      [...old, { id: "b", startsAt: "2026-11-08T18:00:00Z" }],
      [{ startsAt: "2026-11-09T18:00:00Z" }],
    ),
    null,
  );
});
test("snapshot counts and lists use identical eligibility; unresolved events remain", async () => {
  process.env.DATA_MODE = "fixture";
  const result = await search(f);
  assert.ok(result.events.length);
  assert.ok(result.events.some((e) => !e.placeId));
  for (const p of result.places)
    assert.equal(
      p.count,
      result.events.filter((e) => e.placeId === p.id).length,
    );
  assert.ok(result.events.every((e) => eligible(e, f)));
});
test("invalid filters are rejected", () => {
  assert.throws(() => filters(new URLSearchParams({ limit: "101" })));
  assert.throws(() => filters(new URLSearchParams({ category: "invented" })));
  assert.throws(() => filters(new URLSearchParams({ day: "2026-02-30" })));
  assert.throws(() =>
    filters(
      new URLSearchParams({
        start: "2026-11-07T00:00:00Z",
        end: "2027-11-07T00:00:00Z",
      }),
    ),
  );
});
