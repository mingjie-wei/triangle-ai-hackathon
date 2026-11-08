import { DateTime } from "luxon";
import type { Place } from "@/lib/domain";
import type { ChatRequest } from "@/lib/chat-contract";
import type { ChatMode } from "./types";
export default function ChatControls({
  mode,
  setMode,
  scope,
  setScope,
  useFilters,
  setUseFilters,
  pending,
  hasTurns,
  place,
  asOf,
  demo,
  currentFilters,
  onAlex,
}: {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  scope: "campus" | "selected";
  setScope: (scope: "campus" | "selected") => void;
  useFilters: boolean;
  setUseFilters: (enabled: boolean) => void;
  pending: boolean;
  hasTurns: boolean;
  place: Place | null;
  asOf: string;
  demo: boolean;
  currentFilters: NonNullable<ChatRequest["context"]["filters"]>;
  onAlex: () => void;
}) {
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
    <div className="ask-scope">
      <label>
        Ask Map mode
        <select
          aria-label="Ask Map mode"
          value={mode}
          disabled={pending}
          onChange={(e) => setMode(e.target.value as "events" | "explore")}
        >
          <option value="events">Find events</option>
          <option value="explore">Explore with AI</option>
        </select>
      </label>
      {mode === "explore" && !hasTurns && (
        <p className="ask-explore-intro">
          Tell us your interests and what you’re hoping for. Get one virtual
          destination, plus an optional conversation starter.
        </p>
      )}
      {!hasTurns && (
        <button className="ask-alex" disabled={pending} onClick={onAlex}>
          Try Alex’s first campus visit ↗
        </button>
      )}
      <label>
        Search scope
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "campus" | "selected")}
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
  );
}
