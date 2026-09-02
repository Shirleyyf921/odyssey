ALTER TABLE "memories" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "summary_through_message_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "device_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_device_id_uq" ON "users" USING btree ("device_id");