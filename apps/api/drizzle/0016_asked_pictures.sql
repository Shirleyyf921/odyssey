ALTER TYPE "public"."moment_unlock_source" ADD VALUE 'ASKED' BEFORE 'FREE';--> statement-breakpoint
CREATE TABLE "photo_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scene" text NOT NULL,
	"prompt" text NOT NULL,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"image" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_credits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"remaining" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "look" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "photo_blobs" ADD CONSTRAINT "photo_blobs_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_blobs" ADD CONSTRAINT "photo_blobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_credits" ADD CONSTRAINT "photo_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_blobs_user_idx" ON "photo_blobs" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "moments" ADD CONSTRAINT "moments_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moments_owner_idx" ON "moments" USING btree ("owner_user_id");