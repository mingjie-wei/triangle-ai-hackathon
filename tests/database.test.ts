import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eventsTable } from "../src/server/db/schema";
import { adapt } from "../src/server/sources/duke";
import { eq, sql } from "drizzle-orm";
// Use only a dedicated disposable test database, never DATABASE_URL or production.
test(
  "PostgreSQL migrations, duplicate upserts, UUID-preserving reschedules and locking",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const client = postgres(process.env.TEST_DATABASE_URL!, {
      max: 2,
      prepare: false,
    });
    const db = drizzle(client);
    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      await db
        .transaction(async (tx) => {
          const { placeId, ...event } = adapt({
            id: `integration-${crypto.randomUUID()}`,
            summary: "Integration fixture",
            start_timestamp: "2026-11-08T18:00:00Z",
          }).event;
          void placeId;
          const [first] = await tx
            .insert(eventsTable)
            .values(event)
            .returning();
          const [second] = await tx
            .insert(eventsTable)
            .values(event)
            .onConflictDoUpdate({
              target: [
                eventsTable.source,
                eventsTable.sourceEventId,
                eventsTable.startsAt,
              ],
              set: event,
            })
            .returning();
          assert.equal(first.id, second.id);
          assert.equal(
            (
              await tx
                .select()
                .from(eventsTable)
                .where(eq(eventsTable.sourceEventId, event.sourceEventId))
            ).length,
            1,
          );
          const [moved] = await tx
            .update(eventsTable)
            .set({ startsAt: "2026-11-09T18:00:00Z" })
            .where(eq(eventsTable.id, first.id))
            .returning();
          assert.equal(moved.id, first.id);
          const lock = await tx.execute(
            sql`select pg_try_advisory_xact_lock(74190233) as locked`,
          );
          assert.equal(lock[0].locked, true);
          await client.begin(async (other) => {
            const competing =
              await other`select pg_try_advisory_xact_lock(74190233) as locked`;
            assert.equal(competing[0].locked, false);
          });
          throw new Error("ROLLBACK_TEST");
        })
        .catch((e) => {
          if (e.message !== "ROLLBACK_TEST") throw e;
        });
    } finally {
      await client.end();
    }
  },
);

// This suite also rolls back its fixture rows; requires an empty disposable database.
test(
  "canonical seeding preserves slug IDs and backfills source locations without replacing events",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const { placesTable, locationsTable, placementsTable, aliasesTable } =
      await import("../src/server/db/schema");
    const { seedPlaces } = await import("../src/server/sync");
    const { places } = await import("../config/places");
    const client = postgres(process.env.TEST_DATABASE_URL!, {
      max: 1,
      prepare: false,
    });
    const database = drizzle(client);
    try {
      await migrate(database, { migrationsFolder: "drizzle" });
      await database
        .transaction(async (tx) => {
          assert.equal(
            (await tx.select().from(placesTable)).length,
            0,
            "Use an empty disposable test database",
          );
          const perkins = places.find((p) => p.slug === "perkins-library")!,
            persistedId = "22222222-2222-4222-8222-222222222222";
          await tx
            .insert(placesTable)
            .values({
              id: persistedId,
              slug: perkins.slug,
              name: perkins.name,
              kind: perkins.kind,
              reviewStatus: "pending",
            });
          const [location] = await tx
            .insert(locationsTable)
            .values({
              sourceKey: "seed-backfill-test",
              label: "Perkins Library, The Link Classroom 2",
              externalRef: "392",
              matchMethod: "unresolved",
              reviewStatus: "pending",
            })
            .returning();
          const { placeId, ...event } = adapt({
            id: "seed-backfill-event",
            summary: "Database test only",
            start_timestamp: "2026-11-08T18:00:00Z",
          }).event;
          void placeId;
          const [stored] = await tx
            .insert(eventsTable)
            .values({ ...event, sourceLocationId: location.id })
            .returning();
          await seedPlaces(tx);
          const first = await tx.select().from(placesTable),
            firstAliases = await tx.select().from(aliasesTable);
          await seedPlaces(tx);
          const second = await tx.select().from(placesTable);
          assert.equal(second.length, 10);
          assert.deepEqual(
            second.map((p) => p.id).sort(),
            first.map((p) => p.id).sort(),
          );
          assert.equal(
            second.find((p) => p.slug === perkins.slug)?.id,
            persistedId,
          );
          assert.equal((await tx.select().from(placementsTable)).length, 10);
          assert.equal(
            (await tx.select().from(aliasesTable)).length,
            firstAliases.length,
          );
          const [updatedLocation] = await tx
            .select()
            .from(locationsTable)
            .where(eq(locationsTable.id, location.id));
          assert.equal(updatedLocation.placeId, persistedId);
          assert.equal(updatedLocation.reviewStatus, "reviewed");
          const storedEvents = await tx.select().from(eventsTable);
          assert.equal(storedEvents.length, 1);
          assert.equal(storedEvents[0].id, stored.id);
          assert.equal(storedEvents[0].sourceLocationId, location.id);
          const joined = await tx
            .select()
            .from(eventsTable)
            .innerJoin(
              locationsTable,
              eq(eventsTable.sourceLocationId, locationsTable.id),
            )
            .innerJoin(placesTable, eq(locationsTable.placeId, placesTable.id));
          assert.equal(joined.length, 1);
          throw new Error("ROLLBACK_TEST");
        })
        .catch((e) => {
          if (e.message !== "ROLLBACK_TEST") throw e;
        });
    } finally {
      await client.end();
    }
  },
);
