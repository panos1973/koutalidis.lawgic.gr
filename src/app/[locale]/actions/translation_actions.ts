'use server'

import db from '@/db/drizzle'
import { translations, translationJobs } from '@/db/schema'
import { auth } from '@clerk/nextjs/server'
import { desc, eq, and, sql } from 'drizzle-orm'

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
    .limit(20)
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

/**
 * Fetch the downloadable data for a completed translation.
 * Returns the docx base64 (from translationJobs) or translated text (from translations).
 */
export async function getTranslationDownloadData(translationId: string) {
  const { userId } = auth()
  if (!userId) throw new Error('Unauthorized')

  // Verify ownership
  const [translation] = await db
    .select({
      id: translations.id,
      userId: translations.userId,
      title: translations.title,
      sourceLang: translations.sourceLang,
      targetLang: translations.targetLang,
      translatedText: translations.translatedText,
    })
    .from(translations)
    .where(eq(translations.id, translationId))
    .limit(1)

  if (!translation || translation.userId !== userId) {
    throw new Error('Translation not found')
  }

  // Try to find the docx from the job table
  const [job] = await db
    .select({
      translatedDocxBase64: translationJobs.translatedDocxBase64,
      docxFileName: translationJobs.docxFileName,
    })
    .from(translationJobs)
    .where(eq(translationJobs.translationId, translationId))
    .limit(1)

  return {
    id: translation.id,
    title: translation.title,
    sourceLang: translation.sourceLang,
    targetLang: translation.targetLang,
    translatedText: translation.translatedText,
    translatedDocxBase64: job?.translatedDocxBase64 ?? null,
    docxFileName: job?.docxFileName ?? null,
  }
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

/**
 * Get the most recent active (non-completed, non-failed) translation job
 * for the current user. Used to resume showing progress after navigation.
 */
export async function getActiveTranslationJob() {
  const { userId } = auth()
  if (!userId) return null

  const [job] = await db
    .select({
      id: translationJobs.id,
      status: translationJobs.status,
      sourceLang: translationJobs.sourceLang,
      targetLang: translationJobs.targetLang,
      isDocx: translationJobs.isDocx,
      docxFileName: translationJobs.docxFileName,
    })
    .from(translationJobs)
    .where(
      and(
        eq(translationJobs.userId, userId),
        sql`${translationJobs.status} IN ('pending', 'preparing', 'translating', 'building')`,
      ),
    )
    .orderBy(desc(translationJobs.createdAt))
    .limit(1)

  return job ?? null
}
