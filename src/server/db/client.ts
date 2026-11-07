import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
let client: ReturnType<typeof postgres> | undefined;
export function connection() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return (client ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  }));
}
export function db() {
  return drizzle(connection());
}
export async function close() {
  await client?.end();
  client = undefined;
}
