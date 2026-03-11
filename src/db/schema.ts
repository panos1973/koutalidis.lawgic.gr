import { relations } from 'drizzle-orm'
import {
  text,
  pgTable,
  timestamp,
  uuid,
  jsonb,
  vector,
  json,
  numeric,
  boolean,
  integer,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey().unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  userType: text('user_type'),
  profileData: jsonb('profile_data'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  //   done: boolean("done").default(false).notNull(),
})

export const userRelations = relations(users, ({ many }) => ({
  chats: many(chats),
}))

// Users preferences tables
export const user_lawbot_preferences = pgTable('user_lawbot_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  includeGreekLaws: boolean('include_greek_laws').default(true).notNull(),
  preferConciseAnswers: boolean('prefer_concise_answers')
    .default(true)
    .notNull(),
  includeGreekCourtDecisions: boolean('include_greek_court_decisions')
    .default(true)
    .notNull(),
  includeEuropeanLaws: boolean('include_european_laws')
    .default(false)
    .notNull(),
  includeEuropeanCourtDecisions: boolean('include_european_court_decisions')
    .default(false)
    .notNull(),
  includeGreekBibliography: boolean('include_greek_bibliography')
    .default(false)
    .notNull(),
  includeForeignBibliography: boolean('include_foreign_bibliography')
    .default(false)
    .notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

export const user_case_research_preferences = pgTable(
  'user_case_research_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    includeGreekLaws: boolean('include_greek_laws').default(true).notNull(),
    includeGreekCourtDecisions: boolean('include_greek_court_decisions')
      .default(true)
      .notNull(),
    includeEuropeanLaws: boolean('include_european_laws')
      .default(false)
      .notNull(),
    includeEuropeanCourtDecisions: boolean('include_european_court_decisions')
      .default(false)
      .notNull(),
    includeGreekBibliography: boolean('include_greek_bibliography')
      .default(false)
      .notNull(),
    includeForeignBibliography: boolean('include_foreign_bibliography')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
  }
)

export const user_tool_2_preferences = pgTable('user_tool_2_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  includeGreekLaws: boolean('include_greek_laws').default(true).notNull(),
  includeGreekCourtDecisions: boolean('include_greek_court_decisions')
    .default(true)
    .notNull(),
  includeEuropeanLaws: boolean('include_european_laws')
    .default(false)
    .notNull(),
  includeEuropeanCourtDecisions: boolean('include_european_court_decisions')
    .default(false)
    .notNull(),
  includeGreekBibliography: boolean('include_greek_bibliography')
    .default(false)
    .notNull(),
  includeForeignBibliography: boolean('include_foreign_bibliography')
    .default(false)
    .notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

export const user_contract_chat_preferences = pgTable(
  'user_contract_chat_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    includeGreekLaws: boolean('include_greek_laws').default(true).notNull(),
    includeGreekCourtDecisions: boolean('include_greek_court_decisions')
      .default(true)
      .notNull(),
    includeEuropeanLaws: boolean('include_european_laws')
      .default(false)
      .notNull(),
    includeEuropeanCourtDecisions: boolean('include_european_court_decisions')
      .default(false)
      .notNull(),
    includeGreekBibliography: boolean('include_greek_bibliography')
      .default(false)
      .notNull(),
    includeForeignBibliography: boolean('include_foreign_bibliography')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
  }
)

// Athena Chat Tables

export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

export const chatRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
  files: many(chat_files),
  toolFiles: many(toolFiles),
}))

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: text('roles').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  chatId: uuid('chat_id').notNull(),
})

export const chat_files = pgTable('chat_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: numeric('file_size').notNull(),
  file_content: text('file_content').notNull(),
  file_blob: text('file_blob'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  chat_id: uuid('chat_id').notNull(), // Reference to the chats table
})

export const chat_files_collection = pgTable('chat_files_collection', {
  id: uuid('uuid').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  cmetadata: json('cmetadata'),
})

