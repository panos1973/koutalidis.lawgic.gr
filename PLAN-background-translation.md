# Plan: Bulletproof Background Translation System

## The Problem

Today, the entire translation loop runs **in the browser**. The frontend sends batch-by-batch fetch requests and waits. If the user closes the tab, navigates to another tool, or loses internet for a moment — the translation dies. For a 30-60 minute legal translation, this is unacceptable.

## The Solution: Server-Side Translation with Database State

Move the translation orchestration from the browser to the server. Every bit of progress is saved to the database. The user can navigate away, close the tab, even shut down their computer — the server keeps translating.

---

## Architecture Overview

```
User clicks "Translate"
        │
        ▼
  ┌─────────────────┐
  │  POST /start     │  Creates job in DB, returns jobId
  │                  │  Fires first processing call
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     ┌──────────────┐
  │  POST /process   │────▶│  PostgreSQL   │  Saves each batch result
  │  (batch loop)    │     │  translation  │
  │                  │◀────│  _jobs table  │
  └────────┬────────┘     └──────────────┘
           │
           │  After each batch: save to DB
           │  After all batches: mark complete
           │  If timeout approaching: save & self-chain
           │
           ▼
  ┌─────────────────┐
  │  GET /status     │  Client polls this (works after navigation)
  │                  │  Returns progress, partial results, or final result
  └─────────────────┘

  ┌─────────────────┐
  │  CRON (1 min)    │  Safety net: finds stalled jobs, re-triggers /process
  └─────────────────┘
```

**Three layers of reliability:**
1. **Self-chaining**: After processing batches, the function triggers itself for the next chunk (via internal fetch + `waitUntil` or fire-and-forget)
2. **Cron fallback**: Every 1 minute, checks for stalled jobs and re-triggers them
3. **Client polling**: When user returns to the page, detects in-progress jobs and re-triggers if stalled

---

## Step-by-Step Implementation

### Step 1: Database — New `translation_jobs` Table

Add a new table to `src/db/schema.ts`:

```typescript
export const translationJobStatusEnum = pgEnum('translation_job_status', [
  'pending',      // Job created, not started
  'preparing',    // Running prepare phase (domain detection, terminology)
  'translating',  // Batch translation in progress
  'building',     // DOCX reconstruction (if applicable)
  'completed',    // All done
  'failed',       // Unrecoverable error
]);

export const translationJobs = pgTable('translation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  status: translationJobStatusEnum('status').notNull().default('pending'),

  // Input data (saved at job creation)
  sourceText: text('source_text'),                    // For text mode
  sourceLang: text('source_lang').notNull(),
  targetLang: text('target_lang').notNull(),

  // DOCX mode data
  isDocx: boolean('is_docx').notNull().default(false),
  docxBase64: text('docx_base64'),                    // Original DOCX file
  docxFileName: text('docx_file_name'),

  // Prepare phase results (saved after prepare completes)
  paragraphs: jsonb('paragraphs'),                    // string[]
  domain: jsonb('domain'),                            // { primaryDomain, secondaryDomain }
  terminology: jsonb('terminology'),                  // terminology results
  batchRanges: jsonb('batch_ranges'),                 // [start, end][]
  totalBatches: integer('total_batches'),

  // Translation progress
  completedBatches: integer('completed_batches').notNull().default(0),
  translatedParagraphs: jsonb('translated_paragraphs'), // string[] - grows as batches complete

  // Result (saved when complete)
  translatedText: text('translated_text'),            // Final joined text
  translatedDocxBase64: text('translated_docx_base64'), // For DOCX mode
  translationId: uuid('translation_id'),              // FK to translations table (history entry)

  // Error handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),

  // Timing
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});
```

**Key design decisions:**
- `translatedParagraphs` is a JSON array that grows batch by batch — this is the checkpoint
- `lastActivityAt` is updated every time a batch completes — used to detect stalled jobs
- `completedBatches` lets us resume from exactly where we stopped
- All input data is stored at creation so the server can process independently

**Migration:** Generate and run via `drizzle-kit generate` + `drizzle-kit push`.

---

### Step 2: API Route — `POST /api/translate/start`

New file: `src/app/[locale]/api/translate/start/route.ts`

**What it does:**
1. Receives the same input the frontend currently sends (text or DOCX data, languages)
2. For DOCX: extracts paragraphs via the existing extraction logic
3. Runs the **prepare phase** (domain detection + terminology search) — this is fast (~5-10s)
4. Creates the job row in `translation_jobs` with all prepare results
5. Returns `{ jobId }` to the client immediately
6. Fires off the first processing call (fire-and-forget)

**Why prepare is done here (not in /process):**
- It's fast and we want the job to be fully ready before we start batch processing
- The client gets the jobId immediately and can start polling

```typescript
export const maxDuration = 120; // 2 minutes is plenty for prepare

export async function POST(req: Request) {
  // 1. Auth check
  // 2. Parse input (text/docx, languages)
  // 3. If DOCX: extract paragraphs
  // 4. Run prepare (domain detection + terminology) — reuse existing logic
  // 5. Compute batch ranges
  // 6. INSERT into translation_jobs with status='translating'
  // 7. Fire-and-forget: fetch('/api/translate/process', { jobId })
  // 8. Return { jobId }
}
```

