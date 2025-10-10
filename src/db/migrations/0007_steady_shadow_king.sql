DO $$ BEGIN
 CREATE TYPE "public"."tool_file_source" AS ENUM('library', 'vault', 'upload');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tool_name" AS ENUM('lawbot', 'case_study', 'contract_comparison');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" "tool_name" NOT NULL,
	"file_source" "tool_file_source" NOT NULL,
	"chat_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
