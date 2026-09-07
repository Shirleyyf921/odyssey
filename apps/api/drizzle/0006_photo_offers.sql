ALTER TABLE "messages" ADD COLUMN "moment_id" uuid;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN "teaser_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE set null ON UPDATE no action;