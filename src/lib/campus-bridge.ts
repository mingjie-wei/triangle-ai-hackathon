import type { Place } from "./domain";

type MapAction = { type: "ready" | "error" | "escape" } | { type: "select-building"; id: string };

/** Resolve display slugs against the current API/presentation list; never invent IDs. */
export function resolveMapMessage(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  origin: string,
  source: MessageEventSource | null,
  places: Pick<Place, "id" | "slug">[],
): MapAction | null {
  if (!source || event.origin !== origin || event.source !== source) return null;
  const m: unknown = event.data;
  if (!m || typeof m !== "object") return null;
  const message = m as Record<string, unknown>;
  if (message.channel !== "cyber-duke-map" || message.version !== 1) return null;
  if (message.type === "ready" || message.type === "error" || message.type === "escape") return { type: message.type };
  if (message.type === "select-building" && typeof message.slug === "string") {
    const place = places.find(p => p.slug === message.slug);
    if (place) return { type: "select-building", id: place.id };
  }
  return null;
}