export const chat_files_embedding = pgTable('chat_files_embedding', {
  id: uuid('id').defaultRandom().primaryKey(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  document: text('document').notNull(),
  metadata: jsonb('metadata').notNull(),
  collection_id: uuid('collection_id').notNull(),
})

// Case Research Tables

export const case_study = pgTable('case_study', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

export const case_study_messages = pgTable('case_study_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  case_study_id: uuid('case_study_id').notNull(),
})

export const caseStudyRelations = relations(case_study, ({ many }) => ({
  case_study_messages: many(case_study_messages),
  case_study_files: many(case_study_files),
}))

export const case_study_files = pgTable('case_study_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: numeric('file_size').notNull(),
  file_content: text('file_content').notNull(),
  file_blob: text('file_blob'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  case_study_id: uuid('case_study_id').notNull(),
})

export const case_files_collection = pgTable('case_files_collection', {
  id: uuid('uuid').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  cmetadata: json('cmetadata'),
})

export const case_files_embedding = pgTable('case_files_embedding', {
  id: uuid('id').defaultRandom().primaryKey(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  document: text('document').notNull(),
  metadata: jsonb('metadata').notNull(),
  collection_id: uuid('collection_id').notNull(),
})

// Tool 2 tables
export const tool_2 = pgTable('tool_2', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

export const tool_2_messages = pgTable('tool_2_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  tool_2_id: uuid('tool_2_id').notNull(),
})

export const tool2Relations = relations(tool_2, ({ many }) => ({
  tool_2_messages: many(tool_2_messages),
  tool_2_files: many(tool_2_files),
}))

export const tool_2_files = pgTable('tool_2_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: numeric('file_size').notNull(),
  file_content: text('file_content').notNull(),
  file_blob: text('file_blob'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  tool_2_id: uuid('tool_2_id').notNull(),
})

export const tool_2_collection = pgTable('tool_2_collection', {
  id: uuid('uuid').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  cmetadata: json('cmetadata'),
})

export const tool_2_embedding = pgTable('tool_2_embedding', {
  id: uuid('id').defaultRandom().primaryKey(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  document: text('document').notNull(),
  metadata: jsonb('metadata').notNull(),
  collection_id: uuid('collection_id').notNull(),
})

// Contracts Tables

export const contract = pgTable('contract', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

export const contract_sections = pgTable('contract_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  contractId: text('contract_id').notNull(),
})

export const contract_data_fields = pgTable('contract_data_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  field_name: text('field_name').notNull(),
  field_type: text('field_type').notNull(),
  value: text('value'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  contractId: text('contract_id').notNull(),
})

export const contract_drafts = pgTable('contract_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  draft: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  contractId: text('contract_id').notNull(),
  //   contractSectionIds: text("contract_section_ids").array().notNull(),
})

export const contractAndSectionRelations = relations(contract, ({ many }) => ({
  contract_sections: many(contract_sections),
  contract_data_fields: many(contract_data_fields),
}))

// export const contractSectionAndDraftsRelations = relations(
//   contract_sections,
//   ({ many }) => ({
//     contract_sections_drafts: many(contract_sections_drafts),
//   })
// );

// export const contract_draft = pgTable("contract_draft", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   title: text("title").notNull(),
//   createdAt: timestamp("created_at", {
//     precision: 6,
//     withTimezone: true,
//   }).defaultNow(),
//   userId: text("user_id").notNull(),
// });

// export const contract_chat_messages = pgTable("contract_chat_messages", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   content: text("content").notNull(),
//   role: text("role").notNull(),
//   createdAt: timestamp("created_at", {
//     precision: 6,
//     withTimezone: true,
//   }).defaultNow(),
//   contract_chat_id: uuid("contract_chat_id").notNull(),
// });

// export const contract_draft_messages = pgTable("contract_draft_messages", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   content: text("content").notNull(),
//   role: text("role").notNull(),
//   createdAt: timestamp("created_at", {
//     precision: 6,
//     withTimezone: true,
//   }).defaultNow(),
//   case_study_id: uuid("case_study_id").notNull(),
// });

// export const contract_draft_files = pgTable("contract_draft_files", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   file_name: text("file_name").notNull(),
//   file_path: text("file_path").notNull(),
//   file_type: text("file_type").notNull(),
//   file_size: numeric("file_size").notNull(),
//   file_content: text("file_content").notNull(),
//   createdAt: timestamp("created_at", {
//     precision: 6,
//     withTimezone: true,
//   }).defaultNow(),
//   contract_draft_id: uuid("contract_draft_id").notNull(),
// });

// export const contractChatRelations = relations(contract_chat, ({ many }) => ({
//   contract_chat_messages: many(contract_chat_messages),
//   contract_chat_files: many(contract_chat_files),
// }));

// export const contractDraftRelations = relations(contract_draft, ({ many }) => ({
//   contract_draft_messages: many(contract_draft_messages),
//   contract_draft_files: many(contract_draft_files),
// }));

export const contract_files = pgTable('contract_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: numeric('file_size').notNull(),
  file_content: text('file_content').notNull(),
  file_blob: text('file_blob'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  contract_id: uuid('contract_id').notNull(),
})

// Standard Contracts Tables

export const standard_contract = pgTable('standard_contract', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

export const standard_contract_sections = pgTable(
  'standard_contract_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    standardContractId: text('standard_contract_id').notNull(),
  }
)

export const standard_contract_data_fields = pgTable(
  'standard_contract_data_fields',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    field_name: text('field_name').notNull(),
    field_type: text('field_type').notNull(),
    value: text('value'),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    standardContractId: text('standard_contract_id').notNull(),
  }
)

export const standard_contract_drafts = pgTable('standard_contract_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  draft: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  standardContractId: text('standard_contract_id').notNull(),
})

