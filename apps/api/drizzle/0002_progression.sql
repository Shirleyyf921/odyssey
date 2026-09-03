CREATE TABLE "relationship_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "active_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "last_active_date" text;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "message_gains_today" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "fact_gains_today" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "stage_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "relationship_events" ADD CONSTRAINT "relationship_events_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "relationship_events_relationship_idx" ON "relationship_events" USING btree ("relationship_id","created_at");