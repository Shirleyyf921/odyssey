CREATE TABLE "creator_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_credits" ADD CONSTRAINT "creator_credits_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_credits" ADD CONSTRAINT "creator_credits_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_credits" ADD CONSTRAINT "creator_credits_run_id_episode_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."episode_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_credits_run_uq" ON "creator_credits" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "creator_credits_author_idx" ON "creator_credits" USING btree ("author_id","created_at");