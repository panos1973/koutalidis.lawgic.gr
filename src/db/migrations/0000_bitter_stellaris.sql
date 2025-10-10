DO $$ BEGIN
 CREATE TYPE "public"."addon_type" AS ENUM('messages', 'storage');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."organization_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."plan_tier" AS ENUM('free', 'starter', 'plus', 'pro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('active', 'inactive', 'canceled', 'expired', 'past_due', 'trialing', 'unpaid', 'incomplete');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "add_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "addon_type" NOT NULL,
	"stripe_price_id" text NOT NULL,
	"price" integer NOT NULL,
	"additional_message_count" integer DEFAULT 0,
	"additional_file_upload_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_files_collection" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"cmetadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_files_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"document" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"collection_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_study" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_study_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric NOT NULL,
	"file_content" text NOT NULL,
	"file_blob" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"case_study_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_study_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"case_study_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric NOT NULL,
	"file_content" text NOT NULL,
	"file_blob" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"chat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_files_collection" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"cmetadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_files_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"document" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"collection_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"summary" text NOT NULL,
	"keyTopics" text[] NOT NULL,
	"legalContext" text NOT NULL,
	"messageRangeStart" integer NOT NULL,
	"messageRangeEnd" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_comparison" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_comparison_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" text NOT NULL,
	"file_content" text NOT NULL,
	"file_blob" text,
	"storage_url" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"contract_comparison_id" uuid NOT NULL,
	"vault_file_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_comparison_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"contract_comparison_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_data_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text NOT NULL,
	"value" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"contract_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"contract_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric NOT NULL,
	"file_content" text NOT NULL,
	"file_blob" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"contract_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_files_collection" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"cmetadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_files_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"document" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"collection_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"contract_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileName" text NOT NULL,
	"storageUrl" text NOT NULL,
	"fileType" text NOT NULL,
	"fileSize" numeric NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"folderId" uuid NOT NULL,
	"chunkIds" text[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_folder_sharing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folderId" uuid NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folderName" text NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"isShared" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roles" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"chat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"monthly_message_limit" integer NOT NULL,
	"monthly_file_upload_limit" integer NOT NULL,
	"payment_interval" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "organization_status" DEFAULT 'pending' NOT NULL,
	"tax_id" text,
	"vat_number" text,
	"registration_number" text,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"email" text,
	"phone" text,
	"payment_proof_url" text,
	"rejection_reason" text,
	"created_by_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"subscription_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"payment_interval" text,
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"stripe_payment_id" text,
	"stripe_invoice_id" text,
	"stripe_invoice_url" text,
	"status" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "plan_tier" NOT NULL,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer NOT NULL,
	"monthly_message_limit" integer NOT NULL,
	"monthly_file_upload_limit" integer NOT NULL,
	"features" jsonb,
	"features_greek" jsonb,
	"stripe_price_id_monthly" text NOT NULL,
	"stripe_price_id_yearly" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_sequence" text,
	"pdf_url" text,
	"court" text,
	"decision_number" text,
	"decision_date" text,
	"case_type" text,
	"main_laws" text,
	"key_articles" text,
	"primary_issue" text,
	"full_text" text,
	"chat_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"generated_name" text,
	"reference_type" text,
	"short_citation" text,
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_contract_data_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text NOT NULL,
	"value" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"standard_contract_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_contract_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"standard_contract_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_contract_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric NOT NULL,
	"file_content" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"standard_contract_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_contract_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"standard_contract_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"payment_interval" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "temp_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_sequence" text,
	"chat_id" text NOT NULL,
	"message_id" text,
	"refs" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"user_id" text NOT NULL,
	"note" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_2_collection" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"cmetadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_2_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"document" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"collection_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_2_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric NOT NULL,
	"file_content" text NOT NULL,
	"file_blob" text,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"tool_2_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_2_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"tool_2_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"pages_uploaded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"user_id" text,
	"type" "addon_type" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_add_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"add_on_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_case_research_preferences" (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_contract_chat_preferences" (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_contract_comparison_preferences" (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_lawbot_preferences" (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tool_2_preferences" (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"user_type" text,
	"profile_data" jsonb,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	CONSTRAINT "users_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vault_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileName" text NOT NULL,
	"storageUrl" text NOT NULL,
	"fileType" text NOT NULL,
	"fileSize" numeric NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"folderId" uuid NOT NULL,
	"chunkIds" text[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vault_folder_sharing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folderId" uuid NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vault_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folderName" text NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"isShared" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_summaries" ADD CONSTRAINT "chat_summaries_chatId_chats_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_files" ADD CONSTRAINT "library_files_folderId_library_folders_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."library_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_folder_sharing" ADD CONSTRAINT "library_folder_sharing_folderId_library_folders_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."library_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage" ADD CONSTRAINT "usage_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_add_ons" ADD CONSTRAINT "user_add_ons_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_add_ons" ADD CONSTRAINT "user_add_ons_add_on_id_add_ons_id_fk" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vault_files" ADD CONSTRAINT "vault_files_folderId_vault_folders_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."vault_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vault_folder_sharing" ADD CONSTRAINT "vault_folder_sharing_folderId_vault_folders_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."vault_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
