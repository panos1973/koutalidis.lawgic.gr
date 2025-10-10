// Schema additions for contract comparison feature

import { relations } from "drizzle-orm";
import { text, pgTable, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// Contract comparison tables
export const contract_comparison = pgTable("contract_comparison", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text("user_id").notNull(),
  note: text("note").default(""),
});

export const contract_comparison_messages = pgTable(
  "contract_comparison_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    contract_comparison_id: uuid("contract_comparison_id").notNull(),
  }
);

export const contract_comparison_files = pgTable("contract_comparison_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  file_name: text("file_name").notNull(),
  file_path: text("file_path").notNull(),
  file_type: text("file_type").notNull(),
  file_size: text("file_size").notNull(),
  file_content: text("file_content").notNull(),
  file_blob: text("file_blob"),
  storageUrl: text("storage_url"),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  contract_comparison_id: uuid("contract_comparison_id").notNull(),
});

// Relations for contract comparison
export const contractComparisonRelations = relations(
  contract_comparison,
  ({ many }) => ({
    contract_comparison_messages: many(contract_comparison_messages),
    contract_comparison_files: many(contract_comparison_files),
  })
);

// User preferences for contract comparison
export const user_contract_comparison_preferences = pgTable(
  "user_contract_comparison_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    includeGreekLaws: text("include_greek_laws").default("true").notNull(),
    includeGreekCourtDecisions: text("include_greek_court_decisions")
      .default("true")
      .notNull(),
    includeEuropeanLaws: text("include_european_laws")
      .default("false")
      .notNull(),
    includeEuropeanCourtDecisions: text("include_european_court_decisions")
      .default("false")
      .notNull(),
    includeGreekBibliography: text("include_greek_bibliography")
      .default("false")
      .notNull(),
    includeForeignBibliography: text("include_foreign_bibliography")
      .default("false")
      .notNull(),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
  }
);
