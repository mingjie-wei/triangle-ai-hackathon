import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/server/http";
const request = (path: string) => new Request(`http://localhost${path}`);
test("HTTP responses distinguish invalid ID, unknown place, and known empty place", async () => {
  process.env.DATA_MODE = "fixture";
  assert.equal(
    (await handle(request("/api/events"), "place", "invalid")).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request("/api/events"),
        "place",
        "00000000-0000-4000-8000-000000000099",
      )
    ).status,
    404,
  );
  const r = await handle(
    request("/api/events?q=xyz-no-such-event"),
    "place",
    "00000000-0000-4000-8000-000000000005",
  );
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).data.items, []);
});
test("HTTP database/configuration failures do not masquerade as empty lists", async () => {
  process.env.DATA_MODE = "live";
  const old = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const r = await handle(request("/api/events"), "events");
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error.code, "DATA_UNAVAILABLE");
  } finally {
    if (old) process.env.DATABASE_URL = old;
    process.env.DATA_MODE = "fixture";
  }
});
test("HTTP detail lookup retains the official source and stable event UUID", async () => {
  process.env.DATA_MODE = "fixture";
  const r = await handle(
    request("/api/events?as_of=2026-11-07T03:00:00Z"),
    "events",
  );
  const body = await r.json();
  assert.equal(body.meta.data_mode, "fixture");
  const event = body.data.items[0];
  const detail = await handle(request("/api/events"), "event", event.id);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.sourceUrl, event.sourceUrl);
});
