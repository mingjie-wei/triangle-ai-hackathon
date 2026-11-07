"use client";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/domain";
import { resolveMapMessage } from "@/lib/campus-bridge";
import {
  CampusSession,
  type MapState,
  type MapStatus,
} from "@/lib/campus-session";
type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
  revealSelection: number;
  walkSelection: number;
  suspended: boolean;
  onEscape: () => void;
  startupTimeoutMs?: number;
};
export default function CampusMap(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null),
    session = useRef<CampusSession | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading"),
    [attempt, setAttempt] = useState(0);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  function state(p: Props): MapState {
    return {
      slug: p.places.find((place) => place.id === p.selected)?.slug,
      paused: p.suspended,
      reveal: p.revealSelection,
      walk: p.walkSelection,
    };
  }
  useEffect(() => {
    const lifecycle = new CampusSession(
      state(latest.current),
      (type, payload = {}) => {
        frame.current?.contentWindow?.postMessage(
          { channel: "cyber-duke-host", version: 1, type, ...payload },
          window.location.origin,
        );
        if (type === "walk-to") frame.current?.focus();
      },
      setStatus,
      latest.current.startupTimeoutMs,
    );
    session.current = lifecycle;
    function receive(event: MessageEvent) {
      const action = resolveMapMessage(
        event,
        window.location.origin,
        frame.current?.contentWindow ?? null,
        latest.current.places,
      );
      if (!action) return;
      if (action.type === "ready") lifecycle.ready(state(latest.current));
      if (action.type === "error") lifecycle.fail();
      if (action.type === "escape") latest.current.onEscape();
      if (action.type === "select-building" && !latest.current.suspended)
        latest.current.onSelect(action.id);
    }
    window.addEventListener("message", receive);
    lifecycle.start();
    return () => {
      lifecycle.dispose();
      session.current = null;
      window.removeEventListener("message", receive);
    };
  }, [attempt]);
  useEffect(() => {
    session.current?.update(state(props));
  }, [props]);
  return (
    <div className="map-canvas painted-map">
      <iframe
        key={attempt}
        ref={frame}
        className="map-surface"
        src="/campus-explorer/index.html?embedded=1"
        title="Illustrated Duke campus. WASD or arrows move; E explores; M toggles overview."
        onLoad={() => session.current?.start()}
        onError={() => session.current?.fail()}
      />
      {status !== "ready" && (
        <div className="painted-map-status paper" role="status">
          <strong>
            {status === "error"
              ? "The illustrated map could not load."
              : "Opening the autumn campus…"}
          </strong>
          <p>
            {status === "error"
              ? "You can still find events and choose buildings in Explore campus."
              : "Event search and the building list are ready to use."}
          </p>
          {status === "error" && (
            <button onClick={() => setAttempt((v) => v + 1)}>Retry map</button>
          )}
        </div>
      )}
    </div>
  );
}
