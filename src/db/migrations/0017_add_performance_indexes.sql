-- Performance indexes for 50+ concurrent users.
-- These cover the most frequently queried columns in WHERE and ORDER BY clauses.
-- All use IF NOT EXISTS so they are safe to re-run.

-- ═══════════════════════════════════════════════════════════
-- CHAT tables (highest traffic)
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "chats_user_id_created_at_idx"
  ON "chats" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_chat_id_created_at_idx"
  ON "messages" ("chat_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_files_chat_id_idx"
  ON "chat_files" ("chat_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_summaries_chat_id_idx"
  ON "chat_summaries" ("chatId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "references_chat_id_idx"
  ON "references" ("chat_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "temp_references_chat_id_status_idx"
  ON "temp_references" ("chat_id", "status");

-- ═══════════════════════════════════════════════════════════
-- CASE STUDY tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "case_study_user_id_created_at_idx"
  ON "case_study" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "case_study_messages_case_study_id_idx"
  ON "case_study_messages" ("case_study_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "case_study_files_case_study_id_idx"
  ON "case_study_files" ("case_study_id");

-- ═══════════════════════════════════════════════════════════
-- TOOL 2 tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tool_2_user_id_created_at_idx"
  ON "tool_2" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "tool_2_messages_tool_2_id_idx"
  ON "tool_2_messages" ("tool_2_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "tool_2_files_tool_2_id_idx"
  ON "tool_2_files" ("tool_2_id");

-- ═══════════════════════════════════════════════════════════
-- CONTRACT tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_user_id_created_at_idx"
  ON "contract" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_sections_contract_id_idx"
  ON "contract_sections" ("contract_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_data_fields_contract_id_idx"
  ON "contract_data_fields" ("contract_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_drafts_contract_id_idx"
  ON "contract_drafts" ("contract_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_files_contract_id_idx"
  ON "contract_files" ("contract_id");

-- ═══════════════════════════════════════════════════════════
-- STANDARD CONTRACT tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "standard_contract_user_id_created_at_idx"
  ON "standard_contract" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "standard_contract_sections_contract_id_idx"
  ON "standard_contract_sections" ("standard_contract_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "standard_contract_data_fields_contract_id_idx"
  ON "standard_contract_data_fields" ("standard_contract_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "standard_contract_drafts_contract_id_idx"
  ON "standard_contract_drafts" ("standard_contract_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "standard_contract_files_contract_id_idx"
  ON "standard_contract_files" ("standard_contract_id");

-- ═══════════════════════════════════════════════════════════
-- CONTRACT COMPARISON tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_comparison_user_id_created_at_idx"
  ON "contract_comparison" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_comparison_messages_cc_id_idx"
  ON "contract_comparison_messages" ("contract_comparison_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contract_comparison_files_cc_id_idx"
  ON "contract_comparison_files" ("contract_comparison_id");

-- ═══════════════════════════════════════════════════════════
-- DOCUMENT CREATION tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "document_creation_user_id_created_at_idx"
  ON "document_creation" ("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "document_creation_messages_dc_id_idx"
  ON "document_creation_messages" ("document_creation_id", "created_at" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "document_creation_files_dc_id_idx"
  ON "document_creation_files" ("document_creation_id");

-- ═══════════════════════════════════════════════════════════
-- VAULT & LIBRARY
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "vault_folders_user_id_idx"
  ON "vault_folders" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "vault_files_folder_id_idx"
  ON "vault_files" ("folderId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "library_folders_user_id_idx"
  ON "library_folders" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "library_files_folder_id_idx"
  ON "library_files" ("folderId");

-- ═══════════════════════════════════════════════════════════
-- SUBSCRIPTIONS & USAGE
-- ═══════════════════════════════════════════════════════════
CREATE INDEX CONCURRENTLY IF NOT EXISTS "subscriptions_clerk_user_id_idx"
  ON "subscriptions" ("clerk_user_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "usage_subscription_id_period_idx"
  ON "usage" ("subscription_id", "period_start");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "usage_logs_subscription_id_idx"
  ON "usage_logs" ("subscription_id");
