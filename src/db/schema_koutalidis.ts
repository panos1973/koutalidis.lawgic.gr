import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── PROJECTS ──────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  clientName: text('client_name'),
  description: text('description'),
  practiceAreas: jsonb('practice_areas').$type<string[]>().default([]),
  status: text('status').default('active'), // 'active' | 'archived' | 'completed'
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// ─── PRACTICE AREAS ────────────────────────────────────────────────────
export const practice_areas = pgTable('practice_areas', {
  id: text('id').primaryKey(), // 'banking', 'ma', 'energy', etc.
  name: text('name').notNull(),
  nameEl: text('name_el').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  organizationId: text('organization_id').notNull(),
})

// ─── PRACTICE TOOLS ────────────────────────────────────────────────────
export const practice_tools = pgTable('practice_tools', {
  id: text('id').primaryKey(), // 'cp-checklist', 'security-perfection', etc.
  practiceAreaId: text('practice_area_id')
    .notNull()
    .references(() => practice_areas.id),
  category: text('category').notNull(), // 'Document Generation', 'Document Review', 'Translation'
  name: text('name').notNull(),
  nameEl: text('name_el').notNull(),
  description: text('description'),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  // The tool type determines which chat API route to use
  toolType: text('tool_type').notNull(), // 'document-generation' | 'document-review' | 'translation' | 'general'
  // System prompt template ID or inline prompt
  systemPromptId: text('system_prompt_id'),
  config: jsonb('config'), // Tool-specific configuration
})

// ─── PROJECT-TOOL CONVERSATIONS ────────────────────────────────────────
// Links conversations to both a project AND a specific tool
export const project_conversations = pgTable('project_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  toolId: text('tool_id').references(() => practice_tools.id),
  // For general tools (existing routes), store the tool route
  generalToolRoute: text('general_tool_route'), // '/lawbot', '/case-research', etc.
  title: text('title'),
  userId: text('user_id').notNull(),
  organizationId: text('organization_id').notNull(),
  // Reference to the actual conversation in the existing tables
  conversationRef: uuid('conversation_ref'), // Points to existing chat/case/contract tables
  createdAt: timestamp('created_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    precision: 6,
    withTimezone: true,
  }).defaultNow(),
})

// ─── USER PREFERENCES ──────────────────────────────────────────────────
export const user_ui_preferences = pgTable('user_ui_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().unique(),
  sidebarCollapsed: boolean('sidebar_collapsed').default(false),
  chatHistoryVisible: boolean('chat_history_visible').default(true),
  lastProjectId: uuid('last_project_id'),
  lastPracticeArea: text('last_practice_area'),
  lastToolId: text('last_tool_id'),
  pinnedTools: jsonb('pinned_tools').$type<string[]>().default([]),
})

// ─── RELATIONS ─────────────────────────────────────────────────────────
export const projectRelations = relations(projects, ({ many }) => ({
  conversations: many(project_conversations),
}))

export const practiceToolRelations = relations(practice_tools, ({ one }) => ({
  practiceArea: one(practice_areas, {
    fields: [practice_tools.practiceAreaId],
    references: [practice_areas.id],
  }),
}))

export const projectConversationRelations = relations(
  project_conversations,
  ({ one }) => ({
    project: one(projects, {
      fields: [project_conversations.projectId],
      references: [projects.id],
    }),
  })
)
