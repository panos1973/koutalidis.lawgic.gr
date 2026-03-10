-- Add source citations, reasoning, and review workflow fields to tabular_review_cells
ALTER TABLE "tabular_review_cells" ADD COLUMN IF NOT EXISTS "reasoning" text;
ALTER TABLE "tabular_review_cells" ADD COLUMN IF NOT EXISTS "sources" text;
ALTER TABLE "tabular_review_cells" ADD COLUMN IF NOT EXISTS "is_reviewed" boolean DEFAULT false;
ALTER TABLE "tabular_review_cells" ADD COLUMN IF NOT EXISTS "is_locked" boolean DEFAULT false;
ALTER TABLE "tabular_review_cells" ADD COLUMN IF NOT EXISTS "reviewed_by" text;
ALTER TABLE "tabular_review_cells" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp(6) with time zone;
