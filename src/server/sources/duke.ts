import { createHash } from "node:crypto";
import { z } from "zod";
import * as he from "he";
import { DateTime } from "luxon";
import { places } from "../../../config/places";
import { safeUrl, ZONE, type EventRecord } from "../../lib/domain";
export const FEED_URL =
  "https://calendar.duke.edu/events/index.json?future_days=30&feed_type=simple";
export const normalize = (v: string) =>
  v.trim().replace(/\s+/g, " ").toLowerCase();
export function focus(link: unknown) {
  const s = safeUrl(link);
  if (!s) return null;
  const u = new URL(s);
  return u.hostname === "maps.duke.edu" ? u.searchParams.get("focus") : null;
}
export function plain(v: string) {
  return he
    .decode(
      v
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " "),
    )
    .trim();
}
export function resolveLocation(label: string | null, ref: string | null) {
  const byRef = places.find((p) => ref && p.refs.includes(ref));
  const byAlias = places.find(
    (p) => label && p.aliases.some((a) => normalize(a) === normalize(label)),
  );
  const conflict = Boolean(byRef && byAlias && byRef.id !== byAlias.id);
  return {
    placeId: conflict ? null : ((byRef ?? byAlias)?.id ?? null),
    matchMethod: conflict
      ? "conflict"
      : byRef
        ? "reference"
        : byAlias
          ? "alias"
          : "unresolved",
    reviewStatus: conflict
      ? "conflict"
      : byRef || byAlias
        ? "reviewed"
        : "unresolved",
  };
}
const record = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  start_timestamp: z.iso.datetime({ offset: true }),
  end_timestamp: z.iso.datetime({ offset: true }).nullish(),
  allday: z.boolean().optional(),
  status: z.string().nullish(),
  description: z.string().nullish(),
  location: z
    .object({ address: z.string().nullish(), link: z.string().nullish() })
    .nullish(),
  categories: z.array(z.string()).nullish(),
  sponsor: z.string().nullish(),
  link: z.string().nullish(),
  event_url: z.string().nullish(),
});
export function adapt(raw: unknown, now = new Date().toISOString()) {
  const v = record.parse(raw);
  const start = new Date(v.start_timestamp).toISOString();
  let end = v.end_timestamp ? new Date(v.end_timestamp).toISOString() : null;
  if (end && end < start) throw new Error("Inverted event interval");
  // Equal start/end is a source point event, with no indicated duration.
  if (end === start) end = null;
  // Missing all-day end means one local calendar day. Supplied ends are preserved:
  // the observed feed has inconsistent all-day clock times; never round these silently.
  if (v.allday && !end)
    end = DateTime.fromISO(start)
      .setZone(ZONE)
      .startOf("day")
      .plus({ days: 1 })
      .toUTC()
      .toISO();
  const label =
    v.location?.address && !/^none$/i.test(v.location.address.trim())
      ? plain(v.location.address)
      : null;
  const link = safeUrl(v.location?.link);
  const ref = focus(link);
  const sourceKey = createHash("sha256")
    .update(JSON.stringify([ref, normalize(label ?? ""), ref ? null : link]))
    .digest("hex");
  const location = {
    sourceKey,
    label,
    link,
    externalRef: ref,
    ...resolveLocation(label, ref),
  };
  const event: Omit<EventRecord, "id"> = {
    sourceEventId: v.id,
    title: plain(v.summary),
    description: plain(v.description ?? ""),
    startsAt: start,
    endsAt: end,
    allDay: v.allday ?? false,
    status: v.status ?? null,
    locationLabel: label,
    locationKind: /zoom|online|virtual/i.test(label ?? "")
      ? "online"
      : label
        ? "venue"
        : "unspecified",
    placeId: location.placeId,
    sourceUrl: safeUrl(v.link),
    organizerUrl: safeUrl(v.event_url),
    categories: v.categories ?? [],
    sponsor: v.sponsor ?? null,
    lastSeenAt: now,
  };
  return { event, location };
}
export function parseFeed(raw: unknown) {
  const { events } = z.object({ events: z.array(z.unknown()) }).parse(raw);
  const accepted: ReturnType<typeof adapt>[] = [];
  const rejected: { index: number; reason: string }[] = [];
  events.forEach((e, index) => {
    try {
      accepted.push(adapt(e));
    } catch {
      rejected.push({ index, reason: "Invalid event schema or dates" });
    }
  });
  return { received: events.length, accepted, rejected };
}
export async function fetchFeed() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(FEED_URL, {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429)
          throw new Error("Nonretryable Duke response");
        throw new Error("Transient Duke response");
      }
      return parseFeed(await response.json());
    } catch (e) {
      if (
        attempt === 2 ||
        (e instanceof Error && e.message.startsWith("Nonretryable"))
      )
        throw e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw new Error("Duke unavailable");
}
