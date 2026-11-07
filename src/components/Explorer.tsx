"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EventRecord, Place, Meta } from "@/lib/domain";
import { categoryNames } from "@/lib/domain";
import { mergeLandmarks, isVisualOnly, landmarks } from "@/lib/presentation";
import CampusMap from "./CampusMap";
import PlacePanel from "./PlacePanel";
import BuildingDialog from "./BuildingDialog";
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
    [placeQuery, setPlaceQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [day, setDay] = useState(""),
    [food, setFood] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    [total, setTotal] = useState(0),
    [panelOpen, setPanelOpen] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [revealSelection, setRevealSelection] = useState(0);
  const asOf = useRef(demo ? fixtureAsOf : new Date().toISOString()),
    initialized = useRef(false);
  const displayPlaces = mergeLandmarks(places);
  const place = displayPlaces.find((p) => p.id === selected) ?? null;
  function choose(id: string | null) {
    setRevealSelection((v) => v + 1);
    setEvent(null);
    setPanelOpen(true);
    setMobileNav(false);
    if (id === selected) return;
    setSelected(id);
    setEvents([]);
    setCursor(null);
    setLoading(!isVisualOnly(id));
    const u = new URL(window.location.href),
      p = mergeLandmarks(places).find((p) => p.id === id);
    if (p) u.searchParams.set("place", p.slug);
    else u.searchParams.delete("place");
    window.history.replaceState(null, "", u);
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        (e.target instanceof Element &&
          e.target.closest(
            "input,select,textarea,[contenteditable]:not([contenteditable=false]),dialog,[role=dialog]",
          ))
      )
        return;
      if (e.key === "Escape") {
        setPanelOpen(false);
        setMobileNav(false);
      }
      if (
        e.key.toLowerCase() === "e" &&
        !(e.target instanceof Element && e.target.closest("button,a"))
      )
        setPanelOpen(true);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
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
            isVisualOnly(selected)
              ? Promise.resolve(null)
              : fetch(
                  `${selected ? `/api/locations/${selected}/events` : "/api/events"}?${params}`,
                  { signal: abort.signal },
                ),
          ]);
          const l = (await lr.json()) as Payload<Place>,
            e = er ? ((await er.json()) as Payload<EventRecord>) : null;
          if (!lr.ok || (er && !er.ok))
            throw new Error(
              l.error?.message ?? e?.error?.message ?? "Please try again.",
            );
          if (abort.signal.aborted) return;
          setPlaces(l.data.items);
          setMeta(l.meta);
          setTotal(l.data.total ?? 0);
          setEvents((old) =>
            cursor ? [...old, ...(e?.data.items ?? [])] : (e?.data.items ?? []),
          );
          setNext(e?.data.next_cursor ?? null);
          if (!initialized.current) {
            initialized.current = true;
            const slug = new URLSearchParams(window.location.search).get(
              "place",
            );
            if (slug) {
              const p = mergeLandmarks(l.data.items).find(
                (p) => p.slug === slug,
              );
              if (p) {
                setSelected(p.id);
                setPanelOpen(true);
                setEvents([]);
                setLoading(!isVisualOnly(p.id));
              }
            }
          }
        } catch (e) {
          if (!abort.signal.aborted) {
            setError(e instanceof Error ? e.message : "Please try again.");
            setEvents([]);
            setNext(null);
          }
        } finally {
          if (!abort.signal.aborted) setLoading(false);
        }
      },
      query ? 220 : 0,
    );
    return () => {
      abort.abort();
      clearTimeout(timeout);
    };
  }, [query, category, day, food, selected, cursor, retry]);
  function filter<T>(setter: (v: T) => void, v: T) {
    setter(v);
    setCursor(null);
    setEvent(null);
  }
  const matching = displayPlaces.filter((p) =>
    p.name.toLowerCase().includes(placeQuery.toLowerCase()),
  );
  return (
    <div className="campus-app">
      <button
        className="mobile-menu"
        onClick={() => setMobileNav((v) => !v)}
        aria-expanded={mobileNav}
        aria-label="Toggle campus sidebar"
      >
        ☰ <span>Duke Campus</span>
      </button>
      <aside
        className={`campus-sidebar paper ${mobileNav ? "mobile-open" : ""}`}
        aria-label="Campus explorer sidebar"
      >
        <Link className="campus-brand" href="/" aria-label="Duke Campus home">
          <span className="brand-kicker">AROUND DUKE</span>
          <span>
            DUKE
            <br />
            CAMPUS
          </span>
          <span className="brand-chapel" aria-hidden="true">
            ♜
          </span>
          <small>A little curiosity. A new connection.</small>
        </Link>
        <section className="find-section">
          <h2>
            <span className="heading-icon">▦</span> Find events
          </h2>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search campus events"
              placeholder="Music, art, a new idea…"
              value={query}
              onChange={(e) => filter(setQuery, e.target.value)}
            />
            {query && (
              <button
                aria-label="Clear event search"
                onClick={() => filter(setQuery, "")}
              >
                ×
              </button>
            )}
          </label>
          <div className="interest-chips">
            {[
              { id: "all", name: "All", icon: "✦" },
              { id: "arts", name: "Arts", icon: "♫" },
              { id: "talks", name: "Talks", icon: "♧" },
              { id: "learning", name: "Learn", icon: "▣" },
            ].map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => filter(setCategory, c.id)}
              >
                <span>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
          <details className="more-filters">
            <summary>
              More filters <span>＋</span>
            </summary>
            <label>
              Interest
              <select
                aria-label="Event category"
                value={category}
                onChange={(e) => filter(setCategory, e.target.value)}
              >
                <option value="all">All interests</option>
                {Object.entries(categoryNames).map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Day · Eastern time
              <input
                type="date"
                aria-label="Filter by date"
                value={day}
                onChange={(e) => filter(setDay, e.target.value)}
              />
            </label>
            {day && (
              <button
                className="text-button"
                onClick={() => filter(setDay, "")}
              >
                Clear date
              </button>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={food}
                onChange={(e) => filter(setFood, e.target.checked)}
              />{" "}
              Free food tagged by source
            </label>
          </details>
        </section>
        <div className="ornament" aria-hidden="true">
          ◆
        </div>
        <section className="place-section">
          <div className="section-title">
            <h2>Explore campus</h2>
            <span>{landmarks.length} places</span>
          </div>
          <label className="place-search">
            <span className="sr-only">Find a building</span>
            <input
              aria-label="Find a building"
              placeholder="Find a building…"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            <span>⌕</span>
          </label>
          <nav className="location-list" aria-label="Campus places">
            <button
              className={!selected ? "active all-events" : "all-events"}
              onClick={() => choose(null)}
              aria-pressed={!selected}
            >
              <span className="location-icon">✧</span>
              <span>
                All campus events<small>Including other places & online</small>
              </span>
              <b>{loading ? "—" : total}</b>
            </button>
            {matching.map((p) => (
              <button
                key={p.id}
                className={selected === p.id ? "active" : ""}
                onClick={() => choose(p.id)}
                aria-pressed={selected === p.id}
              >
                <span
                  className={`location-icon ${p.slug === "duke-chapel" ? "chapel-icon" : ""}`}
                >
                  {p.slug === "duke-chapel"
                    ? "♜"
                    : landmarks.some((l) => l.slug === p.slug)
                      ? String(
                          landmarks.findIndex((l) => l.slug === p.slug) + 1,
                        ).padStart(2, "0")
                      : "◇"}
                </span>
                <span>
                  {p.name}
                  <small>
                    {isVisualOnly(p.id) ? "Activity mapping pending" : p.kind}
                  </small>
                </span>
                <b>
                  {isVisualOnly(p.id) ? "↗" : loading ? "—" : (p.count ?? 0)}
                </b>
              </button>
            ))}
            {!matching.length && (
              <p className="building-empty">
                No building matches “{placeQuery}”.
                <button onClick={() => setPlaceQuery("")}>
                  Clear building search
                </button>
              </p>
            )}
          </nav>
        </section>
        <div className="sidebar-bottom">
          <span className="autumn-tag">✦ An autumn worth exploring</span>
          <a href="https://calendar.duke.edu/" target="_blank" rel="noreferrer">
            Duke Calendar ↗
          </a>
          <small>Independent student project · Not affiliated with Duke</small>
        </div>
      </aside>
      <main className="campus-main">
        <CampusMap
          places={displayPlaces}
          selected={selected}
          revealSelection={revealSelection}
          onSelect={choose}
        />
        <div className="connection-status">
          <span className={`status-dot ${error ? "status-error" : ""}`} />
          {demo
            ? "Demo · Nov 6 saved feed"
            : meta?.data_mode === "live"
              ? "Live event index"
              : "Connecting to event API"}
          <span className="connection-divider">/</span>
          <span>{places.length} event-linked places</span>
        </div>
        {!panelOpen && (
          <button
            className="reopen-panel paper"
            onClick={() => setPanelOpen(true)}
          >
            ▤ {place?.name ?? "Campus events"} <span>↗</span>
          </button>
        )}
        <BuildingDialog open={panelOpen} place={place}
          onClose={() => setPanelOpen(false)}
          onLocate={() => { setPanelOpen(false); setRevealSelection(v => v + 1); }}
          filterSummary={[query && `“${query}”`, category !== "all" && categoryNames[category as keyof typeof categoryNames], day, food && "Free food"].filter(Boolean).join(" · ")}
          onClearFilters={() => { setQuery(""); setCategory("all"); setDay(""); setFood(false); setCursor(null); setEvent(null); }}>

            <PlacePanel
              place={place}
              event={event}
              events={events}
              loading={loading}
              error={error}
              next={next}
              onMore={() => setCursor(next)}
              onEvent={setEvent}
              onRetry={() => setRetry((v) => v + 1)}
            />
        </BuildingDialog>
        <div className="data-footnote">
          <FeedStatus meta={meta} demo={demo} />
          <span>Eastern time · Official listings remain authoritative</span>
        </div>
      </main>
    </div>
  );
}
