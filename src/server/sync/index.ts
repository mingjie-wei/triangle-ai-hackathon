import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  placesTable,
  aliasesTable,
  placementsTable,
  locationsTable,
  eventsTable,
  syncRunsTable,
} from "../db/schema";
import { places } from "../../../config/places";
import { fetchFeed, normalize, resolveLocation } from "../sources/duke";
import { canonicalPlaceIds } from "./place-identity";
export function rescheduleTarget(
  existing: { id: string; startsAt: string }[],
  incoming: { startsAt: string }[],
) {
  return existing.length === 1 &&
    incoming.length === 1 &&
    new Date(existing[0].startsAt).getTime() !==
      new Date(incoming[0].startsAt).getTime()
    ? existing[0].id
    : null;
}
type SeedTransaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];
export async function seed(database = db()) {
  await database.transaction(seedPlaces);
}
export async function seedPlaces(tx: SeedTransaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(74190233)`);
  const ids = canonicalPlaceIds(await tx.select().from(placesTable));
  for (const p of places) {
    const value = {
      id: ids.get(p.id)!,
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      reviewStatus: p.reviewStatus,
      officialMapUrl: p.refs[0]
        ? `https://maps.duke.edu/?focus=${p.refs[0]}`
        : null,
    };
    await tx
      .insert(placesTable)
      .values(value)
      .onConflictDoUpdate({ target: placesTable.id, set: value });
    await tx
      .insert(placementsTable)
      .values({ placeId: ids.get(p.id)!, mapId: "west-campus", x: p.x, y: p.y })
      .onConflictDoUpdate({
        target: [placementsTable.placeId, placementsTable.mapId],
        set: { x: p.x, y: p.y },
      });
    for (const a of p.aliases) {
      const alias = normalize(a);
      const existing = await tx
        .select()
        .from(aliasesTable)
        .where(eq(aliasesTable.alias, alias));
      if (existing.some((e) => e.placeId !== ids.get(p.id)))
        throw new Error("Ambiguous alias assignment");
      await tx
        .insert(aliasesTable)
        .values({ alias, placeId: ids.get(p.id)! })
        .onConflictDoNothing();
    }
  }
  for (const l of await tx.select().from(locationsTable)) {
    if (l.source !== "duke") continue;
    const resolved = resolveLocation(l.label, l.externalRef);
    await tx
      .update(locationsTable)
      .set({
        ...resolved,
        placeId: resolved.placeId ? ids.get(resolved.placeId)! : null,
      })
      .where(eq(locationsTable.id, l.id));
  }
}
export async function syncDuke() {
  const [run] = await db()
    .insert(syncRunsTable)
    .values({
      state: "running",
      report: { requested_window: { future_days: 30 }, coverage: "unverified" },
    })
    .returning();
  try {
    const result = await fetchFeed();
    // Reject partial responses atomically so existing data and successful metadata remain intact.
    if (result.rejected.length || !result.accepted.length)
      throw new Error(
        `Import rejected: ${result.rejected.length} invalid of ${result.received} records`,
      );
    const report = {
      received: result.received,
      accepted: result.accepted.length,
      rejected: 0,
      coverage: "unverified",
      requested_window: { future_days: 30 },
    };
    await db().transaction(async (tx) => {
      const locked = await tx.execute(
        sql`select pg_try_advisory_xact_lock(74190233) as locked`,
      );
      if (!locked[0].locked) throw new Error("Another sync is running");
      const storedPlaces = await tx.select().from(placesTable);
      const ids = canonicalPlaceIds(storedPlaces);
      const groups = new Map<string, typeof result.accepted>();
      for (const v of result.accepted) {
        groups.set(v.event.sourceEventId, [
          ...(groups.get(v.event.sourceEventId) ?? []),
          v,
        ]);
      }
      for (const [sourceId, incoming] of groups) {
        const old = await tx
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.source, "duke"),
              eq(eventsTable.sourceEventId, sourceId),
            ),
          );
        const target = rescheduleTarget(
          old,
          incoming.map((x) => x.event),
        );
        for (const { event, location } of incoming) {
          const placeId = location.placeId ? ids.get(location.placeId)! : null;
          if (placeId && !storedPlaces.some((p) => p.id === placeId))
            throw new Error("Seed canonical places before syncing events");
          const mappedLocation = { ...location, placeId };
          const [loc] = await tx
            .insert(locationsTable)
            .values({ ...mappedLocation, lastSeenAt: event.lastSeenAt })
            .onConflictDoUpdate({
              target: locationsTable.sourceKey,
              set: { ...mappedLocation, lastSeenAt: event.lastSeenAt },
            })
            .returning();
          const { placeId: unused, ...fields } = event;
          void unused;
          const value = {
            ...fields,
            sourceLocationId: loc.id,
            superseded: false,
          };
          if (target)
            await tx
              .update(eventsTable)
              .set(value)
              .where(eq(eventsTable.id, target));
          else
            await tx
              .insert(eventsTable)
              .values(value)
              .onConflictDoUpdate({
                target: [
                  eventsTable.source,
                  eventsTable.sourceEventId,
                  eventsTable.startsAt,
                ],
                set: value,
              });
        }
      }
      await tx
        .update(syncRunsTable)
        .set({ state: "success", finishedAt: new Date().toISOString(), report })
        .where(eq(syncRunsTable.id, run.id));
    });
    return report;
  } catch (error) {
    await db()
      .update(syncRunsTable)
      .set({
        state: "failed",
        finishedAt: new Date().toISOString(),
        report: {
          error: error instanceof Error ? error.message : "Sync failed",
          coverage: "unverified",
        },
      })
      .where(eq(syncRunsTable.id, run.id));
    throw error;
  }
}
