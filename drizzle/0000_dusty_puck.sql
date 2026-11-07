CREATE TABLE "place_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"scope" text DEFAULT 'duke' NOT NULL,
	"place_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'duke' NOT NULL,
	"source_event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean NOT NULL,
	"status" text,
	"source_location_id" uuid,
	"location_label" text,
	"location_kind" text NOT NULL,
	"source_url" text,
	"organizer_url" text,
	"categories" text[] NOT NULL,
	"sponsor" text,
	"last_seen_at" timestamp with time zone NOT NULL,
	"superseded" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'duke' NOT NULL,
	"source_key" text NOT NULL,
	"external_ref" text,
	"label" text,
	"link" text,
	"place_id" uuid,
	"match_method" text NOT NULL,
	"review_status" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "source_locations_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "map_placements" (
	"place_id" uuid NOT NULL,
	"map_id" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"campus" text DEFAULT 'Duke' NOT NULL,
	"description" text,
	"official_map_url" text,
	"review_status" text DEFAULT 'reviewed' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'duke' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"state" text NOT NULL,
	"report" jsonb,
	"schema_version" text DEFAULT '1' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_aliases" ADD CONSTRAINT "place_aliases_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_location_id_source_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."source_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_locations" ADD CONSTRAINT "source_locations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_placements" ADD CONSTRAINT "map_placements_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alias_scope" ON "place_aliases" USING btree ("alias","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "event_occurrence" ON "events" USING btree ("source","source_event_id","starts_at");--> statement-breakpoint
CREATE INDEX "event_start" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "event_end" ON "events" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "event_location" ON "events" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "location_place" ON "source_locations" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_map" ON "map_placements" USING btree ("place_id","map_id");