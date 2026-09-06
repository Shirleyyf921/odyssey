CREATE TYPE "public"."billing_environment" AS ENUM('SANDBOX', 'PRODUCTION');--> statement-breakpoint
CREATE TYPE "public"."store" AS ENUM('APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL', 'AMAZON', 'MAC_APP_STORE', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"store" "store" NOT NULL,
	"environment" "billing_environment" NOT NULL,
	"store_transaction_id" text NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	"rc_app_user_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement" text NOT NULL,
	"product_id" text NOT NULL,
	"store" "store" NOT NULL,
	"environment" "billing_environment" NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"billing_issue_at" timestamp with time zone,
	"rc_app_user_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_store_transaction_uq" ON "purchases" USING btree ("store_transaction_id");--> statement-breakpoint
CREATE INDEX "purchases_user_idx" ON "purchases" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_entitlement_uq" ON "subscriptions" USING btree ("user_id","entitlement");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");