export const standard_contract_files = pgTable('standard_contract_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: numeric('file_size').notNull(),
  file_content: text('file_content').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  standardContractId: uuid('standard_contract_id').notNull(),
})

export const contract_files_collection = pgTable('contract_files_collection', {
  id: uuid('uuid').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  cmetadata: json('cmetadata'),
})

export const contract_files_embedding = pgTable('contract_files_embedding', {
  id: uuid('id').defaultRandom().primaryKey(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  document: text('document').notNull(),
  metadata: jsonb('metadata').notNull(),
  collection_id: uuid('collection_id').notNull(),
})

// Relations for standard contracts
export const standardContractAndSectionRelations = relations(
  standard_contract,
  ({ many }) => ({
    standard_contract_sections: many(standard_contract_sections),
    standard_contract_data_fields: many(standard_contract_data_fields),
  })
)

export const references = pgTable('references', {
  id: uuid('id').defaultRandom().primaryKey(),
  ref_sequence: text('ref_sequence'),
  pdf_url: text('pdf_url'),
  pdf_page_url: text('pdf_page_url'),
  file_url: text('file_url'),
  source_url: text('source_url'),
  court: text('court'),
  decision_number: text('decision_number'),
  decision_date: text('decision_date'),
  case_type: text('case_type'),
  main_laws: text('main_laws'),
  key_articles: text('key_articles'),
  primary_issue: text('primary_issue'),
  full_text: text('full_text'),
  chatId: uuid('chat_id').notNull(),
  messageId: uuid('message_id').notNull(),
  generated_name: text('generated_name'),
  reference_type: text('reference_type'),
  short_citation: text('short_citation'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

export const temp_references = pgTable('temp_references', {
  id: uuid('id').defaultRandom().primaryKey(),
  ref_sequence: text('ref_sequence'),
  chatId: text('chat_id').notNull(),
  messageId: text('message_id'),
  refs: jsonb('refs').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const chat_summaries = pgTable('chat_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  keyTopics: text('keyTopics').array().notNull(),
  legalContext: text('legalContext').notNull(),
  messageRangeStart: integer('messageRangeStart').notNull(),
  messageRangeEnd: integer('messageRangeEnd').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
})

export const vault_folders = pgTable('vault_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  folderName: text('folderName').notNull(),
  userId: text('userId').notNull(),
  organizationId: text('organizationId'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .defaultNow()
    .notNull(),
  isPrivate: boolean('isPrivate').default(false).notNull(),
  isShared: boolean('isShared').default(false).notNull(),
})
export const vault_folder_sharing = pgTable('vault_folder_sharing', {
  id: uuid('id').primaryKey().defaultRandom(),
  folderId: uuid('folderId')
    .notNull()
    .references(() => vault_folders.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
})

export const vault_files = pgTable('vault_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileName: text('fileName').notNull(),
  storageUrl: text('storageUrl').notNull(),
  fileType: text('fileType').notNull(),
  fileSize: numeric('fileSize').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  folderId: uuid('folderId')
    .notNull()
    .references(() => vault_folders.id, { onDelete: 'cascade' }),
  chunkIds: text('chunkIds').array(),
})

export const vaultFoldersRelations = relations(vault_folders, ({ many }) => ({
  vaultFiles: many(vault_files), // One folder can have many files
  vaultSharing: many(vault_folder_sharing),
}))

export const vaultFilesRelations = relations(vault_files, ({ one }) => ({
  vaultFolder: one(vault_folders, {
    fields: [vault_files.folderId], // Foreign key
    references: [vault_folders.id], // Primary key in vault_folders
  }),
}))

export const vaultFolderSharingRelations = relations(
  vault_folder_sharing,
  ({ one }) => ({
    folder: one(vault_folders, {
      fields: [vault_folder_sharing.folderId],
      references: [vault_folders.id],
    }),
  })
)

// Library Tables
export const library_folders = pgTable('library_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  folderName: text('folderName').notNull(),
  userId: text('userId').notNull(),
  organizationId: text('organizationId'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .defaultNow()
    .notNull(),
  isPrivate: boolean('isPrivate').default(false).notNull(),
  isShared: boolean('isShared').default(false).notNull(),
})

export const library_files = pgTable('library_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileName: text('fileName').notNull(),
  storageUrl: text('storageUrl').notNull(),
  fileType: text('fileType').notNull(),
  fileSize: numeric('fileSize').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  folderId: uuid('folderId')
    .notNull()
    .references(() => library_folders.id, { onDelete: 'cascade' }),
  chunkIds: text('chunkIds').array(),
})

// Library folder sharing table
export const library_folder_sharing = pgTable('library_folder_sharing', {
  id: uuid('id').primaryKey().defaultRandom(),
  folderId: uuid('folderId')
    .notNull()
    .references(() => library_folders.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
})

export const libraryFoldersRelations = relations(
  library_folders,
  ({ many }) => ({
    libraryFiles: many(library_files), // One folder can have many files
    librarySharing: many(library_folder_sharing), // One folder can be shared with many organizations
  })
)

export const libraryFolderSharingRelations = relations(
  library_folder_sharing,
  ({ one }) => ({
    folder: one(library_folders, {
      fields: [library_folder_sharing.folderId],
      references: [library_folders.id],
    }),
  })
)

export const libraryFilesRelations = relations(library_files, ({ one }) => ({
  libraryFolder: one(library_folders, {
    fields: [library_files.folderId], // Foreign key
    references: [library_folders.id], // Primary key in library_folders
  }),
}))

// Enums
export const planTierEnum = pgEnum('plan_tier', [
  'free',
  'starter',
  'plus',
  'pro',
])
export const addonTypeEnum = pgEnum('addon_type', ['messages', 'storage'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'inactive',
  'canceled',
  'expired',
  'past_due',
  'trialing',
  'unpaid',
  'incomplete',
])

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull(),
  monthlyMessageLimit: integer('monthly_message_limit').notNull(),
  monthlyFileUploadLimit: integer('monthly_file_upload_limit').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const addOns = pgTable('add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  // name: text("name").notNull(),
  // description: text("description"),
  // type: addonTypeEnum("type").notNull(),
  // stripePriceId: text("stripe_price_id").notNull(),
  // price: integer("price").notNull(), // in cents
  additionalMessageCount: integer('additional_message_count').default(0),
  additionalFileUploadCount: integer('additional_file_upload_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull(),
  organizationId: text('organization_id').notNull(),
  paymentInterval: text('payment_interval').notNull(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatusEnum('status').default('active').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// User add-ons junction table
export const userAddOns = pgTable('user_add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  addOnId: uuid('add_on_id')
    .notNull()
    .references(() => addOns.id),
  quantity: integer('quantity').default(1).notNull(),
  expiresAt: timestamp('expires_at'),
  // Auto-renewal fields
  autoRenewal: boolean('auto_renewal').default(false).notNull(),
  renewalDate: timestamp('renewal_date'),
  renewalInterval: text('renewal_interval').default('monthly'), // monthly, yearly
  lastRenewalDate: timestamp('last_renewal_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Usage tracking table
export const usage = pgTable(
  'usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    messagesSent: integer('messages_sent').default(0).notNull(),
    pagesUploaded: integer('pages_uploaded').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      // Unique constraint for subscription per period
      subscriptionPeriodUnique: unique().on(
        table.subscriptionId,
        table.periodStart
      ),
    }
  }
)

// Usage logs for detailed tracking
export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  userId: text('user_id'),
  type: addonTypeEnum('type').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Payment history
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  amount: integer('amount').notNull(), // in cents
  currency: text('currency').default('EUR').notNull(),
  stripePaymentId: text('stripe_payment_id'),
  stripeInvoiceId: text('stripe_invoice_id'),
  stripeInvoiceUrl: text('stripe_invoice_url'),
  status: text('status').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const organizationPlans = pgTable('organization_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  monthlyMessageLimit: integer('monthly_message_limit').notNull(),
  monthlyFileUploadLimit: integer('monthly_file_upload_limit').notNull(),
  paymentInterval: text('payment_interval').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Organization plans relations
export const organizationPlansRelations = relations(
  organizationPlans,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationPlans.organizationId],
      references: [organizations.id],
    }),
    // plan: one(plans, {
    //   fields: [organizationPlans.planId],
    //   references: [plans.id],
    // }),
  })
)

// Plans relations
export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}))

// Subscriptions relations
export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    plan: one(plans, {
      fields: [subscriptions.planId],
      references: [plans.id],
    }),
    usagePeriods: many(usage),
    usageLogs: many(usageLogs),
    payments: many(payments),
    userAddOns: many(userAddOns),
  })
)

