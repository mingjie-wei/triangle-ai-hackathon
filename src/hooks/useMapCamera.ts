"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  WORLD,
  centerPoint,
  advanceGesture,
  bounded,
  cameraScale,
  overviewCamera,
  revealPoint,
  resizeCamera,
  zoomCamera,
  type Camera,
  type Size,
  type Point,
  type Gesture,
} from "@/lib/map-camera";
export function useMapCamera(
  selectedPoint: Point | null,
  revealSelection: number,
  world: Size = WORLD,
) {
  const surface = useRef<HTMLDivElement>(null);
  const model = useRef({
    size: { w: 1, h: 1 } as Size,
    camera: overviewCamera(),
  });
  const [view, setView] = useState<{ size: Size; camera: Camera }>(() => ({
    size: { w: 1, h: 1 },
    camera: overviewCamera(),
  }));
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Set<number>());
  const suppressClick = useRef(false);
  const selected = useRef(selectedPoint);
  function commit(camera: Camera, size = model.current.size) {
    model.current = { size, camera: bounded(camera, size, world) };
    setView(model.current);
  }
  function cancel() {
    const active = gesture.current;
    gesture.current = null;
    setDragging(false);
    if (active) {
      suppressClick.current = true;
      const el = surface.current;
      if (el?.hasPointerCapture(active.id)) el.releasePointerCapture(active.id);
    }
  }
  function reveal(point: Point) {
    commit(revealPoint(model.current.camera, model.current.size, point, world));
  }
  useEffect(() => {
    selected.current = selectedPoint;
    // Cancel the scheduled reveal when selection/scene changes. Event-count
    // refreshes do not schedule a new reveal (only point coordinates do).
    const frame = requestAnimationFrame(() => {
      cancel();
      if (selectedPoint) reveal(selectedPoint);
    });
    return () => cancelAnimationFrame(frame);
    // Coordinates, not the newly allocated presentation object, define selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoint?.x, selectedPoint?.y, revealSelection]);
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = { w: entry.contentRect.width, h: entry.contentRect.height };
      if (size.w <= 0 || size.h <= 0) return;
      cancel();
      const old = model.current;
      let camera = resizeCamera(old.camera, old.size, size, world);
      if (selected.current)
        camera = revealPoint(camera, size, selected.current, world);
      commit(camera, size);
    });
    observer.observe(el);
    const end = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      gesture.current = null;
      setDragging(false);
      suppressClick.current = g.dragged || e.type === "pointercancel";
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
    };
    const anotherPointer = (e: PointerEvent) => {
      if (
        e.pointerType === "touch" &&
        gesture.current &&
        e.pointerId !== gesture.current.id
      ) {
        pointers.current.add(e.pointerId);
        cancel();
      }
    };
    window.addEventListener("pointerdown", anotherPointer);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointerdown", anotherPointer);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const g = gesture.current;
      gesture.current = null;
      if (g && el.hasPointerCapture(g.id)) el.releasePointerCapture(g.id);
    };
  // World configuration is stable for the mounted campus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.add(e.pointerId);
    if (pointers.current.size > 1 || !e.isPrimary) {
      cancel();
      suppressClick.current = true;
      return;
    }
    suppressClick.current = false;
    gesture.current = {
      id: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      last: { x: e.clientX, y: e.clientY },
      dragged: false,
    };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const next = advanceGesture(g, { x: e.clientX, y: e.clientY });
    gesture.current = next.gesture;
    if (!next.gesture.dragged) return;
    if (!g.dragged) {
      surface.current?.setPointerCapture(e.pointerId);
      setDragging(true);
      suppressClick.current = true;
    }
    e.preventDefault();
    const { camera, size } = model.current;
    // Incremental deltas normalize at every edge: reversing never has an overshoot dead zone.
    commit(
      { ...camera, x: camera.x + next.delta.x, y: camera.y + next.delta.y },
      size,
    );
  }
  function onClickCapture(e: ReactMouseEvent) {
    if (e.detail !== 0 && suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      e.target !== e.currentTarget ||
      e.altKey ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey
    )
      return;
    const delta: Record<string, Point> = {
      ArrowLeft: { x: 64, y: 0 },
      ArrowRight: { x: -64, y: 0 },
      ArrowUp: { x: 0, y: 64 },
      ArrowDown: { x: 0, y: -64 },
    };
    if (e.key === "Home") {
      e.preventDefault();
      reset();
    } else if (delta[e.key]) {
      e.preventDefault();
      const c = model.current.camera;
      commit({ ...c, x: c.x + delta[e.key].x, y: c.y + delta[e.key].y });
    }
  }
  function reset() {
    cancel();
    commit(overviewCamera());
  }
  function zoom(amount: number) {
    cancel();
    const { camera, size } = model.current;
    commit(zoomCamera(camera, size, camera.zoom + amount, world));
  }
  return {
    surface,
    camera: view.camera,
    size: view.size,
    scale: cameraScale(view.size, view.camera, world),
    center: (point: Point) => { cancel(); commit(centerPoint(model.current.camera, model.current.size, point, world)); },
    dragging,
    reveal,
    reset,
    zoom,
    handlers: {
      onPointerDown,
      onPointerMove,
      onClickCapture,
      onKeyDown,
      onLostPointerCapture: () => {
        if (gesture.current) cancel();
      },
    },
  };
}
