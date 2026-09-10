CREATE TYPE "public"."episode_origin" AS ENUM('OFFICIAL', 'UGC');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('DRAFT', 'SUBMITTED', 'LIVE', 'REJECTED', 'UNLISTED', 'REMOVED');--> statement-breakpoint
CREATE TABLE "episode_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_runs" ADD COLUMN "episode_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "origin" "episode_origin" DEFAULT 'OFFICIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "status" "episode_status" DEFAULT 'LIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "report_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "episode_reports" ADD CONSTRAINT "episode_reports_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_reports" ADD CONSTRAINT "episode_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episode_reports_episode_reporter_uq" ON "episode_reports" USING btree ("episode_id","reporter_id");--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episodes_author_idx" ON "episodes" USING btree ("author_id");