// Add-ons relations
export const addOnsRelations = relations(addOns, ({ many }) => ({
  userAddOns: many(userAddOns),
}))

// User add-ons relations
export const userAddOnsRelations = relations(userAddOns, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [userAddOns.subscriptionId],
    references: [subscriptions.id],
  }),
  addOn: one(addOns, {
    fields: [userAddOns.addOnId],
    references: [addOns.id],
  }),
}))

// ─── TRANSLATION HISTORY ──────────────────────────────────────────────
export const translations = pgTable('translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  sourceLang: text('source_lang').notNull(),
  targetLang: text('target_lang').notNull(),
  domain: text('domain'),
  paragraphCount: integer('paragraph_count'),
  sourcePreview: text('source_preview'), // First ~200 chars of source
  translatedPreview: text('translated_preview'), // First ~200 chars of translation
  sourceText: text('source_text'), // Full source (for text mode)
  translatedText: text('translated_text'), // Full translation (for text mode)
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// Usage relations
export const usageRelations = relations(usage, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [usage.subscriptionId],
    references: [subscriptions.id],
  }),
}))

// Usage logs relations
export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [usageLogs.subscriptionId],
    references: [subscriptions.id],
  }),
}))

// Payments relations
export const paymentsRelations = relations(payments, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}))

