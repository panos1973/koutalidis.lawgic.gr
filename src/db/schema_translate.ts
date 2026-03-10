import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

/**
 * Translation Memory: aligned sentence pairs from EU legal corpora.
 *
 * Sources: DGT, JRC, EURLEX_LEG, EURLEX_JUDG, ELRC_extra
 * Also stored in Weaviate for vector search — this table
 * acts as the canonical flat store.
 */
export const sentences = pgTable(
  'sentences',
  {
    id: serial('id').primaryKey(),
    hash: varchar('hash', { length: 64 }).notNull().unique(),
    lang_src: varchar('lang_src', { length: 10 }).notNull(),
    lang_tgt: varchar('lang_tgt', { length: 10 }).notNull(),
    text_src: text('text_src').notNull(),
    text_tgt: text('text_tgt').notNull(),
    source_corpus: varchar('source_corpus', { length: 50 }).notNull(),
    doc_id: varchar('doc_id', { length: 255 }),
    eurovoc_codes: jsonb('eurovoc_codes').$type<string[]>(),
    date: timestamp('date'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
  },
  (table) => ({
    langSrcTgtIdIdx: index('lang_src_tgt_id_idx').on(
      table.lang_src,
      table.lang_tgt,
      table.id,
    ),
  }),
)

/**
 * Legal terminology from IATE (Inter-Active Terminology for Europe).
 *
 * Each row is a concept with terms in Greek, English, and French.
 * Terms have a status: "preferred", "admitted", "deprecated", etc.
 * Domains are EuroVoc / IATE classification tags.
 */
export const terminology = pgTable('terminology', {
  id: serial('id').primaryKey(),
  concept_id: varchar('concept_id', { length: 255 }).notNull().unique(),
  domains: jsonb('domains').$type<string[]>(),
  reliability: varchar('reliability', { length: 50 }),
  terms: jsonb('terms').$type<{
    el: Array<{ term: string; status: string }>
    en: Array<{ term: string; status: string }>
    fr: Array<{ term: string; status: string }>
  }>(),
})
