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
