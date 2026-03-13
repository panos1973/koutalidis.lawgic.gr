'use server'

import db from '@/db/drizzle'
import {
  tabular_reviews,
  tabular_review_columns,
  tabular_review_documents,
  tabular_review_cells,
} from '@/db/schema_tabular_review'
import { eq, and, asc, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

const getLocaleFromCookies = () => {
  try {
    const cookieStore = cookies()
    const localeCookie = cookieStore.get('NEXT_LOCALE')
    return localeCookie ? localeCookie.value : 'el'
  } catch (error) {
    console.error('Failed to read locale from cookies:', error)
    return 'el'
  }
}

// ─── REVIEWS (CRUD) ────────────────────────────────────────────────

export async function createTabularReview(userId: string, title?: string) {
  const locale = getLocaleFromCookies()
  const defaultTitle = `Tabular Review ${Math.floor(Math.random() * 10000)}`

  try {
    const result = await db
      .insert(tabular_reviews)
      .values({
        userId,
        title: title || defaultTitle,
        language: locale,
      })
      .returning()

    if (!result || result.length === 0) {
      throw new Error('Failed to create review: no result returned from database')
    }

    const review = result[0]
    revalidatePath(`/${locale}/tabular-review`)
    return review.id
  } catch (error) {
    console.error('Error in createTabularReview:', error)
    throw error
  }
}

export async function getTabularReviews(userId: string) {
  return db
    .select()
    .from(tabular_reviews)
    .where(eq(tabular_reviews.userId, userId))
    .orderBy(desc(tabular_reviews.createdAt))
}

export async function getTabularReview(reviewId: string) {
  const [review] = await db
    .select()
    .from(tabular_reviews)
    .where(eq(tabular_reviews.id, reviewId))
    .limit(1)
  return review || null
}

export async function updateTabularReviewTitle(
  reviewId: string,
  title: string
) {
  const locale = getLocaleFromCookies()
  await db
    .update(tabular_reviews)
    .set({ title, updatedAt: new Date() })
    .where(eq(tabular_reviews.id, reviewId))
  revalidatePath(`/${locale}/tabular-review`)
  revalidatePath(`/${locale}/tabular-review/${reviewId}`)
}

export async function deleteTabularReview(reviewId: string) {
  const locale = getLocaleFromCookies()
  await db.delete(tabular_reviews).where(eq(tabular_reviews.id, reviewId))
  revalidatePath(`/${locale}/tabular-review`)
}

// ─── COLUMNS ───────────────────────────────────────────────────────

export async function getTabularReviewColumns(reviewId: string) {
  return db
    .select()
    .from(tabular_review_columns)
    .where(eq(tabular_review_columns.reviewId, reviewId))
    .orderBy(asc(tabular_review_columns.sortOrder))
}

export async function addTabularReviewColumn(
  reviewId: string,
  label: string,
  prompt: string,
  format: string = 'text'
) {
  const locale = getLocaleFromCookies()

  // Get the current max sort order
  const existingColumns = await db
    .select({ sortOrder: tabular_review_columns.sortOrder })
    .from(tabular_review_columns)
    .where(eq(tabular_review_columns.reviewId, reviewId))
    .orderBy(desc(tabular_review_columns.sortOrder))
    .limit(1)

  const nextOrder = existingColumns.length > 0 ? (existingColumns[0].sortOrder || 0) + 1 : 0

  const [column] = await db
    .insert(tabular_review_columns)
    .values({
      reviewId,
      label,
      prompt,
      format,
      sortOrder: nextOrder,
    })
    .returning()

  revalidatePath(`/${locale}/tabular-review/${reviewId}`)
  return column
}

export async function updateTabularReviewColumn(
  columnId: string,
  data: { label?: string; prompt?: string; format?: string }
) {
  const locale = getLocaleFromCookies()
  await db
    .update(tabular_review_columns)
    .set(data)
    .where(eq(tabular_review_columns.id, columnId))
  revalidatePath(`/${locale}/tabular-review`)
}

export async function deleteTabularReviewColumn(columnId: string) {
  const locale = getLocaleFromCookies()
  // Cells are cascade-deleted via FK
  await db
    .delete(tabular_review_columns)
    .where(eq(tabular_review_columns.id, columnId))
  revalidatePath(`/${locale}/tabular-review`)
}

// ─── DOCUMENTS (ROWS) ─────────────────────────────────────────────

export async function getTabularReviewDocuments(reviewId: string) {
  return db
    .select()
    .from(tabular_review_documents)
    .where(eq(tabular_review_documents.reviewId, reviewId))
    .orderBy(asc(tabular_review_documents.sortOrder))
}

export async function addTabularReviewDocument(
  reviewId: string,
  fileName: string,
  textContent: string,
  fileType?: string,
  fileSize?: number,
  vaultFileId?: string,
  storageUrl?: string
) {
  const locale = getLocaleFromCookies()

  const existingDocs = await db
    .select({ sortOrder: tabular_review_documents.sortOrder })
    .from(tabular_review_documents)
    .where(eq(tabular_review_documents.reviewId, reviewId))
    .orderBy(desc(tabular_review_documents.sortOrder))
    .limit(1)

  const nextOrder = existingDocs.length > 0 ? (existingDocs[0].sortOrder || 0) + 1 : 0

  const [doc] = await db
    .insert(tabular_review_documents)
    .values({
      reviewId,
      fileName,
      textContent,
      fileType,
      fileSize,
      vaultFileId,
      storageUrl,
      sortOrder: nextOrder,
    })
    .returning()

  revalidatePath(`/${locale}/tabular-review/${reviewId}`)
  return doc
}

export async function deleteTabularReviewDocument(documentId: string) {
  const locale = getLocaleFromCookies()
  await db
    .delete(tabular_review_documents)
    .where(eq(tabular_review_documents.id, documentId))
  revalidatePath(`/${locale}/tabular-review`)
}

// ─── CELLS ─────────────────────────────────────────────────────────

export async function getTabularReviewCells(reviewId: string) {
  return db
    .select()
    .from(tabular_review_cells)
    .where(eq(tabular_review_cells.reviewId, reviewId))
}

export async function updateCellValue(
  cellId: string,
  value: string,
  isManualEdit: boolean = false
) {
  const locale = getLocaleFromCookies()
  await db
    .update(tabular_review_cells)
    .set({
      value,
      isManualEdit,
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(tabular_review_cells.id, cellId))
  revalidatePath(`/${locale}/tabular-review`)
}

export async function updateCellReviewStatus(
  cellId: string,
  isReviewed: boolean,
  userId: string
) {
  const locale = getLocaleFromCookies()
  await db
    .update(tabular_review_cells)
    .set({
      isReviewed,
      reviewedBy: isReviewed ? userId : null,
      reviewedAt: isReviewed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tabular_review_cells.id, cellId))
  revalidatePath(`/${locale}/tabular-review`)
}

export async function updateCellLockStatus(
  cellId: string,
  isLocked: boolean
) {
  const locale = getLocaleFromCookies()
  await db
    .update(tabular_review_cells)
    .set({
      isLocked,
      updatedAt: new Date(),
    })
    .where(eq(tabular_review_cells.id, cellId))
  revalidatePath(`/${locale}/tabular-review`)
}

export async function toggleRowReviewStatus(
  reviewId: string,
  documentId: string,
  isReviewed: boolean,
  userId: string
) {
  const locale = getLocaleFromCookies()
  await db
    .update(tabular_review_cells)
    .set({
      isReviewed,
      reviewedBy: isReviewed ? userId : null,
      reviewedAt: isReviewed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tabular_review_cells.reviewId, reviewId),
        eq(tabular_review_cells.documentId, documentId)
      )
    )
  revalidatePath(`/${locale}/tabular-review`)
}

export async function updateCellStatus(
  cellId: string,
  status: string,
  error?: string
) {
  await db
    .update(tabular_review_cells)
    .set({ status, error, updatedAt: new Date() })
    .where(eq(tabular_review_cells.id, cellId))
}

export async function createPendingCells(
  reviewId: string,
  documentId: string,
  columnIds: string[]
) {
  if (columnIds.length === 0) return []

  const values = columnIds.map((columnId) => ({
    reviewId,
    documentId,
    columnId,
    status: 'pending' as const,
  }))

  return db.insert(tabular_review_cells).values(values).returning()
}

export async function createPendingCellsForColumn(
  reviewId: string,
  columnId: string,
  documentIds: string[]
) {
  if (documentIds.length === 0) return []

  const values = documentIds.map((documentId) => ({
    reviewId,
    documentId,
    columnId,
    status: 'pending' as const,
  }))

  return db.insert(tabular_review_cells).values(values).returning()
}
