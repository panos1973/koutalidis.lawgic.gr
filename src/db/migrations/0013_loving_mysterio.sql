ALTER TYPE "tool_name" ADD VALUE 'document_creation';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_creation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_creation_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric NOT NULL,
	"file_content" text NOT NULL,
	"file_blob" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"document_creation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_creation_files_collection" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"cmetadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_creation_files_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"document" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"collection_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_creation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"document_creation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_document_creation_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"include_greek_laws" boolean DEFAULT true NOT NULL,
	"include_greek_court_decisions" boolean DEFAULT true NOT NULL,
	"include_european_laws" boolean DEFAULT false NOT NULL,
	"include_european_court_decisions" boolean DEFAULT false NOT NULL,
	"include_greek_bibliography" boolean DEFAULT false NOT NULL,
	"include_foreign_bibliography" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
