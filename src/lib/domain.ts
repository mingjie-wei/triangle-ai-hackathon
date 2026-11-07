import { DateTime } from "luxon";
import { z } from "zod";
export const ZONE = "America/New_York";
export const categories: Record<string, string[]> = {
  arts: ["Concert/Music", "Theater"],
  talks: ["Lecture/Talk", "Panel/Seminar/Colloquium"],
  learning: ["Workshop/Short Course"],
  info: ["Information Session"],
  wellbeing: ["Health/Wellness"],
  community: ["Religious/Spiritual"],
};
export const categoryNames: Record<string, string> = {
  arts: "Arts & performances",
  talks: "Talks & discussions",
  learning: "Workshops & learning",
  info: "Information sessions",
  wellbeing: "Health & wellbeing",
  community: "Faith & community",
};
export type EventRecord = {
  id: string;
  sourceEventId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  status: string | null;
  locationLabel: string | null;
  locationKind: string;
  placeId: string | null;
  sourceUrl: string | null;
  organizerUrl: string | null;
  categories: string[];
  sponsor: string | null;
  lastSeenAt: string;
};
export type Place = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  reviewStatus: string;
  officialMapUrl: string | null;
  x: number | null;
  y: number | null;
  count?: number;
};
export type Meta = {
  as_of: string;
  window_start: string;
  window_end: string;
  last_successful_sync: string | null;
  stale: boolean;
  data_mode: "live" | "fixture";
  coverage: string;
  last_sync_state: string | null;
};
export function safeUrl(value: unknown) {
  try {
    const u = new URL(String(value).trim());
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function dayWindow(day: string) {
  const d = DateTime.fromISO(day, { zone: ZONE }).startOf("day");
  if (!d.isValid) throw new Error("Invalid day");
  return {
    start: d.toUTC().toISO()!,
    end: d.plus({ days: 1 }).toUTC().toISO()!,
  };
}
const input = z.object({
  as_of: z.iso.datetime({ offset: true }).optional(),
  start: z.iso.datetime({ offset: true }).optional(),
  end: z.iso.datetime({ offset: true }).optional(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  category: z
    .enum(["all", ...Object.keys(categories)] as [string, ...string[]])
    .default("all"),
  q: z.string().max(200).default(""),
  food: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  cursor: z.string().max(200).optional(),
});
export function filters(params: URLSearchParams, now = new Date()) {
  const p = input.parse(Object.fromEntries(params));
  const asOf = p.as_of ?? now.toISOString();
  const day = p.day ? dayWindow(p.day) : null;
  const start = day?.start ?? p.start ?? asOf;
  const end =
    day?.end ??
    p.end ??
    DateTime.fromISO(start).setZone(ZONE).plus({ days: 30 }).toUTC().toISO()!;
  if (
    Date.parse(end) <= Date.parse(start) ||
    Date.parse(end) - Date.parse(start) > 32 * 86400000
  )
    throw new Error("Window must be positive and at most 32 days");
  let cursor: { start: string; id: string } | null = null;
  if (p.cursor) {
    cursor = z
      .object({ start: z.iso.datetime({ offset: true }), id: z.uuid() })
      .parse(JSON.parse(Buffer.from(p.cursor, "base64url").toString()));
  }
  return { ...p, asOf, start, end, cursor };
}
export type Filters = ReturnType<typeof filters>;
export function eligible(e: EventRecord, f: Filters) {
  return (
    !/cancelled|canceled/i.test(e.status ?? "") &&
    Date.parse(e.startsAt) < Date.parse(f.end) &&
    (e.endsAt
      ? Date.parse(e.endsAt) > Date.parse(f.start)
      : Date.parse(e.startsAt) >= Date.parse(f.start)) &&
    (f.category === "all" ||
      e.categories.some((c) => categories[f.category]?.includes(c))) &&
    (f.food !== "true" || e.categories.includes("Free Food and Beverages")) &&
    (!f.q ||
      `${e.title} ${e.description} ${e.locationLabel ?? ""}`
        .toLowerCase()
        .includes(f.q.toLowerCase()))
  );
}
export function pageEvents(events: EventRecord[], f: Filters) {
  const sorted = events
    .filter((e) => eligible(e, f))
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
    )
    .filter(
      (e) =>
        !f.cursor ||
        e.startsAt > f.cursor.start ||
        (e.startsAt === f.cursor.start && e.id > f.cursor.id),
    );
  const items = sorted.slice(0, f.limit);
  const last = items.at(-1);
  return {
    items,
    total: sorted.length,
    next_cursor:
      sorted.length > f.limit && last
        ? Buffer.from(
            JSON.stringify({ start: last.startsAt, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
