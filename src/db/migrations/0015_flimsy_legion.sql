DO $$ BEGIN
 CREATE TYPE "public"."translation_job_status" AS ENUM('pending', 'preparing', 'translating', 'building', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabular_review_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"value" text,
	"reasoning" text,
	"sources" text,
	"status" text DEFAULT 'pending',
	"error" text,
	"is_manual_edit" boolean DEFAULT false,
	"is_reviewed" boolean DEFAULT false,
	"is_locked" boolean DEFAULT false,
	"reviewed_by" text,
	"reviewed_at" timestamp (6) with time zone,
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabular_review_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"label" text NOT NULL,
	"prompt" text NOT NULL,
	"format" text DEFAULT 'text',
	"sort_order" integer DEFAULT 0,
	"width" integer,
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabular_review_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"file_size" integer,
	"text_content" text,
	"vault_file_id" text,
	"storage_url" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabular_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text NOT NULL,
	"description" text,
	"project_id" uuid,
	"status" text DEFAULT 'active',
	"language" text DEFAULT 'el',
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "translation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "translation_job_status" DEFAULT 'pending' NOT NULL,
	"source_text" text,
	"source_lang" text NOT NULL,
	"target_lang" text NOT NULL,
	"is_docx" boolean DEFAULT false NOT NULL,
	"docx_base64" text,
	"docx_file_name" text,
	"paragraphs" jsonb,
	"domain" jsonb,
	"terminology" jsonb,
	"batch_ranges" jsonb,
	"total_batches" integer,
	"completed_batches" integer DEFAULT 0 NOT NULL,
	"translated_paragraphs" jsonb,
	"translated_text" text,
	"translated_docx_base64" text,
	"translation_id" uuid,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source_lang" text NOT NULL,
	"target_lang" text NOT NULL,
	"domain" text,
	"paragraph_count" integer,
	"source_preview" text,
	"translated_preview" text,
	"source_text" text,
	"translated_text" text,
	"user_id" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabular_review_cells" ADD CONSTRAINT "tabular_review_cells_review_id_tabular_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."tabular_reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabular_review_cells" ADD CONSTRAINT "tabular_review_cells_document_id_tabular_review_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tabular_review_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabular_review_cells" ADD CONSTRAINT "tabular_review_cells_column_id_tabular_review_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."tabular_review_columns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabular_review_columns" ADD CONSTRAINT "tabular_review_columns_review_id_tabular_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."tabular_reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabular_review_documents" ADD CONSTRAINT "tabular_review_documents_review_id_tabular_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."tabular_reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
