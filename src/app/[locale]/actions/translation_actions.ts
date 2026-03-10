'use server'

import db from '@/db/drizzle'
import { translations } from '@/db/schema'
import { auth } from '@clerk/nextjs/server'
import { desc, eq } from 'drizzle-orm'

export async function saveTranslation(data: {
  title: string
  sourceLang: string
  targetLang: string
  domain?: string
  paragraphCount?: number
  sourcePreview?: string
  translatedPreview?: string
  sourceText?: string
  translatedText?: string
}) {
  const { userId } = auth()
  if (!userId) throw new Error('Unauthorized')

  const [row] = await db
    .insert(translations)
    .values({
      ...data,
      userId,
    })
    .returning({ id: translations.id })

  return row.id
}

export async function getTranslationHistory() {
  const { userId } = auth()
  if (!userId) return []

  return db
    .select({
      id: translations.id,
      title: translations.title,
      sourceLang: translations.sourceLang,
      targetLang: translations.targetLang,
      domain: translations.domain,
      paragraphCount: translations.paragraphCount,
      createdAt: translations.createdAt,
    })
    .from(translations)
    .where(eq(translations.userId, userId))
    .orderBy(desc(translations.createdAt))
    .limit(50)
}

export async function getTranslationById(id: string) {
  const { userId } = auth()
  if (!userId) throw new Error('Unauthorized')

  const [row] = await db
    .select()
    .from(translations)
    .where(eq(translations.id, id))
    .limit(1)

  if (!row || row.userId !== userId) {
    throw new Error('Translation not found')
  }

  return row
}

export async function deleteTranslation(id: string) {
  const { userId } = auth()
  if (!userId) throw new Error('Unauthorized')

  // Verify ownership before delete
  const [row] = await db
    .select({ userId: translations.userId })
    .from(translations)
    .where(eq(translations.id, id))
    .limit(1)

  if (!row || row.userId !== userId) {
    throw new Error('Translation not found')
  }

  await db.delete(translations).where(eq(translations.id, id))
}