---

### Step 3: API Route — `POST /api/translate/process`

New file: `src/app/[locale]/api/translate/process/route.ts`

**This is the workhorse.** It processes batches in a loop and self-chains when needed.

```typescript
export const maxDuration = 300; // 5 minutes (Vercel Pro limit)

export async function POST(req: Request) {
  // 1. Load job from DB
  // 2. If job is completed/failed, return early
  // 3. Update lastActivityAt (claim the job)
  // 4. Loop through remaining batches:
  //    a. Call Claude for translation (reuse existing batch logic)
  //    b. Append results to translatedParagraphs in DB
  //    c. Increment completedBatches
  //    d. Update lastActivityAt
  //    e. Check elapsed time — if approaching maxDuration (4.5 min), break
  // 5. If more batches remain: self-chain (fire-and-forget fetch to this same endpoint)
  // 6. If all batches done:
  //    a. If DOCX: rebuild document (reuse existing docx-translate logic)
  //    b. Join translated paragraphs into final text
  //    c. Save to translations table (history entry)
  //    d. Update job status to 'completed'
}
```

**Self-chaining mechanism:**
```typescript
// After saving current progress, trigger next chunk
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
fetch(`${baseUrl}/api/translate/process`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET },
  body: JSON.stringify({ jobId }),
}).catch(() => {}); // Fire and forget — cron will catch failures
```

**Safety features:**
- **Elapsed time check**: Breaks the loop at 4.5 minutes (leaving 30s buffer before Vercel kills it)
- **Per-batch DB save**: If the function crashes mid-way, we lose at most 1 batch
- **Idempotent**: If called twice for the same job, the second call sees batches already completed and skips them
- **Retry logic**: Each Claude API call uses the existing retry logic (2 retries with backoff)
- **Error handling**: After 3 consecutive failures on the same batch, marks job as 'failed' with error message

---

### Step 4: API Route — `GET /api/translate/job-status/[id]`

New file: `src/app/[locale]/api/translate/job-status/[id]/route.ts`

**Returns current job state for polling:**

```typescript
export async function GET(req, { params }) {
  // 1. Auth check (user must own the job)
  // 2. SELECT job from translation_jobs
  // 3. Return:
  //    - status (preparing/translating/building/completed/failed)
  //    - completedBatches / totalBatches
  //    - domain (once prepare is done)
  //    - translatedText (when completed, for text mode)
  //    - translatedDocxBase64 (when completed, for DOCX mode)
  //    - translationId (for history linking)
  //    - errorMessage (if failed)
  //    - isStalled: lastActivityAt > 90 seconds ago && status not completed/failed
}
```

**If the job appears stalled** (no activity for 90+ seconds), the status endpoint also re-triggers `/api/translate/process`. This means simply polling the status endpoint is enough to recover from any failure.

---

### Step 5: Cron Job — Translation Processor (Safety Net)

New file: `src/app/[locale]/api/cron/translate-processor/route.ts`

Update `vercel.json` to add:
```json
{
  "path": "/api/cron/translate-processor",
  "schedule": "* * * * *"
}
```

**What it does (runs every minute):**
1. Query for jobs where `status IN ('translating', 'building')` AND `lastActivityAt < NOW() - 60 seconds`
2. For each stalled job: fire a fetch to `/api/translate/process` with the jobId
3. This catches any case where the self-chain broke (function timeout, network glitch, etc.)

This is a lightweight query — if no jobs are stalled, it does nothing. On Vercel Pro, 1-minute crons are supported.

---

### Step 6: Frontend — Rewrite Translation Page

Modify: `src/app/[locale]/(koutalidis)/translate/page.tsx`

**Changes to the translation flow:**

#### Starting a translation:
```typescript
// OLD: Client calls prepare, then loops through batch calls
// NEW: Client calls /start, gets jobId, starts polling

async function handleTranslate() {
  setIsTranslating(true);
  setProgress({ phase: 'preparing', ... });

  const res = await fetch('/api/translate/start', {
    method: 'POST',
    body: JSON.stringify({ sourceText, sourceLang, targetLang, docxState }),
  });
  const { jobId } = await res.json();

  // Save jobId to state + localStorage (survives navigation)
  setActiveJobId(jobId);
  localStorage.setItem('activeTranslationJobId', jobId);

  // Start polling
  startPolling(jobId);
}
```

