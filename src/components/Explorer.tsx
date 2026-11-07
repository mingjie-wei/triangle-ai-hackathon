"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { EventRecord, Place, Meta } from "@/lib/domain";
import CampusMap from "./CampusMap";
import EventFilters from "./EventFilters";
import LocationList from "./LocationList";
import PlacePanel from "./PlacePanel";
import FeedStatus from "./FeedStatus";
type Payload<T> = {
  data: { items: T[]; total?: number; next_cursor: string | null };
  meta: Meta;
  error?: { message: string };
};
export default function Explorer({
  demo,
  fixtureAsOf,
}: {
  demo: boolean;
  fixtureAsOf: string;
}) {
  const [places, setPlaces] = useState<Place[]>([]),
    [events, setEvents] = useState<EventRecord[]>([]),
    [meta, setMeta] = useState<Meta | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [event, setEvent] = useState<EventRecord | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [day, setDay] = useState(""),
    [food, setFood] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    [view, setView] = useState("map"),
    [total, setTotal] = useState(0);
  const asOf = useRef(demo ? fixtureAsOf : new Date().toISOString());
  const initialSlug = useRef<string | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    initialSlug.current = new URLSearchParams(window.location.search).get(
      "place",
    );
  }, []);
  const choose = (id: string | null) => {
    setSelected(id);
    setEvent(null);
    setCursor(null);
    const u = new URL(window.location.href);
    const p = places.find((p) => p.id === id);
    if (p) u.searchParams.set("place", p.slug);
    else u.searchParams.delete("place");
    window.history.replaceState(null, "", u);
  };
  useEffect(() => {
    const abort = new AbortController();
    const timeout = setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          as_of: asOf.current,
          category,
          q: query,
          food: String(food),
          limit: "40",
        });
        if (day) params.set("day", day);
        if (cursor) params.set("cursor", cursor);
        try {
          const [lr, er] = await Promise.all([
            fetch(`/api/locations?${params}`, { signal: abort.signal }),
            fetch(
              `${selected ? `/api/locations/${selected}/events` : "/api/events"}?${params}`,
              { signal: abort.signal },
            ),
          ]);
          const [l, e] = await Promise.all([
            lr.json() as Promise<Payload<Place>>,
            er.json() as Promise<Payload<EventRecord>>,
          ]);
          if (!lr.ok || !er.ok)
            throw new Error(
              l.error?.message ?? e.error?.message ?? "Please try again.",
            );
          if (abort.signal.aborted) return;
          setPlaces(l.data.items);
          setMeta(l.meta);
          setEvents((old) =>
            cursor ? [...old, ...e.data.items] : e.data.items,
          );
          setNext(e.data.next_cursor);
          setTotal(l.data.total ?? 0);
          if (!initialized.current) {
            initialized.current = true;
            const p = l.data.items.find((p) => p.slug === initialSlug.current);
            if (p) setSelected(p.id);
          }
        } catch (e) {
          if (!abort.signal.aborted)
            setError(e instanceof Error ? e.message : "Please try again.");
        } finally {
          if (!abort.signal.aborted) setLoading(false);
        }
      },
      query ? 200 : 0,
    );
    return () => {
      abort.abort();
      clearTimeout(timeout);
    };
  }, [query, category, day, food, selected, cursor, retry]);
  function change<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setCursor(null);
    setEvent(null);
  }
  const place = places.find((p) => p.id === selected) ?? null;
  return (
    <>
      {demo && <span className="demo-badge">Demo data · saved snapshot</span>}
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Around Duke home">
          <span className="brand-icon">
            a<span>↗</span>
          </span>
          <span>
            around<span className="brand-duke">duke</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <span className="nav-current">Explore campus</span>
          <a href="https://calendar.duke.edu/" target="_blank" rel="noreferrer">
            Duke Calendar ↗
          </a>
        </nav>
        <span className="project-label">A CAMPUS FULL OF POSSIBILITIES</span>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="small-star">✳</span> GO WHERE YOUR CURIOSITY
              TAKES YOU
            </div>
            <h1>
              Around the corner.
              <br />
              <em>Out of the ordinary.</em>
            </h1>
            <p>
              Find your next talk, performance, or unexpected connection at
              Duke.
            </p>
          </div>
          <div className="intro-note">
            <span>
              Make a little room
              <br />
              for something new.
            </span>
            <svg width="70" height="55" viewBox="0 0 70 55" aria-hidden="true">
              <path
                d="M8 8Q60 5 42 43m0 0-4-14m4 14 13-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </section>
        <EventFilters
          query={query}
          category={category}
          day={day}
          food={food}
          onQuery={(v) => change(setQuery, v)}
          onCategory={(v) => change(setCategory, v)}
          onDay={(v) => change(setDay, v)}
          onFood={(v) => change(setFood, v)}
        />
        <div className="workspace-top">
          <div>
            <span className="eyebrow">EXPLORE DUKE</span>
            <span className="campus-pill">West Campus + beyond</span>
          </div>
          <div className="view-toggle" role="group" aria-label="Explore view">
            <button
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              ▧ Map
            </button>
            <button
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              ☷ List
            </button>
          </div>
        </div>
        <section className={`explorer ${view === "list" ? "list-view" : ""}`}>
          <div className="places-sidebar">
            <div className="sidebar-heading">
              Pick a place<span>Follow your curiosity →</span>
            </div>
            <LocationList
              places={places}
              selected={selected}
              onSelect={choose}
              total={total}
            />
            <div className="sidebar-note">
              <span>↗</span>
              <p>
                There’s more beyond the map.
                <br />
                <button onClick={() => choose(null)}>Explore all events</button>
              </p>
            </div>
          </div>
          <div className="map-area">
            <CampusMap places={places} selected={selected} onSelect={choose} />
          </div>
          <PlacePanel
            place={place}
            event={event}
            events={events}
            loading={loading}
            error={error}
            next={next}
            onMore={() => setCursor(next)}
            onEvent={setEvent}
            onClose={() => choose(null)}
            onRetry={() => setRetry((v) => v + 1)}
          />
        </section>
        <div className="under-map">
          <FeedStatus meta={meta} demo={demo} />
          <span>
            All times Eastern ·{" "}
            {demo ? "Demo window: Nov 6–Dec 6, 2026" : "Rolling 30-day window"}
          </span>
        </div>
        {demo && (
          <p className="demo-notice">
            <b>Demo data</b> You’re exploring a saved Duke calendar snapshot,
            not live listings. Event dates are preserved. Open the official
            source to verify details.
          </p>
        )}
        <p className="coverage-note">
          {meta?.coverage ?? "Feed completeness unverified."} Free food is shown
          only when tagged by the source.
        </p>
      </main>
      <footer>
        <span className="footer-brand">around duke</span>
        <span>
          An independent campus discovery project. Not affiliated with Duke
          University.
        </span>
        <a
          href="https://calendar.duke.edu/help"
          target="_blank"
          rel="noreferrer"
        >
          About the event source ↗
        </a>
      </footer>
    </>
  );
}
