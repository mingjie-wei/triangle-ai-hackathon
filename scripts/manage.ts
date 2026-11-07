import { readFileSync } from "node:fs";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { seed, syncDuke } from "../src/server/sync";
import { close } from "../src/server/db/client";
import { fetchFeed, parseFeed } from "../src/server/sources/duke";
async function main() {
  switch (process.argv[2]) {
    case "migrate": {
      const url =
        process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
      if (!url)
        throw new Error("Set DATABASE_URL or DATABASE_MIGRATION_URL in .env");
      const sql = postgres(url, { max: 1, prepare: false });
      try {
        await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
      } finally {
        await sql.end();
      }
      break;
    }
    case "seed":
      await seed();
      break;
    case "sync":
      console.log(JSON.stringify(await syncDuke(), null, 2));
      break;
    case "inventory": {
      const result = process.argv[3]
        ? parseFeed(JSON.parse(readFileSync(process.argv[3], "utf8")))
        : await fetchFeed();
      const groups = new Map<
        string,
        {
          label: string | null;
          focus: string | null;
          occurrences: number;
          titles: Set<string>;
          review: string;
        }
      >();
      for (const { event, location: l } of result.accepted) {
        const g = groups.get(l.sourceKey) ?? {
          label: l.label,
          focus: l.externalRef,
          occurrences: 0,
          titles: new Set<string>(),
          review: l.reviewStatus,
        };
        g.occurrences++;
        g.titles.add(event.title);
        groups.set(l.sourceKey, g);
      }
      console.log(
        JSON.stringify(
          {
            received: result.received,
            rejected: result.rejected,
            coverage: "unverified",
            locations: [...groups.values()]
              .sort(
                (a, b) =>
                  b.occurrences - a.occurrences ||
                  b.titles.size - a.titles.size,
              )
              .map((g) => ({ ...g, titles: g.titles.size })),
          },
          null,
          2,
        ),
      );
      break;
    }
    default:
      throw new Error("Use migrate, seed, sync, or inventory");
  }
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Command failed");
    process.exitCode = 1;
  })
  .finally(close);