// Contract comparison tables
export const contract_comparison = pgTable('contract_comparison', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

export const contract_comparison_messages = pgTable(
  'contract_comparison_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    contract_comparison_id: uuid('contract_comparison_id').notNull(),
  }
)

export const contract_comparison_files = pgTable('contract_comparison_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: text('file_size').notNull(),
  file_content: text('file_content').notNull(),
  file_blob: text('file_blob'),
  storageUrl: text('storage_url'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  contractComparisonId: uuid('contract_comparison_id').notNull(),
  vaultFileId: uuid('vault_file_id').notNull(),
})

// Relations for contract comparison
export const contractComparisonRelations = relations(
  contract_comparison,
  ({ many }) => ({
    contract_comparison_messages: many(contract_comparison_messages),
    contract_comparison_files: many(contract_comparison_files),
  })
)

// User preferences for contract comparison
export const user_contract_comparison_preferences = pgTable(
  'user_contract_comparison_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    includeGreekLaws: boolean('include_greek_laws').default(true).notNull(),
    includeGreekCourtDecisions: boolean('include_greek_court_decisions')
      .default(true)
      .notNull(),
    includeEuropeanLaws: boolean('include_european_laws')
      .default(false)
      .notNull(),
    includeEuropeanCourtDecisions: boolean('include_european_court_decisions')
      .default(false)
      .notNull(),
    includeGreekBibliography: boolean('include_greek_bibliography')
      .default(false)
      .notNull(),
    includeForeignBibliography: boolean('include_foreign_bibliography')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
  }
)

