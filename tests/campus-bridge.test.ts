import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMapMessage } from "../src/lib/campus-bridge";
const origin = "https://campus.example";
const frame = {} as Window;
const places = [{ id: "actual-reviewed-backend-uuid", slug: "duke-chapel" }, { id: "visual:perkins-library", slug: "perkins-library" }];
const message = (data: Record<string, unknown>) => ({ origin, source: frame, data: { channel: "cyber-duke-map", version: 1, ...data } });
test("painted selection resolves the current backend ID and preserves visual-only IDs", () => {
  assert.deepEqual(resolveMapMessage(message({ type: "select-building", slug: "duke-chapel" }), origin, frame, places), { type: "select-building", id: places[0].id });
  assert.deepEqual(resolveMapMessage(message({ type: "select-building", slug: "perkins-library" }), origin, frame, places), { type: "select-building", id: places[1].id });
  assert.equal(resolveMapMessage(message({ type: "select-building", slug: "unknown" }), origin, frame, places), null);
});
test("only this map frame at the same origin can select backend records", () => {
  const e = message({ type: "select-building", slug: "duke-chapel" });
  assert.equal(resolveMapMessage({ ...e, origin: "https://other.example" }, origin, frame, places), null);
  assert.equal(resolveMapMessage({ ...e, source: {} as Window }, origin, frame, places), null);
  assert.equal(resolveMapMessage({ ...e, source: null }, origin, null, places), null);
});
test("bridge accepts lifecycle events and rejects unknown commands and malformed payloads", () => {
  for (const type of ["ready", "error", "escape"]) assert.deepEqual(resolveMapMessage(message({ type }), origin, frame, places), { type });
  for (const data of [null, "ready", {}, { channel: "cyber-duke-map", version: 2, type: "ready" }, { channel: "cyber-duke-map", version: 1, type: "delete" }]) {
    assert.equal(resolveMapMessage({ origin, source: frame, data }, origin, frame, places), null);
  }
});
