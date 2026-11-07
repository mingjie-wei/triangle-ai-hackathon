import { test } from "node:test";
import assert from "node:assert/strict";
import { places } from "../config/places";
import {
  landmarks,
  mergeLandmarks,
  isMappingPending,
} from "../src/lib/presentation";
import { resolveLocation } from "../src/server/sources/duke";
import { canonicalPlaceIds } from "../src/server/sync/place-identity";
import { search, FIXTURE_AS_OF } from "../src/server/services/search";
import { filters } from "../src/lib/domain";
import { handle } from "../src/server/http";
import { retrieve } from "../src/server/chat/retrieve";
test("all ten landmarks have unique stable canonical UUIDs and reviewed exact mappings", () => {
  assert.deepEqual(
    new Set(places.map((p) => p.slug)),
    new Set(landmarks.map((p) => p.slug)),
  );
  assert.equal(new Set(places.map((p) => p.id)).size, 10);
  for (const p of places) {
    assert.match(
      p.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    for (const ref of p.refs)
      assert.equal(resolveLocation(null, ref).placeId, p.id);
    for (const alias of p.aliases)
      assert.equal(
        resolveLocation(" " + alias.toUpperCase() + " ", null).placeId,
        p.id,
      );
  }
  assert.equal(resolveLocation("Duke Chapel", "331").matchMethod, "conflict");
  assert.equal(resolveLocation("Co-Lab at another campus", null).placeId, null);
  assert.equal(resolveLocation("engineering library", null).placeId, null);
});
test("slug identity is reused and conflicting configured UUIDs are rejected", () => {
  const p = places.find((p) => p.slug === "perkins-library")!,
    id = "22222222-2222-4222-8222-222222222222";
  assert.equal(canonicalPlaceIds([{ id, slug: p.slug }]).get(p.id), id);
  assert.throws(
    () => canonicalPlaceIds([{ id: p.id, slug: "different-building" }]),
    /another slug/,
  );
});
test("fixture/API include ten canonical places, zero-event places stay known, new chat actions use canonical IDs", async () => {
  process.env.DATA_MODE = "fixture";
  const data = await search(
    filters(new URLSearchParams({ as_of: FIXTURE_AS_OF })),
  );
  assert.equal(data.places.length, 10);
  assert.ok(
    mergeLandmarks(data.places).every((p) => !p.id.startsWith("visual:")),
  );
  for (const p of data.places) {
    const response = await handle(
      new Request("http://localhost/api/events?q=xyz-impossible"),
      "place",
      p.id,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.items, []);
  }
  const tec = data.places.find((p) => p.slug === "innovation-co-lab")!;
  assert.ok(tec.count! > 0);
  const empty = await search(
    filters(new URLSearchParams({ as_of: FIXTURE_AS_OF, q: "xyz-impossible" })),
  );
  assert.equal(empty.places.length, 10);
  assert.ok(empty.places.every((p) => p.count === 0));
  assert.equal(isMappingPending(tec), false);
  assert.equal(isMappingPending({ ...tec, reviewStatus: "pending" }), true);
  const r = await retrieve({
    message: "What is happening at Penn Pavilion?",
    history: [],
    context: { scope: "campus" },
  });
  assert.ok(r.sources.length);
  assert.equal(
    r.sources[0].placeId,
    places.find((p) => p.slug === "penn-pavilion")!.id,
  );
  assert.equal(r.sources[0].mapped, true);
});