// Document Creation preferences table
export const user_document_creation_preferences = pgTable(
  'user_document_creation_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    includeGreekLaws: boolean('include_greek_laws').default(true).notNull(),
    includeGreekCourtDecisions: boolean('include_greek_court_decisions')
      .default(true)
      .notNull(),
    includeEuropeanLaws: boolean('include_european_laws')
      .default(false)
      .notNull(),
    includeEuropeanCourtDecisions: boolean('include_european_court_decisions')
      .default(false)
      .notNull(),
    includeGreekBibliography: boolean('include_greek_bibliography')
      .default(false)
      .notNull(),
    includeForeignBibliography: boolean('include_foreign_bibliography')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
  }
)

// Document Creation main table
export const document_creation = pgTable('document_creation', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  userId: text('user_id').notNull(),
  note: text('note').default(''),
})

// Document Creation messages table
export const document_creation_messages = pgTable(
  'document_creation_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    document_creation_id: uuid('document_creation_id').notNull(),
  }
)

// Document Creation files table
export const document_creation_files = pgTable('document_creation_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: numeric('file_size').notNull(),
  file_content: text('file_content').notNull(),
  file_blob: text('file_blob'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  document_creation_id: uuid('document_creation_id').notNull(),
})

// Document Creation collections table for embeddings
export const document_creation_files_collection = pgTable(
  'document_creation_files_collection',
  {
    id: uuid('uuid').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', {
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
    cmetadata: json('cmetadata'),
  }
)

// Document Creation embeddings table
export const document_creation_files_embedding = pgTable(
  'document_creation_files_embedding',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    document: text('document').notNull(),
    metadata: jsonb('metadata').notNull(),
    collection_id: uuid('collection_id').notNull(),
  }
)

// Relations for document creation
export const documentCreationRelations = relations(
  document_creation,
  ({ many }) => ({
    document_creation_messages: many(document_creation_messages),
    document_creation_files: many(document_creation_files),
  })
)

