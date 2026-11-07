import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeLandmarks,
  isVisualOnly,
  landmarks,
} from "../src/lib/presentation";
import { places } from "../config/places";
import type { Place } from "../src/lib/domain";
test("visual landmarks preserve backend IDs, counts and source links without inventing missing event mappings", () => {
  const api: Place[] = places.slice(0, 6).map((p, i) => ({
    ...p,
    reviewStatus: "reviewed",
    officialMapUrl: null,
    count: i + 2,
  }));
  const merged = mergeLandmarks(api);
  assert.equal(merged.length, 10);
  assert.equal(merged.filter((p) => isVisualOnly(p.id)).length, 4);
  for (const original of api)
    assert.equal(
      merged.find((p) => p.slug === original.slug),
      original,
    );
  for (const pending of merged.filter((p) => isVisualOnly(p.id))) {
    assert.equal(pending.count, undefined);
    assert.equal(pending.reviewStatus, "presentation-only");
  }
});
test("a newly configured backend landmark replaces its visual-only entry instead of duplicating it", () => {
  const perkins: Place = {
    id: "00000000-0000-4000-8000-000000000007",
    slug: "perkins-library",
    name: "Perkins Library",
    kind: "Library",
    reviewStatus: "reviewed",
    officialMapUrl: null,
    x: 0.5,
    y: 0.4,
    count: 3,
  };
  const merged = mergeLandmarks([perkins]);
  assert.equal(merged.filter((p) => p.slug === "perkins-library").length, 1);
  assert.equal(merged.find((p) => p.slug === perkins.slug)?.id, perkins.id);
  assert.equal(isVisualOnly(perkins.id), false);
  assert.deepEqual(
    new Set(
      landmarks
        .filter((l) =>
          ["perkins-library", "bostock-library", "rubenstein-library"].includes(
            l.slug,
          ),
        )
        .map((l) => l.scene),
    ),
    new Set(["libraries"]),
  );
});
