import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  doublePrecision,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });
export const placesTable = pgTable("places", {
  id: uuid("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  campus: text("campus").notNull().default("Duke"),
  description: text("description"),
  officialMapUrl: text("official_map_url"),
  reviewStatus: text("review_status").notNull().default("reviewed"),
  updatedAt: time("updated_at").defaultNow(),
});
export const aliasesTable = pgTable(
  "place_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alias: text("alias").notNull(),
    scope: text("scope").notNull().default("duke"),
    placeId: uuid("place_id")
      .notNull()
      .references(() => placesTable.id),
  },
  (t) => [uniqueIndex("alias_scope").on(t.alias, t.scope)],
);
export const placementsTable = pgTable(
  "map_placements",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => placesTable.id),
    mapId: text("map_id").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    visible: boolean("visible").notNull().default(true),
  },
  (t) => [uniqueIndex("place_map").on(t.placeId, t.mapId)],
);
export const locationsTable = pgTable(
  "source_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull().default("duke"),
    sourceKey: text("source_key").notNull().unique(),
    externalRef: text("external_ref"),
    label: text("label"),
    link: text("link"),
    placeId: uuid("place_id").references(() => placesTable.id),
    matchMethod: text("match_method").notNull(),
    reviewStatus: text("review_status").notNull(),
    firstSeenAt: time("first_seen_at").defaultNow(),
    lastSeenAt: time("last_seen_at").defaultNow(),
  },
  (t) => [index("location_place").on(t.placeId)],
);
export const eventsTable = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull().default("duke"),
    sourceEventId: text("source_event_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at"),
    allDay: boolean("all_day").notNull(),
    status: text("status"),
    sourceLocationId: uuid("source_location_id").references(
      () => locationsTable.id,
    ),
    locationLabel: text("location_label"),
    locationKind: text("location_kind").notNull(),
    sourceUrl: text("source_url"),
    organizerUrl: text("organizer_url"),
    categories: text("categories").array().notNull(),
    sponsor: text("sponsor"),
    lastSeenAt: time("last_seen_at").notNull(),
    superseded: boolean("superseded").notNull().default(false),
  },
  (t) => [
    uniqueIndex("event_occurrence").on(t.source, t.sourceEventId, t.startsAt),
    index("event_start").on(t.startsAt),
    index("event_end").on(t.endsAt),
    index("event_location").on(t.sourceLocationId),
  ],
);
export const syncRunsTable = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull().default("duke"),
  startedAt: time("started_at").defaultNow(),
  finishedAt: time("finished_at"),
  state: text("state").notNull(),
  report: jsonb("report"),
  schemaVersion: text("schema_version").notNull().default("1"),
});
