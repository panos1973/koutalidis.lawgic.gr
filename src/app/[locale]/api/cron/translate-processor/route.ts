import { NextRequest, NextResponse } from 'next/server'
import db from '@/db/drizzle'
import { translationJobs } from '@/db/schema'
import { sql, and, lt } from 'drizzle-orm'

const STALL_THRESHOLD_SECONDS = 60

/**
 * GET /api/cron/translate-processor
 *
 * Vercel cron job (runs every minute). Safety net that finds stalled
 * translation jobs and re-triggers processing for them.
 *
 * Also cleans up completed/failed jobs older than 24h/7d respectively.
 */
export async function GET(request: NextRequest) {
  try {
    // Find stalled jobs: status is translating/building but no activity for 60+ seconds
    const stalledJobs = await db
      .select({ id: translationJobs.id })
      .from(translationJobs)
      .where(
        and(
          sql`${translationJobs.status} IN ('translating', 'building', 'preparing')`,
          lt(
            translationJobs.lastActivityAt,
            sql`NOW() - INTERVAL '${sql.raw(String(STALL_THRESHOLD_SECONDS))} seconds'`,
          ),
        ),
      )

    if (stalledJobs.length > 0) {
      console.log(
        `[Translate Cron] Found ${stalledJobs.length} stalled job(s), re-triggering...`,
      )

      const proto = request.headers.get('x-forwarded-proto') || 'https'
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
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

      for (const job of stalledJobs) {
        fetch(`${baseUrl}/en/api/translate/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.CRON_SECRET || 'internal',
          },
          body: JSON.stringify({ jobId: job.id }),
        }).catch((err) => {
          console.error(
            `[Translate Cron] Failed to re-trigger job ${job.id}:`,
            err,
          )
        })
      }
    }

    // Cleanup: delete completed jobs older than 24 hours
    const deletedCompleted = await db
      .delete(translationJobs)
      .where(
        and(
          sql`${translationJobs.status} = 'completed'`,
          lt(
            translationJobs.completedAt,
            sql`NOW() - INTERVAL '24 hours'`,
          ),
        ),
      )

    // Cleanup: delete failed jobs older than 7 days
    const deletedFailed = await db
      .delete(translationJobs)
      .where(
        and(
          sql`${translationJobs.status} = 'failed'`,
          lt(
            translationJobs.createdAt,
            sql`NOW() - INTERVAL '7 days'`,
          ),
        ),
      )

    return NextResponse.json({
      ok: true,
      stalledJobsRetriggered: stalledJobs.length,
    })
  } catch (error) {
    console.error('[Translate Cron] Error:', error)
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 },
    )
  }
}

// Allow manual triggering via POST for development
export async function POST(request: NextRequest) {
  return GET(request)
}
