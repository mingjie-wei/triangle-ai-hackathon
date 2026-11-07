import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORLD,
  overviewCamera,
  cameraScale,
  bounded,
  zoomCamera,
  resizeCamera,
  revealPoint,
  screenPoint,
  advanceGesture,
  worldViewport,
  centerPoint,
} from "../src/lib/map-camera";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 0.0001, `${a} != ${b}`);
test("overview contains the whole scene at desktop, portrait and landscape sizes", () => {
  for (const size of [
    { w: 780, h: 674 },
    { w: 428, h: 542 },
    { w: 366, h: 212 },
    { w: 354, h: 190 },
  ]) {
    const c = overviewCamera(),
      s = cameraScale(size, c);
    assert.ok(WORLD.w * s <= size.w + 0.0001);
    assert.ok(WORLD.h * s <= size.h + 0.0001);
    near(screenPoint({ x: 768, y: 512 }, c, size).x, size.w / 2);
    assert.deepEqual(bounded({ ...c, x: 999, y: -999 }, size), c);
  }
});
test("zoom preserves the world point at viewport center except when bounds intervene", () => {
  const size = { w: 800, h: 500 },
    c = { zoom: 2, x: 80, y: 20 };
  const next = zoomCamera(c, size, 2.5);
  near(c.x / cameraScale(size, c), next.x / cameraScale(size, next));
  near(c.y / cameraScale(size, c), next.y / cameraScale(size, next));
});
test("resize preserves center world point and normalizes stored pan", () => {
  const before = { w: 800, h: 500 },
    after = { w: 600, h: 400 },
    c = { zoom: 2, x: 100, y: 40 };
  const next = resizeCamera(c, before, after);
  near(c.x / cameraScale(before, c), next.x / cameraScale(after, next));
  assert.deepEqual(bounded(next, after), next);
  assert.deepEqual(zoomCamera(next, after, 1), overviewCamera());
});
test("offscreen landmark reveal makes minimum movement and stays stable", () => {
  const size = { w: 400, h: 300 },
    c = bounded({ zoom: 3, x: 350, y: -250 }, size),
    point = { x: 384, y: 809 };
  const next = revealPoint(c, size, point),
    screen = screenPoint(point, next, size);
  assert.ok(screen.x >= 0 && screen.x <= size.w);
  assert.ok(screen.y >= 0 && screen.y <= size.h);
  assert.deepEqual(revealPoint(next, size, point), next);
});
test("pointer jitter keeps tap; threshold crosses once and subsequent deltas are incremental", () => {
  const g = {
    id: 1,
    start: { x: 10, y: 10 },
    last: { x: 10, y: 10 },
    dragged: false,
  };
  const jitter = advanceGesture(g, { x: 13, y: 12 });
  assert.equal(jitter.gesture.dragged, false);
  assert.deepEqual(jitter.delta, { x: 0, y: 0 });
  const drag = advanceGesture(jitter.gesture, { x: 20, y: 10 });
  assert.equal(drag.gesture.dragged, true);
  assert.deepEqual(drag.delta, { x: 10, y: 0 });
  assert.deepEqual(advanceGesture(drag.gesture, { x: 18, y: 10 }).delta, {
    x: -2,
    y: 0,
  });
});
test("clamped incremental drag reverses immediately with no hidden overshoot", () => {
  const size = { w: 400, h: 300 };
  const edge = bounded({ zoom: 3, x: 9999, y: 0 }, size);
  const beyond = bounded({ ...edge, x: edge.x + 500 }, size);
  assert.equal(beyond.x, edge.x);
  const reverse = bounded({ ...beyond, x: beyond.x - 3 }, size);
  assert.equal(reverse.x, edge.x - 3);
});

test("custom campus dimensions drive fit, centering and the minimap viewport", () => {
  const world = { w: 2400, h: 1800 }, size = { w: 800, h: 600 };
  assert.equal(cameraScale(size, overviewCamera(), world), 1 / 3);
  assert.deepEqual(worldViewport(overviewCamera(), size, world), { x: 0, y: 0, w: 2400, h: 1800 });
  const camera = centerPoint({ x: 0, y: 0, zoom: 2 }, size, { x: 1600, y: 1000 }, world);
  assert.deepEqual(screenPoint({ x: 1600, y: 1000 }, camera, size, world), { x: 400, y: 300 });
  const viewport = worldViewport(camera, size, world);
  near(viewport.x + viewport.w / 2, 1600);
  near(viewport.y + viewport.h / 2, 1000);
  assert.deepEqual(bounded(camera, size, world), camera);
});
