CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"title" text NOT NULL,
	"setting" text NOT NULL,
	"opener" text NOT NULL,
	"backdrop_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "scene_id" uuid;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scenes_character_idx" ON "scenes" USING btree ("character_id","position");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;