#### Polling for progress:
```typescript
function startPolling(jobId: string) {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/translate/job-status/${jobId}`);
    const job = await res.json();

    if (job.status === 'translating') {
      setProgress({
        phase: 'translating',
        currentBatch: job.completedBatches,
        totalBatches: job.totalBatches,
        message: `Translating section ${job.completedBatches} of ${job.totalBatches}...`,
      });
    } else if (job.status === 'building') {
      setProgress({ phase: 'building', message: 'Building document...' });
    } else if (job.status === 'completed') {
      clearInterval(interval);
      localStorage.removeItem('activeTranslationJobId');
      setResult({ translatedText: job.translatedText, ... });
      setIsTranslating(false);
      // If DOCX, set docxState with translated base64
    } else if (job.status === 'failed') {
      clearInterval(interval);
      localStorage.removeItem('activeTranslationJobId');
      setError(job.errorMessage);
      setIsTranslating(false);
    }
  }, 3000); // Poll every 3 seconds

  return () => clearInterval(interval);
}
```

#### Resuming on page mount (the key feature):
```typescript
useEffect(() => {
  const savedJobId = localStorage.getItem('activeTranslationJobId');
  if (savedJobId) {
    // User navigated away and came back — resume showing progress
    setIsTranslating(true);
    setActiveJobId(savedJobId);
    startPolling(savedJobId);
  }
}, []);
```

This is what makes it "just work" — when the lawyer navigates to another tool and comes back, the translation page immediately shows the current progress.

#### Notification when translation completes while on another page:
- Use a small component in the root layout that checks localStorage for active jobs
- When the job completes, show a toast notification: "Your translation is ready!"
- Clicking the toast navigates back to the translate page

---

### Step 7: Global Notification Component

New file: `src/components/translate/TranslationNotifier.tsx`

Added to root layout, this lightweight component:
1. On mount, checks localStorage for `activeTranslationJobId`
2. If found, polls `/api/translate/job-status/[id]` every 5 seconds (light polling)
3. When status becomes 'completed': shows a toast via `sonner` (already in dependencies)
4. When status becomes 'failed': shows an error toast
5. Cleans up localStorage

This means even while the lawyer is using the contract review tool, they'll see a notification when their translation finishes.

---

### Step 8: Cleanup — Old Translation Jobs

Add to the existing daily cron (`subscription-management`) or the new translate-processor cron:
- Delete completed jobs older than 24 hours (the data is already saved in the `translations` history table)
- Delete failed jobs older than 7 days
- This prevents the table from growing unbounded

---

## What Changes vs. What Stays the Same

| Component | Change |
|-----------|--------|
| `/api/translate/prepare` | **Kept** — logic reused inside `/start` |
| `/api/translate/batch` | **Kept** — logic reused inside `/process` |
| `/api/translate/docx-extract` | **Kept** — logic reused inside `/start` |
| `/api/translate/docx-translate` | **Kept** — logic reused inside `/process` |
| `/api/translate/extract-text` | **No change** — file extraction stays client-triggered |
| Translation page UI | **Modified** — polling instead of direct batch calls |
| Translation history | **No change** — still saves to same `translations` table |
| Download functionality | **No change** — works from job result data |

The existing API routes continue to work (backwards compatible). The new routes (`/start`, `/process`, `/job-status`) are additions.

---

## Failure Scenarios & Recovery

| Scenario | What happens |
|----------|-------------|
| User closes tab mid-translation | Server keeps processing. User returns → sees progress via localStorage jobId |
| User closes browser entirely | Server keeps processing. User logs back in → translate page checks for active jobs for this user |
| Vercel function times out | Progress saved to DB. Self-chain or cron re-triggers within 1 minute |
| Claude API returns 500 | Batch retried 2x with backoff. After 3 total failures, tries next batch. After 3 consecutive batch failures, job marked failed |
| Database connection fails | Function crashes. Cron re-triggers within 1 minute. Last completed batch is safe |
| Self-chain fetch fails | Cron picks up the stalled job within 1 minute |
| Network blip during polling | Polling continues on next interval. No data lost (server-side) |
| Two process calls race on same job | Idempotent design — second call skips already-completed batches. Worst case: one batch is translated twice (wasted API cost but no corruption) |

---

## Files to Create/Modify

### New files:
1. `src/app/[locale]/api/translate/start/route.ts` — Job creation endpoint
2. `src/app/[locale]/api/translate/process/route.ts` — Batch processing engine
3. `src/app/[locale]/api/translate/job-status/[id]/route.ts` — Status polling endpoint
4. `src/app/[locale]/api/cron/translate-processor/route.ts` — Stalled job recovery cron
5. `src/components/translate/TranslationNotifier.tsx` — Global completion notification
6. DB migration file (generated by drizzle-kit)

### Modified files:
7. `src/db/schema.ts` — Add `translation_jobs` table + enum
8. `src/app/[locale]/(koutalidis)/translate/page.tsx` — Rewrite to use job-based polling
9. `src/app/[locale]/(koutalidis)/layout.tsx` (or root layout) — Add TranslationNotifier
10. `vercel.json` — Add 1-minute cron for translate-processor
11. `src/app/[locale]/actions/translation_actions.ts` — Add job-related server actions (getActiveJob, etc.)

---

## Summary

The lawyer clicks "Translate", sees the progress bar start, then goes to review a contract. The server keeps translating batch by batch, saving every step to PostgreSQL. If anything crashes, the cron picks it up within a minute. When the translation finishes, a toast notification appears: "Your translation is ready!" The lawyer clicks it, sees the result, downloads the DOCX. Zero lost work. Zero waiting at the screen.
