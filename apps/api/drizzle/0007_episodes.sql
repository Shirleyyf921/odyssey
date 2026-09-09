CREATE TYPE "public"."beat_kind" AS ENUM('STORY', 'CALL', 'END');--> statement-breakpoint
CREATE TYPE "public"."content_rating" AS ENUM('SFW', 'MATURE');--> statement-breakpoint
CREATE TABLE "beats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" "beat_kind" NOT NULL,
	"brief" text NOT NULL,
	"setting" text,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_beat_id" uuid,
	"photo_moment_id" uuid,
	"call_url" text,
	"call_seconds" integer,
	"hotspots" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"current_beat_id" uuid NOT NULL,
	"path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"premise" text NOT NULL,
	"setting" text NOT NULL,
	"opener" text NOT NULL,
	"scene_id" uuid,
	"rating" "content_rating" DEFAULT 'SFW' NOT NULL,
	"unlock_rule" jsonb NOT NULL,
	"first_beat_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beats" ADD CONSTRAINT "beats_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beats" ADD CONSTRAINT "beats_photo_moment_id_moments_id_fk" FOREIGN KEY ("photo_moment_id") REFERENCES "public"."moments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_runs" ADD CONSTRAINT "episode_runs_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_runs" ADD CONSTRAINT "episode_runs_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "beats_episode_idx" ON "beats" USING btree ("episode_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_runs_relationship_episode_uq" ON "episode_runs" USING btree ("relationship_id","episode_id");--> statement-breakpoint
CREATE INDEX "episodes_character_idx" ON "episodes" USING btree ("character_id","position");