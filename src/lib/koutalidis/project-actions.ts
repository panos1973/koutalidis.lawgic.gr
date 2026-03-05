'use server'

import db from '@/db/drizzle'
import {
  projects,
  project_conversations,
  user_ui_preferences,
} from '@/db/schema_koutalidis'
import { auth } from '@clerk/nextjs/server'
import { eq, and, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createProject(data: {
  name: string
  clientName?: string
  description?: string
  practiceAreas: string[]
}) {
  const { userId, orgId } = auth()
  if (!userId || !orgId) throw new Error('Unauthorized')

  const [project] = await db
    .insert(projects)
    .values({
      name: data.name,
      clientName: data.clientName,
      description: data.description,
      practiceAreas: data.practiceAreas,
      createdByUserId: userId,
      organizationId: orgId,
    })
    .returning()

  revalidatePath('/')
  return project
}

export async function getProjects() {
  const { userId, orgId } = auth()
  if (!userId || !orgId) return []

  return db
    .select()
    .from(projects)
    .where(
      and(eq(projects.organizationId, orgId), eq(projects.status, 'active'))
    )
    .orderBy(desc(projects.updatedAt))
}

export async function getProject(projectId: string) {
  const { userId, orgId } = auth()
  if (!userId || !orgId) return null

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
    .limit(1)

  return project || null
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string
    clientName?: string
    description?: string
    practiceAreas?: string[]
    status?: string
  }
) {
  const { userId, orgId } = auth()
  if (!userId || !orgId) throw new Error('Unauthorized')

  const [updated] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
    .returning()

  revalidatePath('/')
  return updated
}

export async function getProjectConversations(projectId: string) {
  const { userId } = auth()
  if (!userId) return []

  return db
    .select()
    .from(project_conversations)
    .where(eq(project_conversations.projectId, projectId))
    .orderBy(desc(project_conversations.updatedAt))
}

export async function createProjectConversation(data: {
  projectId: string
  toolId?: string
  generalToolRoute?: string
  title?: string
  conversationRef?: string
}) {
  const { userId, orgId } = auth()
  if (!userId || !orgId) throw new Error('Unauthorized')

  const [conversation] = await db
    .insert(project_conversations)
    .values({
      projectId: data.projectId,
      toolId: data.toolId,
      generalToolRoute: data.generalToolRoute,
      title: data.title,
      userId,
      organizationId: orgId,
      conversationRef: data.conversationRef,
    })
    .returning()

  return conversation
}

export async function getUserUiPreferences() {
  const { userId } = auth()
  if (!userId) return null

  const [prefs] = await db
    .select()
    .from(user_ui_preferences)
    .where(eq(user_ui_preferences.userId, userId))
    .limit(1)

  return prefs || null
}

export async function updateUserUiPreferences(data: {
  sidebarCollapsed?: boolean
  chatHistoryVisible?: boolean
  lastProjectId?: string
  lastPracticeArea?: string
  lastToolId?: string
  pinnedTools?: string[]
}) {
  const { userId } = auth()
  if (!userId) throw new Error('Unauthorized')

  const existing = await getUserUiPreferences()

  if (existing) {
    const [updated] = await db
      .update(user_ui_preferences)
      .set(data)
      .where(eq(user_ui_preferences.userId, userId))
      .returning()
    return updated
  } else {
    const [created] = await db
      .insert(user_ui_preferences)
      .values({ userId, ...data })
      .returning()
    return created
  }
}
