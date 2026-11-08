import { test } from "node:test";
import assert from "node:assert/strict";
import { CampusSession, type MapState } from "../src/lib/campus-session";
const state: MapState = {
  slug: "duke-chapel",
  paused: true,
  reveal: 1,
  walk: 2,
};
test("each handshake restores latest selection and pause without replaying walking", () => {
  const out: unknown[] = [],
    status: string[] = [];
  const session = new CampusSession(
    state,
    (type, payload) => out.push({ type, ...payload }),
    (s) => status.push(s),
  );
  session.start();
  session.ready(state);
  out.length = 0;
  session.ready({ ...state, slug: "bostock-library" });
  assert.deepEqual(out, [
    { type: "pause", paused: true },
    { type: "focus-building", slug: "bostock-library" },
  ]);
  session.update({ ...state, slug: "bostock-library" });
  assert.equal(out.length, 2);
  session.update({ ...state, slug: "bostock-library", paused: false, walk: 3 });
  assert.deepEqual(out.at(-1), { type: "walk-to", slug: "bostock-library" });
  session.start();
  out.length = 0;
  session.ready({ ...state, walk: 3, paused: false });
  assert.ok(!JSON.stringify(out).includes("walk-to"));
  session.dispose();
});
test("failure clears readiness; new walk requests while unavailable are not replayed", () => {
  const out: string[] = [];
  const session = new CampusSession(
    state,
    (t) => out.push(t),
    () => {},
  );
  session.ready(state);
  session.fail();
  out.length = 0;
  session.update({ ...state, walk: 4, paused: false });
  assert.equal(out.length, 0);
  session.ready({ ...state, walk: 4, paused: false });
  assert.deepEqual(out, ["pause", "focus-building"]);
  session.dispose();
});
test("startup times out, retry recovers, and successful readiness cancels timers", async () => {
  const statuses: string[] = [];
  const session = new CampusSession(
    state,
    () => {},
    (s) => statuses.push(s),
    5,
  );
  session.start();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(statuses.at(-1), "error");
  session.start();
  session.ready(state);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(statuses.at(-1), "ready");
  session.dispose();
});
test("clearing host selection clears the child on update and reload", () => {
  const out: string[] = [];
  const session = new CampusSession(
    state,
    (t) => out.push(t),
    () => {},
  );
  session.ready(state);
  session.update({ ...state, slug: undefined });
  assert.equal(out.at(-1), "clear-selection");
  out.length = 0;
  session.ready({ ...state, slug: undefined });
  assert.deepEqual(out, ["pause", "clear-selection"]);
  session.dispose();
});
test("recommendation walk unpauses before issuing exactly one route and never replays on reload", () => {
  const out: { type: string; [key: string]: unknown }[] = [];
  const session = new CampusSession(
    state,
    (type, payload) => out.push({ type, ...payload }),
    () => {},
  );
  session.ready(state);
  out.length = 0;
  const next = {
    ...state,
    paused: false,
    slug: "wilkinson-building",
    walk: state.walk + 1,
  };
  session.update(next);
  assert.deepEqual(out, [
    { type: "pause", paused: false },
    { type: "focus-building", slug: "wilkinson-building" },
    { type: "walk-to", slug: "wilkinson-building" },
  ]);
  session.update(next);
  assert.equal(out.filter((x) => x.type === "walk-to").length, 1);
  session.start();
  out.length = 0;
  session.ready(next);
  assert.equal(out.filter((x) => x.type === "walk-to").length, 0);
  session.dispose();
});