// Tool file source enum
export const toolFileSourceEnum = pgEnum('tool_file_source', [
  'library',
  'vault',
  'upload', // for drag and drop files
])

// Tool name enum
export const toolNameEnum = pgEnum('tool_name', [
  'lawbot',
  'case_study',
  'contract_comparison',
  'contract',
  'document_creation',
])

// Organization status enum
export const organizationStatusEnum = pgEnum('organization_status', [
  'pending',
  'approved',
  'rejected',
])

// Organizations table
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: organizationStatusEnum('status').default('pending').notNull(),
  // Business identification
  taxId: text('tax_id'),
  vatNumber: text('vat_number'),
  registrationNumber: text('registration_number'),
  // Address information
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  // Contact information
  email: text('email'),
  phone: text('phone'),

  // Original fields
  paymentProofUrl: text('payment_proof_url'),
  rejectionReason: text('rejection_reason'),
  createdById: text('created_by_id').notNull(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  paymentInterval: text('payment_interval'),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// Organization members table
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role').default('member').notNull(), // admin, member
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// Tool Files table
export const toolFiles = pgTable('tool_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  toolName: toolNameEnum('tool_name').notNull(),
  fileSource: toolFileSourceEnum('file_source').notNull(),
  chatId: uuid('chat_id').notNull(),
  fileId: uuid('file_id').notNull(), // References vault_files.id or library_files.id or uploaded file id
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// Relations
export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    // createdBy: one(users, {
    //   fields: [organizations.createdById],
    //   references: [users.id],
    // }),
    plan: one(plans, {
      fields: [organizations.planId],
      references: [plans.id],
    }),
    subscription: one(subscriptions, {
      fields: [organizations.subscriptionId],
      references: [subscriptions.id],
    }),
    members: many(organizationMembers),
  })
)

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  })
)

// Tool Files relations
export const toolFilesRelations = relations(toolFiles, ({ one }) => ({
  chat: one(chats, {
    fields: [toolFiles.chatId],
    references: [chats.id],
  }),
}))

// ─── TRANSLATION JOBS (background processing) ──────────────────────
export const translationJobStatusEnum = pgEnum('translation_job_status', [
  'pending',
  'preparing',
  'translating',
  'building',
  'completed',
  'failed',
])

export const translationJobs = pgTable('translation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  status: translationJobStatusEnum('status').notNull().default('pending'),

  // Input
  sourceText: text('source_text'),
  sourceLang: text('source_lang').notNull(),
  targetLang: text('target_lang').notNull(),

  // DOCX mode
  isDocx: boolean('is_docx').notNull().default(false),
  docxBase64: text('docx_base64'),
  docxFileName: text('docx_file_name'),

  // Prepare phase results
  paragraphs: jsonb('paragraphs').$type<string[]>(),
  domain: jsonb('domain').$type<{ primaryDomain: string; secondaryDomain: string | null; confidence?: string }>(),
  terminology: jsonb('terminology'),
  batchRanges: jsonb('batch_ranges').$type<Array<[number, number]>>(),
  totalBatches: integer('total_batches'),

  // Translation progress
  completedBatches: integer('completed_batches').notNull().default(0),
  translatedParagraphs: jsonb('translated_paragraphs').$type<string[]>(),

  // Result
  translatedText: text('translated_text'),
  translatedDocxBase64: text('translated_docx_base64'),
  translationId: uuid('translation_id'),

  // Error handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),

  // Timing
  lastActivityAt: timestamp('last_activity_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow().notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', {
    precision: 6,
    withTimezone: true,
  }),
})

// ─── TABULAR REVIEW ─────────────────────────────────────────────────
export {
  tabular_reviews,
  tabular_review_columns,
  tabular_review_documents,
  tabular_review_cells,
  tabularReviewRelations,
  tabularReviewColumnRelations,
  tabularReviewDocumentRelations,
  tabularReviewCellRelations,
} from './schema_tabular_review'
