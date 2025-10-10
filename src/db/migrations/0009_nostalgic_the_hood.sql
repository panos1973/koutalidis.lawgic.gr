ALTER TABLE "user_add_ons" ADD COLUMN "auto_renewal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_add_ons" ADD COLUMN "renewal_date" timestamp;--> statement-breakpoint
ALTER TABLE "user_add_ons" ADD COLUMN "renewal_interval" text DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "user_add_ons" ADD COLUMN "last_renewal_date" timestamp;--> statement-breakpoint
ALTER TABLE "user_add_ons" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;