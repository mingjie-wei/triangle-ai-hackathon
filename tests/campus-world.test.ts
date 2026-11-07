import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { westCampus } from "../src/lib/campus-world";
import { landmarks } from "../src/lib/presentation";
test("each landmark has one bounded sprite placement without changing its stable slug", () => {
  assert.deepEqual(westCampus.placements.map(p=>p.slug),landmarks.map(p=>p.slug));
  assert.equal(new Set(westCampus.placements.map(p=>p.slug)).size,landmarks.length);
  for(const p of westCampus.placements) {
    assert.ok(existsSync(`public${p.sprite}`),p.sprite);
    assert.ok(p.position.x-p.display.w*p.anchor.x>=0);
    assert.ok(p.position.y-p.display.h*p.anchor.y>=0);
    assert.ok(p.position.x+p.display.w*(1-p.anchor.x)<=westCampus.world.w);
    assert.ok(p.position.y+p.display.h*(1-p.anchor.y)<=westCampus.world.h);
    assert.equal(p.campusId,westCampus.id);
  }
});
