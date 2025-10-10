ALTER TABLE "plans" ADD COLUMN "clerk_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "monthly_price";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "yearly_price";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "features";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "features_greek";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "stripe_price_id_monthly";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN IF EXISTS "stripe_price_id_yearly";