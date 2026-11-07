"use client";
import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import type { Place } from "@/lib/domain";
import type {
  ChatRequest,
  ChatResponse,
  ChatSource,
} from "@/lib/chat-contract";
type Turn = {
  id: number;
  question: string;
  request: ChatRequest;
  response?: ChatResponse;
  error?: string;
};
export default function AskMap({
  place,
  asOf,
  demo,
  currentFilters,
  buildingOpen,
  onOpenChange,
  onLocatePlace,
  onOpenPlace,
}: {
  place: Place | null;
  asOf: string;
  demo: boolean;
  currentFilters: NonNullable<ChatRequest["context"]["filters"]>;
  buildingOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  onLocatePlace: (id: string) => void;
  onOpenPlace: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [scope, setScope] = useState<"campus" | "selected">("campus"),
    [useFilters, setUseFilters] = useState(false);
  const [message, setMessage] = useState(""),
    [turns, setTurns] = useState<Turn[]>([]),
    [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    inputRef = useRef<HTMLInputElement>(null),
    launcher = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null),
    sequence = useRef(0),
    locked = useRef(false),
    scroll = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const el = dialog.current,
      trigger = launcher.current;
    el?.showModal();
    inputRef.current?.focus();
    return () => {
      el?.close();
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    const container = scroll.current,
      latest = container?.querySelector<HTMLElement>(".ask-turn:last-of-type");
    if (open && container && latest)
      container.scrollTo({
        top:
          container.scrollTop +
          latest.getBoundingClientRect().top -
          container.getBoundingClientRect().top -
          12,
      });
  }, [turns, open]);
  function close() {
    setOpen(false);
  }
  function action(id: string, kind: "locate" | "open") {
    close();
    requestAnimationFrame(() =>
      kind === "locate" ? onLocatePlace(id) : onOpenPlace(id),
    );
  }
  async function send(saved?: Turn, prompt?: string) {
    if (locked.current) return;
    const question = (prompt ?? message).trim();
    if (!saved && !question) return;
    const previous = turns.at(-1)?.response;
    const request: ChatRequest = saved?.request ?? {
      message: question,
      history: turns
        .filter((t) => t.response)
        .slice(-3)
        .flatMap((t) => [
          { role: "user" as const, content: t.question },
          {
            role: "assistant" as const,
            content: t.response!.reply.slice(0, 2000),
          },
        ]),
      context: {
        scope,
        selectedSlug: place?.slug,
        asOf,
        filters: useFilters ? currentFilters : undefined,
      },
      previousIds: previous?.sources
        .filter((s) => s.kind === "event")
        .map((s) => s.id),
    };
    const id = saved?.id ?? ++sequence.current;
    locked.current = true;
    setPending(true);
    if (saved)
      setTurns((old) =>
        old.map((t) => (t.id === id ? { ...t, error: undefined } : t)),
      );
    else {
      setTurns((old) => [...old, { id, question, request }]);
      setMessage("");
    }
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error?.message ?? "Ask Map couldn’t load. Please retry.",
        );
      if (!abort.signal.aborted)
        setTurns((old) =>
          old.map((t) => (t.id === id ? { ...t, response: body.data } : t)),
        );
    } catch (e) {
      if (!abort.signal.aborted)
        setTurns((old) =>
          old.map((t) =>
            t.id === id
              ? {
                  ...t,
                  error: e instanceof Error ? e.message : "Please try again.",
                }
              : t,
          ),
        );
    } finally {
      if (!abort.signal.aborted) {
        locked.current = false;
        setPending(false);
      }
    }
  }
  const filterLabel =
    [
      currentFilters.q,
      currentFilters.category !== "all" ? currentFilters.category : "",
      currentFilters.day,
      currentFilters.food ? "Free food" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No active filters";
  return (
    <>
      <button
        ref={launcher}
        className="ask-launcher"
        hidden={buildingOpen || !asOf}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        ✦ Ask Map
      </button>
      <dialog
        ref={dialog}
        className="ask-dialog paper"
        aria-labelledby="ask-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key !== "Tab") return;
          const controls = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href],input,select",
            ),
          ).filter((el) => el.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="ask-header">
          <div>
            <span className="eyebrow">BLUE DEVIL / AROUND DUKE</span>
            <h2 id="ask-title">
              Ask Map <span>✦</span>
            </h2>
            <p>A little curiosity. A source to follow.</p>
          </div>
          <button
            className="close-button"
            aria-label="Close Ask Map"
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="ask-scope">
          <label>
            Search scope
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "campus" | "selected")
              }
              disabled={pending}
            >
              <option value="campus">Campus-wide</option>
              <option value="selected" disabled={!place}>
                Selected building{place ? ` · ${place.name}` : ""}
              </option>
            </select>
          </label>
          <label className="ask-filter-toggle">
            <input
              type="checkbox"
              checked={useFilters}
              onChange={(e) => setUseFilters(e.target.checked)}
              disabled={pending}
            />{" "}
            Use current filters
          </label>
          {useFilters && <small>{filterLabel}</small>}
          <small>
            {demo ? "Saved demo · " : "Discovery clock: "}{" "}
            {DateTime.fromISO(asOf)
              .setZone("America/New_York")
              .toFormat("MMM d, yyyy · h:mm a")}{" "}
            ET
          </small>
        </div>
        <div ref={scroll} className="ask-transcript">
          {!turns.length && (
            <div className="ask-welcome">
              <span aria-hidden="true">✦</span>
              <h3>What will you discover?</h3>
              <p>
                Ask about events, a building, today, tomorrow, or this weekend.
                Answers link back to the event index.
              </p>
              {[
                "What music events are coming up?",
                "What is happening at Duke Chapel?",
                "What events are happening this weekend?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(undefined, prompt)}
                  disabled={pending}
                >
                  {prompt} ↗
                </button>
              ))}
              <small>
                Selected buildings and map filters apply only when you opt in.
              </small>
            </div>
          )}
          {turns.map((turn) => (
            <section
              className="ask-turn"
              key={turn.id}
              aria-label="Conversation turn"
            >
              <p className="ask-question">{turn.question}</p>
              <small className="ask-request-context">
                {turn.request.context.scope === "campus"
                  ? "Campus-wide"
                  : `Selected: ${turn.request.context.selectedSlug ?? "none"}`}
                {turn.request.context.filters
                  ? " · Current filters included"
                  : " · Question filters only"}
              </small>
              {turn.response && (
                <>
                  <p className="ask-reply">{turn.response.reply}</p>
                  <div className="ask-resolution">
                    <strong>{turn.response.resolvedScope.label}</strong>
                    <span>
                      {DateTime.fromISO(turn.response.resolvedScope.start)
                        .setZone("America/New_York")
                        .toFormat("MMM d, h:mm a")}{" "}
                      –{" "}
                      {DateTime.fromISO(turn.response.resolvedScope.end)
                        .setZone("America/New_York")
                        .toFormat("MMM d, h:mm a")}{" "}
                      ET
                    </span>
                    <span>{turn.response.resolvedScope.filters}</span>
                    {turn.response.resolvedScope.notes.map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                  {turn.response.resolvedScope.totalMatches > 0 &&
                    turn.response.sources.some((x) => x.kind === "event") && (
                      <p className="ask-count">
                        Showing{" "}
                        {
                          turn.response.sources.filter(
                            (s) => s.kind === "event",
                          ).length
                        }{" "}
                        of {turn.response.resolvedScope.totalMatches} event
                        {turn.response.resolvedScope.totalMatches === 1
                          ? ""
                          : "s"}
                      </p>
                    )}
                  <div className="ask-source-list">
                    {turn.response.sources.map((source) => (
                      <SourceCard
                        key={source.key}
                        source={source}
                        onAction={action}
                      />
                    ))}
                  </div>
                  <p className="ask-mode">
                    {turn.response.meta.data_mode === "fixture"
                      ? "Saved demo feed"
                      : "Live event index"}{" "}
                    ·{" "}
                    {turn.response.meta.answerMode === "retrieval"
                      ? "Retrieval-only answer"
                      : "AI-selected highlights · All retrieved cards shown"}
                    {turn.response.meta.fallbackReason &&
                    turn.response.meta.fallbackReason !== "MODEL_NOT_CONFIGURED"
                      ? " · Model unavailable; showing retrieved facts"
                      : ""}
                    {turn.response.meta.stale
                      ? " · Event index may be stale"
                      : ""}
                  </p>
                  <small>{turn.response.meta.coverage}</small>
                </>
              )}
              {turn.error && (
                <div className="ask-error" role="alert">
                  <p>{turn.error}</p>
                  <button onClick={() => void send(turn)} disabled={pending}>
                    Retry question
                  </button>
                </div>
              )}
            </section>
          ))}
          <div role="status" aria-live="polite" className="ask-status">
            {pending
              ? "Checking the event index…"
              : turns.at(-1)?.response
                ? `Answer ready. ${turns.at(-1)!.response!.sources.length} source cards.`
                : ""}
          </div>
        </div>
        <form
          className="ask-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask about campus events
          </label>
          <input
            id="ask-input"
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            placeholder="Ask about campus events…"
            autoComplete="off"
          />
          <button type="submit" disabled={pending || !message.trim()}>
            Send ↑
          </button>
        </form>
        <small className="ask-privacy">
          Conversation stays in this page session. Official listings remain
          authoritative.
        </small>
      </dialog>
    </>
  );
}
function SourceCard({
  source,
  onAction,
}: {
  source: ChatSource;
  onAction: (id: string, kind: "locate" | "open") => void;
}) {
  return (
    <article className="ask-source">
      <span className="ask-citation">{source.key}</span>
      <h4>{source.title}</h4>
      {source.startsAt && (
        <p>
          {DateTime.fromISO(source.startsAt)
            .setZone("America/New_York")
            .toFormat(
              source.allDay
                ? "ccc, MMM d · 'All day'"
                : "ccc, MMM d · h:mm a 'ET'",
            )}
        </p>
      )}
      <p>{source.location ?? "Location not provided"}</p>
      <div className="ask-source-actions">
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer">
            Official source ↗
          </a>
        )}
        {source.mapped && source.placeId && (
          <>
            <button onClick={() => onAction(source.placeId!, "locate")}>
              Locate
            </button>
            <button onClick={() => onAction(source.placeId!, "open")}>
              Building details
            </button>
          </>
        )}
      </div>
    </article>
  );
}
