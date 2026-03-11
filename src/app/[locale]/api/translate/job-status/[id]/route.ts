import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import db from '@/db/drizzle'
import { translationJobs } from '@/db/schema'
import { eq } from 'drizzle-orm'

const STALL_THRESHOLD_MS = 90_000 // 90 seconds without activity = stalled

/**
 * GET /api/translate/job-status/[id]
 *
 * Returns the current state of a translation job for polling.
 * If the job appears stalled, re-triggers processing automatically.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.id
    if (!jobId) {
      return Response.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const [job] = await db
      .select()
      .from(translationJobs)
      .where(eq(translationJobs.id, jobId))
      .limit(1)

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    const domain = job.domain as { primaryDomain: string; secondaryDomain: string | null } | null

    // Check if job is stalled
    const isStalled =
      (job.status === 'translating' || job.status === 'building') &&
      job.lastActivityAt &&
      Date.now() - new Date(job.lastActivityAt).getTime() > STALL_THRESHOLD_MS

    // If stalled, re-trigger processing
    if (isStalled) {
      console.log(
        `[Translation Status] Job ${jobId} appears stalled ` +
          `(last activity: ${job.lastActivityAt}), re-triggering...`,
      )
      triggerProcessing(req, jobId)
    }

    return Response.json({
      id: job.id,
      status: job.status,
      completedBatches: job.completedBatches,
      totalBatches: job.totalBatches ?? 0,
      domain,
      sourceLang: job.sourceLang,
      targetLang: job.targetLang,
      isDocx: job.isDocx,
      docxFileName: job.docxFileName,
      // Only include full results when completed
      ...(job.status === 'completed'
        ? {
            translatedText: job.translatedText,
            translatedDocxBase64: job.translatedDocxBase64,
            translationId: job.translationId,
            paragraphCount: job.paragraphs ? (job.paragraphs as string[]).length : 0,
          }
        : {}),
      // Error info
      ...(job.status === 'failed'
        ? { errorMessage: job.errorMessage }
        : {}),
      isStalled: !!isStalled,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to get job status'
    console.error('[translate/job-status]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

function triggerProcessing(req: NextRequest, jobId: string) {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host')
  let baseUrl: string
  if (host) {
    baseUrl = `${proto}://${host}`
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else {
    baseUrl = 'http://localhost:3000'
  }

  const locale = req.url.match(/\/(el|en|fr)\//)?.[1] || 'en'

  fetch(`${baseUrl}/${locale}/api/translate/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.CRON_SECRET || 'internal',
    },
    body: JSON.stringify({ jobId }),
  }).catch((err) => {
    console.error(`[Translation Status] Failed to re-trigger job ${jobId}:`, err)
  })
}
