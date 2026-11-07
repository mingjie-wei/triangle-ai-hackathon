// Centered CSS-pixel camera: screen = viewportCenter + pan +
// scale * (worldPoint - worldCenter). No geography or backend state.
export const WORLD = { w: 1536, h: 1024 };
export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
export type Camera = Point & { zoom: number };
export const MAX_ZOOM = 3;
export const overviewCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
export function cameraScale(size: Size, camera: Camera, world: Size = WORLD) {
  return Math.min(size.w / world.w, size.h / world.h) * camera.zoom;
}
export function bounded(camera: Camera, size: Size, world: Size = WORLD): Camera {
  const zoom = Math.max(1, Math.min(MAX_ZOOM, camera.zoom));
  const scale = cameraScale(size, { ...camera, zoom }, world);
  const maxX = Math.max(0, (world.w * scale - size.w) / 2);
  const maxY = Math.max(0, (world.h * scale - size.h) / 2);
  return {
    zoom,
    x: Math.max(-maxX, Math.min(maxX, camera.x)) || 0,
    y: Math.max(-maxY, Math.min(maxY, camera.y)) || 0,
  };
}
export function zoomCamera(camera: Camera, size: Size, zoom: number, world: Size = WORLD): Camera {
  const nextZoom = Math.max(1, Math.min(MAX_ZOOM, zoom));
  const ratio = nextZoom / camera.zoom;
  return bounded(
    { zoom: nextZoom, x: camera.x * ratio, y: camera.y * ratio },
    size, world,
  );
}
export function resizeCamera(
  camera: Camera,
  before: Size,
  after: Size,
  world: Size = WORLD,
): Camera {
  const ratio = cameraScale(after, camera, world) / cameraScale(before, camera, world);
  return bounded(
    { ...camera, x: camera.x * ratio, y: camera.y * ratio },
    after, world,
  );
}
export function screenPoint(point: Point, camera: Camera, size: Size, world: Size = WORLD): Point {
  const scale = cameraScale(size, camera, world);
  return {
    x: size.w / 2 + camera.x + scale * (point.x - world.w / 2),
    y: size.h / 2 + camera.y + scale * (point.y - world.h / 2),
  };
}
export function revealPoint(camera: Camera, size: Size, point: Point, world: Size = WORLD): Camera {
  const screen = screenPoint(point, camera, size, world);
  // Counter-scaled labels need a screen-space margin. For narrow surfaces use
  // half the available dimension, so reveal converges without oscillation.
  const mx = Math.min(115, size.w / 2),
    my = Math.min(55, size.h / 2);
  const x = Math.max(mx, Math.min(size.w - mx, screen.x));
  const y = Math.max(my, Math.min(size.h - my, screen.y));
  return bounded(
    { ...camera, x: camera.x + x - screen.x, y: camera.y + y - screen.y },
    size, world,
  );
}
export const DRAG_THRESHOLD = 6;
export type Gesture = {
  id: number;
  start: Point;
  last: Point;
  dragged: boolean;
};
export function advanceGesture(gesture: Gesture, point: Point) {
  const crossed =
    Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >=
    DRAG_THRESHOLD;
  const dragged = gesture.dragged || crossed;
  const origin = gesture.dragged ? gesture.last : gesture.start;
  return {
    gesture: { ...gesture, last: point, dragged },
    delta: dragged
      ? { x: point.x - origin.x, y: point.y - origin.y }
      : { x: 0, y: 0 },
  };
}

export function worldViewport(camera: Camera, size: Size, world: Size = WORLD) {
  const scale = cameraScale(size, camera, world);
  const x = Math.max(0, world.w / 2 - (size.w / 2 + camera.x) / scale);
  const y = Math.max(0, world.h / 2 - (size.h / 2 + camera.y) / scale);
  return { x, y, w: Math.min(world.w, world.w / 2 + (size.w / 2 - camera.x) / scale) - x,
    h: Math.min(world.h, world.h / 2 + (size.h / 2 - camera.y) / scale) - y };
}
export function centerPoint(camera: Camera, size: Size, point: Point, world: Size = WORLD): Camera {
  const scale = cameraScale(size, camera, world);
  return bounded({ ...camera, x: (world.w / 2 - point.x) * scale, y: (world.h / 2 - point.y) * scale }, size, world);
}
