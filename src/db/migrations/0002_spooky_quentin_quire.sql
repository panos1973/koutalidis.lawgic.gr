ALTER TABLE "add_ons" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "add_ons" DROP COLUMN IF EXISTS "description";--> statement-breakpoint
ALTER TABLE "add_ons" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "add_ons" DROP COLUMN IF EXISTS "stripe_price_id";--> statement-breakpoint
ALTER TABLE "add_ons" DROP COLUMN IF EXISTS "price";--> statement-breakpoint
ALTER TABLE "add_ons" DROP COLUMN IF EXISTS "is_active";