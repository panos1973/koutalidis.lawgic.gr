import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── TABULAR REVIEWS ──────────────────────────────────────────────────
// A review is a spreadsheet-like workspace containing documents (rows) and columns
export const tabular_reviews = pgTable('tabular_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  organizationId: text('organization_id'),
  title: text('title').notNull(),
  description: text('description'),
  // Optional link to a project
  projectId: uuid('project_id'),
  status: text('status').default('active'), // 'active' | 'archived'
  language: text('language').default('el'), // 'el' | 'en'
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// ─── TABULAR REVIEW COLUMNS ──────────────────────────────────────────
// Each column is an AI prompt that extracts information from documents
export const tabular_review_columns = pgTable('tabular_review_columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => tabular_reviews.id, { onDelete: 'cascade' }),
  label: text('label').notNull(), // Column header (e.g., "Key Terms", "Warranties")
  prompt: text('prompt').notNull(), // AI extraction prompt
  format: text('format').default('text'), // 'text' | 'date' | 'boolean' | 'number' | 'list'
  sortOrder: integer('sort_order').default(0),
  width: integer('width'), // Column width in pixels (optional)
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// ─── TABULAR REVIEW DOCUMENTS (ROWS) ────────────────────────────────
// Each document uploaded becomes a row in the review
export const tabular_review_documents = pgTable('tabular_review_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => tabular_reviews.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'), // 'pdf', 'docx', etc.
  fileSize: integer('file_size'),
  // The extracted text content of the document
  textContent: text('text_content'),
  // Reference to vault file if uploaded via vault
  vaultFileId: text('vault_file_id'),
  // Storage URL if uploaded directly
  storageUrl: text('storage_url'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// ─── TABULAR REVIEW CELLS ───────────────────────────────────────────
// Each cell is the AI-extracted value for a specific document × column intersection
export const tabular_review_cells = pgTable('tabular_review_cells', {
  id: uuid('id').defaultRandom().primaryKey(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => tabular_reviews.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id')
    .notNull()
    .references(() => tabular_review_documents.id, { onDelete: 'cascade' }),
  columnId: uuid('column_id')
    .notNull()
    .references(() => tabular_review_columns.id, { onDelete: 'cascade' }),
  value: text('value'), // The extracted/generated text
  reasoning: text('reasoning'), // AI reasoning for the extracted value
  sources: text('sources'), // Source passages from the document (JSON array)
  status: text('status').default('pending'), // 'pending' | 'running' | 'completed' | 'error'
  error: text('error'), // Error message if extraction failed
  // Whether the user has manually edited this cell
  isManualEdit: boolean('is_manual_edit').default(false),
  // Review workflow
  isReviewed: boolean('is_reviewed').default(false), // Human-verified
  isLocked: boolean('is_locked').default(false), // Prevent accidental edits
  reviewedBy: text('reviewed_by'), // userId who reviewed
  reviewedAt: timestamp('reviewed_at', { precision: 6, withTimezone: true }),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// ─── RELATIONS ──────────────────────────────────────────────────────
export const tabularReviewRelations = relations(tabular_reviews, ({ many }) => ({
  columns: many(tabular_review_columns),
  documents: many(tabular_review_documents),
  cells: many(tabular_review_cells),
}))

export const tabularReviewColumnRelations = relations(
  tabular_review_columns,
  ({ one, many }) => ({
    review: one(tabular_reviews, {
      fields: [tabular_review_columns.reviewId],
      references: [tabular_reviews.id],
    }),
    cells: many(tabular_review_cells),
  })
)

export const tabularReviewDocumentRelations = relations(
  tabular_review_documents,
  ({ one, many }) => ({
    review: one(tabular_reviews, {
      fields: [tabular_review_documents.reviewId],
      references: [tabular_reviews.id],
    }),
    cells: many(tabular_review_cells),
  })
)

export const tabularReviewCellRelations = relations(
  tabular_review_cells,
  ({ one }) => ({
    review: one(tabular_reviews, {
      fields: [tabular_review_cells.reviewId],
      references: [tabular_reviews.id],
    }),
    document: one(tabular_review_documents, {
      fields: [tabular_review_cells.documentId],
      references: [tabular_review_documents.id],
    }),
    column: one(tabular_review_columns, {
      fields: [tabular_review_cells.columnId],
      references: [tabular_review_columns.id],
    }),
  })
)
