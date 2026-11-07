import { and, eq, lt, or, gt, gte, isNull, desc } from "drizzle-orm";
import { db } from "../db/client";
import {
  eventsTable,
  locationsTable,
  placesTable,
  placementsTable,
  syncRunsTable,
} from "../db/schema";
import { places as config } from "../../../config/places";
import { adapt } from "../sources/duke";
import snapshot from "../../../tests/fixtures/duke-snapshot.json";
import {
  type EventRecord,
  type Place,
  type Filters,
  type Meta,
  eligible,
} from "../../lib/domain";
export const FIXTURE_AS_OF = "2026-11-07T03:00:00.000Z";
export async function search(
  f: Filters,
): Promise<{ events: EventRecord[]; places: Place[]; meta: Meta }> {
  const mode = process.env.DATA_MODE;
  if (mode !== "fixture" && mode !== "live")
    throw new Error("Configure DATA_MODE as live or fixture");
  let events: EventRecord[],
    places: Place[],
    last: string | null = null,
    state: string | null = null;
  if (mode === "fixture") {
    events = snapshot.events.map((e, i) => ({
      ...adapt(e, FIXTURE_AS_OF).event,
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    }));
    places = config.map((p) => ({
      ...p,
      reviewStatus: p.reviewStatus,
      officialMapUrl: p.refs[0]
        ? `https://maps.duke.edu/?focus=${p.refs[0]}`
        : null,
    }));
  } else {
    const database = db();
    const rows = await database
      .select({ event: eventsTable, placeId: locationsTable.placeId })
      .from(eventsTable)
      .leftJoin(
        locationsTable,
        eq(eventsTable.sourceLocationId, locationsTable.id),
      )
      .where(
        and(
          eq(eventsTable.superseded, false),
          lt(eventsTable.startsAt, f.end),
          or(
            gt(eventsTable.endsAt, f.start),
            and(isNull(eventsTable.endsAt), gte(eventsTable.startsAt, f.start)),
          ),
        ),
      );
    events = rows.map(({ event, placeId }) => ({
      ...event,
      placeId,
      startsAt: new Date(event.startsAt).toISOString(),
      endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : null,
    }));
    places = (
      await database
        .select({
          place: placesTable,
          x: placementsTable.x,
          y: placementsTable.y,
        })
        .from(placesTable)
        .leftJoin(
          placementsTable,
          and(
            eq(placesTable.id, placementsTable.placeId),
            eq(placementsTable.mapId, "west-campus"),
            eq(placementsTable.visible, true),
          ),
        )
    ).map(({ place, x, y }) => ({ ...place, x, y }));
    const [success] = await database
      .select()
      .from(syncRunsTable)
      .where(eq(syncRunsTable.state, "success"))
      .orderBy(desc(syncRunsTable.finishedAt))
      .limit(1);
    last = success?.finishedAt ?? null;
    const [latest] = await database
      .select()
      .from(syncRunsTable)
      .orderBy(desc(syncRunsTable.startedAt))
      .limit(1);
    state = latest?.state ?? null;
  }
  events = events.filter((e) => eligible(e, f));
  places = places.map((p) => ({
    ...p,
    count: events.filter((e) => e.placeId === p.id).length,
  }));
  const hours = Number(process.env.STALE_AFTER_HOURS || 24);
  return {
    events,
    places,
    meta: {
      as_of: f.asOf,
      window_start: f.start,
      window_end: f.end,
      last_successful_sync: last,
      stale:
        mode === "live" &&
        (!last ||
          Date.now() - Date.parse(last) >
            (Number.isFinite(hours) ? hours : 24) * 3600000),
      data_mode: mode,
      coverage: "Feed completeness unverified; events may be missing.",
      last_sync_state: state,
    },
  };
}
export async function eventById(id: string) {
  if (process.env.DATA_MODE === "fixture") {
    const i = Number(id.slice(-12)) - 1;
    return snapshot.events[i] &&
      id === `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`
      ? { ...adapt(snapshot.events[i], FIXTURE_AS_OF).event, id }
      : null;
  }
  if (process.env.DATA_MODE !== "live") throw new Error("Configure DATA_MODE");
  const [row] = await db()
    .select({ event: eventsTable, placeId: locationsTable.placeId })
    .from(eventsTable)
    .leftJoin(
      locationsTable,
      eq(eventsTable.sourceLocationId, locationsTable.id),
    )
    .where(eq(eventsTable.id, id));
  return row ? { ...row.event, placeId: row.placeId } : null;
}
