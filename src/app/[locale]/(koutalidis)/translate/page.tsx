'use client'

import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useLocale } from 'next-intl'
import {
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Languages,
  Loader2,
  ScanSearch,
  Sparkles,
  Upload,
  X,
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { detectDocumentLanguage, type LangCode } from '@/lib/translate/detect-language'
import { useSetChatHistory } from '@/components/koutalidis/layout/ChatHistoryContext'
import {
  saveTranslation,
  getTranslationHistory,
  getTranslationById,
  getTranslationDownloadData,
  getActiveTranslationJob,
} from '@/app/[locale]/actions/translation_actions'

// Lazy-load the DOCX preview to avoid SSR issues with docx-preview
const DocxPreview = lazy(() => import('@/components/translate/DocxPreview'))

// ─── Constants ──────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3000
const STORAGE_KEY = 'activeTranslationJobId'

// ─── Supported languages ────────────────────────────────────────────
interface Language {
  code: LangCode
  name: string
  nameEl: string
  flag: string
  nativeName: string
}

const LANGUAGES: Language[] = [
  { code: 'el', name: 'Greek', nameEl: 'Ελληνικά', flag: '🇬🇷', nativeName: 'Ελληνικά' },
  { code: 'en', name: 'English', nameEl: 'Αγγλικά', flag: '🇬🇧', nativeName: 'English' },
  { code: 'fr', name: 'French', nameEl: 'Γαλλικά', flag: '🇫🇷', nativeName: 'Français' },
]

function getLang(code: LangCode): Language {
  return LANGUAGES.find((l) => l.code === code)!
}

const DOCX_EXTENSIONS = ['.docx']

function isDocxFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  return DOCX_EXTENSIONS.includes(ext)
}

// ─── i18n labels ────────────────────────────────────────────────────
const labels = {
  el: {
    title: 'Νομική Μετάφραση',
    subtitle: 'AI μετάφραση με εξειδίκευση σε νομικά έγγραφα',
    from: 'Από',
    to: 'Προς',
    pasteOrUpload: 'Επικολλήστε κείμενο ή ανεβάστε αρχείο',
    placeholder: 'Επικολλήστε το κείμενο που θέλετε να μεταφράσετε...',
    translateBtn: 'Μετάφραση',
    translating: 'Μετάφραση...',
    preparing: 'Προετοιμασία μετάφρασης...',
    analyzing: 'Ανάλυση',
    section: 'Τμήμα',
    of: 'από',
    translationComplete: 'Μετάφραση Ολοκληρώθηκε',
    paragraphsTranslated: 'παράγραφοι μεταφράστηκαν',
    copy: 'Αντιγραφή',
    copied: 'Αντιγράφηκε!',
    download: 'Λήψη .docx',
    downloadDocx: 'Λήψη .docx',
    detected: 'Εντοπίστηκε',
    document: 'κείμενο',
    highConfidence: '(υψηλή βεβαιότητα)',
    verifySelection: '— επαληθεύστε την επιλογή',
    noContent: 'Εισάγετε κείμενο ή ανεβάστε αρχείο.',
    errorTranslating: 'Σφάλμα κατά τη μετάφραση. Παρακαλώ δοκιμάστε ξανά.',
    analyzingDomain: 'Ανάλυση εγγράφου, εντοπισμός νομικού τομέα...',
    translatingSection: 'Μετάφραση τμήματος',
    legalDomain: 'Νομικός τομέας:',
    uploadFile: 'Ανέβασμα αρχείου',
    supportedFormats: 'TXT, PDF, DOCX, DOC, RTF, XLS, XLSX, PPT, PPTX, EML, MSG',
    clearText: 'Καθαρισμός',
    charCount: 'χαρακτήρες',
    translationResult: 'Αποτέλεσμα Μετάφρασης',
    newTranslation: 'Νέα Μετάφραση',
    dropFileHere: 'Αφήστε το αρχείο εδώ',
    extractingText: 'Εξαγωγή κειμένου...',
    fileLoaded: 'Φορτώθηκε από',
    unsupportedFile: 'Μη υποστηριζόμενος τύπος αρχείου. Υποστηρίζονται: TXT, PDF, DOCX, DOC, RTF, XLS, XLSX, PPT, PPTX, EML, MSG',
    extractionFailed: 'Αποτυχία εξαγωγής κειμένου από το αρχείο.',
    documentPreview: 'Προεπισκόπηση Εγγράφου',
    buildingDocx: 'Δημιουργία μεταφρασμένου εγγράφου...',
    originalDocument: 'Πρωτότυπο',
    translatedDocument: 'Μεταφρασμένο',
  },
  en: {
    title: 'Legal Translation',
    subtitle: 'AI translation specialized in legal documents',
    from: 'From',
    to: 'To',
    pasteOrUpload: 'Paste text or upload a file',
    placeholder: 'Paste the text you want to translate...',
    translateBtn: 'Translate',
    translating: 'Translating...',
    preparing: 'Preparing translation...',
    analyzing: 'Analyzing',
    section: 'Section',
    of: 'of',
    translationComplete: 'Translation Complete',
    paragraphsTranslated: 'paragraphs translated',
    copy: 'Copy',
    copied: 'Copied!',
    download: 'Download .docx',
    downloadDocx: 'Download .docx',
    detected: 'Detected',
    document: 'text',
    highConfidence: '(high confidence)',
    verifySelection: '— verify selection',
    noContent: 'Please enter text or upload a file.',
    errorTranslating: 'Error translating. Please try again.',
    analyzingDomain: 'Analyzing document, detecting legal domain...',
    translatingSection: 'Translating section',
    legalDomain: 'Legal domain:',
    uploadFile: 'Upload file',
    supportedFormats: 'TXT, PDF, DOCX, DOC, RTF, XLS, XLSX, PPT, PPTX, EML, MSG',
    clearText: 'Clear',
    charCount: 'characters',
    translationResult: 'Translation Result',
    newTranslation: 'New Translation',
    dropFileHere: 'Drop file here',
    extractingText: 'Extracting text...',
    fileLoaded: 'Loaded from',
    unsupportedFile: 'Unsupported file type. Supported: TXT, PDF, DOCX, DOC, RTF, XLS, XLSX, PPT, PPTX, EML, MSG',
    extractionFailed: 'Failed to extract text from file.',
    documentPreview: 'Document Preview',
    buildingDocx: 'Building translated document...',
    originalDocument: 'Original',
    translatedDocument: 'Translated',
  },
}

// ─── Progress type ──────────────────────────────────────────────────
interface TranslationProgress {
  phase: 'preparing' | 'translating' | 'building' | 'complete'
  currentBatch: number
  totalBatches: number
  message: string
}

interface TranslationResult {
  translatedText: string
  paragraphCount: number
  domain: { primaryDomain: string; secondaryDomain: string | null }
}

// DOCX document mode state
interface DocxState {
  docxBase64: string
  paragraphs: string[]
  fileName: string
  translatedDocxBase64: string | null
}

// ─── Main component ─────────────────────────────────────────────────
export default function TranslatePage() {
  const locale = useLocale() as 'el' | 'en'
  const t = labels[locale] || labels.en

  const [sourceLang, setSourceLang] = useState<LangCode>('el')
  const [targetLang, setTargetLang] = useState<LangCode>('en')
  const [sourceText, setSourceText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [detectedLang, setDetectedLang] = useState<{
    lang: LangCode
    confidence: number
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isExtractingFile, setIsExtractingFile] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)

  // DOCX document mode
  const [docxState, setDocxState] = useState<DocxState | null>(null)

  // Active job tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Translation history
  const [historyItems, setHistoryItems] = useState<
    Array<{ id: string; title: string; sourceLang: string; targetLang: string; domain: string | null; paragraphCount: number | null; createdAt: Date | null }>
  >([])
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const isDocxMode = docxState !== null

  // ─── Polling logic ──────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling()

      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/${locale}/api/translate/job-status/${jobId}`,
          )
          if (!res.ok) return

          const data = await res.json()

          if (data.status === 'preparing') {
            setProgress({
              phase: 'preparing',
              message: t.analyzingDomain,
              currentBatch: 0,
              totalBatches: data.totalBatches || 0,
            })
          } else if (data.status === 'translating') {
            setProgress({
              phase: 'translating',
              message: `${t.translatingSection} ${data.completedBatches} ${t.of} ${data.totalBatches}...`,
              currentBatch: data.completedBatches,
              totalBatches: data.totalBatches,
            })
          } else if (data.status === 'building') {
            setProgress({
              phase: 'building',
              message: t.buildingDocx,
              currentBatch: data.totalBatches,
              totalBatches: data.totalBatches,
            })
          } else if (data.status === 'completed') {
            stopPolling()
            localStorage.removeItem(STORAGE_KEY)
            setActiveJobId(null)
            setIsTranslating(false)
            setProgress(null)

            // Set result
            setResult({
              translatedText: data.translatedText || '',
              paragraphCount: data.paragraphCount || 0,
              domain: data.domain || { primaryDomain: 'legal', secondaryDomain: null },
            })

            // Set language pair from job
            if (data.sourceLang) setSourceLang(data.sourceLang as LangCode)
            if (data.targetLang) setTargetLang(data.targetLang as LangCode)

            // If DOCX, set the translated DOCX state
            if (data.isDocx && data.translatedDocxBase64) {
              setDocxState((prev) =>
                prev
                  ? { ...prev, translatedDocxBase64: data.translatedDocxBase64 }
                  : null,
              )
            }

            // Refresh history
            fetchHistory()
            if (data.translationId) {
              setActiveHistoryId(data.translationId)
            }
          } else if (data.status === 'failed') {
            stopPolling()
            localStorage.removeItem(STORAGE_KEY)
            setActiveJobId(null)
            setIsTranslating(false)
            setProgress(null)
            setError(data.errorMessage || t.errorTranslating)
          }
        } catch {
          // Network error — keep polling
        }
      }, POLL_INTERVAL_MS)
    },
    [locale, t, stopPolling],
  )

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // ─── Resume on mount ────────────────────────────────────────────────

  useEffect(() => {
    async function checkForActiveJob() {
      // First check localStorage
      const savedJobId = localStorage.getItem(STORAGE_KEY)
      if (savedJobId) {
        setActiveJobId(savedJobId)
        setIsTranslating(true)
        setProgress({
          phase: 'translating',
          message: t.translating,
          currentBatch: 0,
          totalBatches: 0,
        })
        startPolling(savedJobId)
        return
      }

      // Also check DB for active jobs (in case localStorage was cleared)
      try {
        const activeJob = await getActiveTranslationJob()
        if (activeJob) {
          localStorage.setItem(STORAGE_KEY, activeJob.id)
          setActiveJobId(activeJob.id)
          setIsTranslating(true)
          if (activeJob.sourceLang) setSourceLang(activeJob.sourceLang as LangCode)
          if (activeJob.targetLang) setTargetLang(activeJob.targetLang as LangCode)
          setProgress({
            phase: 'translating',
            message: t.translating,
            currentBatch: 0,
            totalBatches: 0,
          })
          startPolling(activeJob.id)
        }
      } catch {
        // Not critical — user can start a new translation
      }
    }

    checkForActiveJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── History ────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const items = await getTranslationHistory()
      setHistoryItems(items)
    } catch (err) {
      console.error('Failed to load translation history:', err)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Load a specific translation from history
  const handleSelectHistory = useCallback(
    async (id: string) => {
      try {
        const item = await getTranslationById(id)
        setActiveHistoryId(id)
        setSourceLang(item.sourceLang as LangCode)
        setTargetLang(item.targetLang as LangCode)
        setDocxState(null)

        if (item.sourceText) {
          setSourceText(item.sourceText)
        }
        if (item.translatedText) {
          setResult({
            translatedText: item.translatedText,
            paragraphCount: item.paragraphCount ?? 0,
            domain: {
              primaryDomain: item.domain ?? 'legal',
              secondaryDomain: null,
            },
          })
        }
      } catch (err) {
        console.error('Failed to load translation:', err)
      }
    },
    [],
  )

  // Download a past translation (docx or txt)
  const handleDownloadHistory = useCallback(async (id: string) => {
    try {
      const data = await getTranslationDownloadData(id)

      if (data.translatedDocxBase64) {
        // Download as DOCX
        const byteChars = atob(data.translatedDocxBase64)
        const byteArr = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
        const blob = new Blob([byteArr], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const baseName = data.docxFileName
          ? data.docxFileName.replace(/\.docx$/i, '')
          : 'translation'
        a.download = `${baseName}_${data.targetLang}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (data.translatedText) {
        // Download as DOCX (generated from plain text)
        const { Document, Paragraph, TextRun, Packer } = await import('docx')
        const paragraphs = data.translatedText.split('\n').map(
          (line: string) =>
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              spacing: { after: 120 },
            })
        )
        const doc = new Document({
          sections: [{ children: paragraphs }],
        })
        const buffer = await Packer.toBlob(doc)
        const url = URL.createObjectURL(buffer)
        const a = document.createElement('a')
        a.href = url
        a.download = `translation_${data.sourceLang}_to_${data.targetLang}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to download translation:', err)
    }
  }, [])

  // Push history data up to the layout-level ChatHistoryProvider
  const setChatHistory = useSetChatHistory()

  useEffect(() => {
    setChatHistory({
      conversations: historyItems.map((h) => ({
        id: h.id,
        title: h.title,
        updatedAt: h.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      activeConversationId: activeHistoryId ?? undefined,
      onSelectConversation: handleSelectHistory,
      onNewConversation: () => {
        setActiveHistoryId(null)
        setResult(null)
        setSourceText('')
        setError(null)
        setDetectedLang(null)
        setLoadedFileName(null)
        setDocxState(null)
      },
      onDownload: handleDownloadHistory,
    })
  }, [historyItems, activeHistoryId, handleSelectHistory, handleDownloadHistory, setChatHistory])

  // Clean up history context when unmounting
  useEffect(() => {
    return () => setChatHistory(null)
  }, [setChatHistory])

  // ─── Auto-detect language ───────────────────────────────────────────

  useEffect(() => {
    if (sourceText.length < 50) {
      setDetectedLang(null)
      return
    }

    const timer = setTimeout(() => {
      const detection = detectDocumentLanguage(sourceText)
      setDetectedLang({ lang: detection.detectedLang, confidence: detection.confidence })

      if (detection.confidence >= 0.5) {
        setSourceLang(detection.detectedLang)
        if (detection.detectedLang === 'el') setTargetLang('en')
        else if (detection.detectedLang === 'en') setTargetLang('el')
        else setTargetLang('en')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [sourceText])

  // Auto-detect language for DOCX mode when paragraphs are loaded
  useEffect(() => {
    if (!docxState || docxState.paragraphs.length === 0) return
    const sampleText = docxState.paragraphs.slice(0, 10).join('\n')
    if (sampleText.length < 50) return

    const detection = detectDocumentLanguage(sampleText)
    setDetectedLang({ lang: detection.detectedLang, confidence: detection.confidence })

    if (detection.confidence >= 0.5) {
      setSourceLang(detection.detectedLang)
      if (detection.detectedLang === 'el') setTargetLang('en')
      else if (detection.detectedLang === 'en') setTargetLang('el')
      else setTargetLang('en')
    }
  }, [docxState])

  // ─── Language controls ──────────────────────────────────────────────

  const swapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setResult(null)
  }

  const selectSource = (code: LangCode) => {
    if (code === targetLang) setTargetLang(sourceLang)
    setSourceLang(code)
    setResult(null)
  }

  const selectTarget = (code: LangCode) => {
    if (code === sourceLang) setSourceLang(targetLang)
    setTargetLang(code)
    setResult(null)
  }

  // ─── File handling ──────────────────────────────────────────────────

  const handleDocxFile = useCallback(async (file: File) => {
    setIsExtractingFile(true)
    setError(null)
    setSourceText('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/${locale}/api/translate/docx-extract`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || t.extractionFailed)
      }

      const data = await res.json()
      setDocxState({
        docxBase64: data.docxBase64,
        paragraphs: data.paragraphs,
        fileName: data.fileName || file.name,
        translatedDocxBase64: null,
      })
      setLoadedFileName(data.fileName || file.name)
    } catch (err) {
      console.error('DOCX extraction error:', err)
      setError(err instanceof Error ? err.message : t.extractionFailed)
    } finally {
      setIsExtractingFile(false)
    }
  }, [locale, t])

  const extractTextFromFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    const supportedExts = ['.txt', '.md', '.html', '.htm', '.csv', '.pdf', '.docx', '.doc', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx', '.eml', '.msg']
    const ext = name.slice(name.lastIndexOf('.'))
    if (!supportedExts.includes(ext)) {
      setError(t.unsupportedFile)
      return
    }

    if (isDocxFile(name)) {
      await handleDocxFile(file)
      return
    }

    setIsExtractingFile(true)
    setError(null)
    setDocxState(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/${locale}/api/translate/extract-text`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || t.extractionFailed)
      }

      const data = await res.json()
      if (!data.text || typeof data.text !== 'string') {
        throw new Error(t.extractionFailed)
      }

      setSourceText(data.text)
      setLoadedFileName(data.fileName || file.name)
      setResult(null)
    } catch (err) {
      console.error('File extraction error:', err)
      setError(err instanceof Error ? err.message : t.extractionFailed)
    } finally {
      setIsExtractingFile(false)
    }
  }, [locale, t, handleDocxFile])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await extractTextFromFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [extractTextFromFile])

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await extractTextFromFile(file)
    }
  }, [extractTextFromFile])

  // ─── Translation handler (job-based) ────────────────────────────────

  const handleTranslate = useCallback(async () => {
    // Validate input
    if (!isDocxMode && !sourceText.trim()) {
      setError(t.noContent)
      return
    }
    if (isDocxMode && (!docxState || docxState.paragraphs.length === 0)) {
      setError(t.noContent)
      return
    }

    setIsTranslating(true)
    setResult(null)
    setProgress(null)
    setError(null)

    setProgress({
      phase: 'preparing',
      message: t.analyzingDomain,
      currentBatch: 0,
      totalBatches: 0,
    })

    try {
      // Build request body
      const body: Record<string, unknown> = {
        sourceLang,
        targetLang,
      }

      if (isDocxMode && docxState) {
        body.isDocx = true
        body.docxBase64 = docxState.docxBase64
        body.docxFileName = docxState.fileName
        body.paragraphs = docxState.paragraphs
      } else {
        body.sourceText = sourceText
      }

      // Call /api/translate/start to create job
      const res = await fetch(`/${locale}/api/translate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `Failed to start translation (${res.status})`)
      }

      const { jobId } = await res.json()

      // Save jobId for cross-page tracking
      setActiveJobId(jobId)
      localStorage.setItem(STORAGE_KEY, jobId)

      // Start polling for progress
      startPolling(jobId)
    } catch (err) {
      console.error('Translation start error:', err)
      setError(err instanceof Error ? err.message : t.errorTranslating)
      setIsTranslating(false)
      setProgress(null)
    }
  }, [isDocxMode, docxState, sourceText, sourceLang, targetLang, locale, t, startPolling])

  // ─── Action handlers ────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!result?.translatedText) return
    await navigator.clipboard.writeText(result.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadTxt = async () => {
    if (!result?.translatedText) return
    // Generate DOCX from plain text translation
    const { Document, Paragraph, TextRun, Packer } = await import('docx')
    const paragraphs = result.translatedText.split('\n').map(
      (line: string) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 120 },
        })
    )
    const doc = new Document({
      sections: [{ children: paragraphs }],
    })
    const buffer = await Packer.toBlob(doc)
    const url = URL.createObjectURL(buffer)
    const a = document.createElement('a')
    a.href = url
    const baseName = loadedFileName
      ? loadedFileName.replace(/\.[^.]+$/, '')
      : `translation_${sourceLang}_to_${targetLang}`
    a.download = `${baseName}_${targetLang}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDocx = () => {
    if (!docxState?.translatedDocxBase64) return

    const binaryString = atob(docxState.translatedDocxBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = docxState.fileName.replace(/\.docx$/i, '')
    a.download = `${baseName}_${targetLang}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNewTranslation = () => {
    setResult(null)
    setSourceText('')
    setError(null)
    setDetectedLang(null)
    setLoadedFileName(null)
    setDocxState(null)
  }

  const src = getLang(sourceLang)
  const tgt = getLang(targetLang)

  const canTranslate = isDocxMode
    ? docxState.paragraphs.length > 0 && sourceLang !== targetLang
    : sourceText.trim().length > 0 && sourceLang !== targetLang

  // ─── Loading state with progress ──────────────────────────────────
  if (isTranslating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
        <p className="text-sm font-medium text-gray-700 mb-1">
          {progress ? progress.message : t.preparing}
        </p>
        {progress && progress.totalBatches > 0 && (
          <div className="w-full max-w-xs mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                {progress.phase === 'preparing'
                  ? t.analyzing
                  : progress.phase === 'building'
                    ? t.buildingDocx
                    : `${t.section} ${progress.currentBatch}/${progress.totalBatches}`}
              </span>
              <span className="text-[10px] text-gray-500 font-bold">
                {progress.phase === 'preparing'
                  ? '...'
                  : progress.phase === 'building'
                    ? '99%'
                    : `${Math.round((progress.currentBatch / progress.totalBatches) * 100)}%`}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#c5032a] rounded-full transition-all duration-500 ease-out"
                style={{
                  width:
                    progress.phase === 'preparing'
                      ? '5%'
                      : progress.phase === 'building'
                        ? '99%'
                        : `${(progress.currentBatch / progress.totalBatches) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Results view ─────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {t.translationComplete}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {result.paragraphCount} {t.paragraphsTranslated}
                    {result.domain.primaryDomain !== 'legal' && (
                      <span className="ml-2 text-gray-400">
                        {t.legalDomain} {result.domain.primaryDomain}
                        {result.domain.secondaryDomain && `, ${result.domain.secondaryDomain}`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNewTranslation}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#c5032a] hover:bg-[#a5021f] rounded-lg transition-colors"
                >
                  <Languages className="w-3.5 h-3.5" />
                  {t.newTranslation}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? t.copied : t.copy}
                </button>
                {docxState?.translatedDocxBase64 ? (
                  <button
                    onClick={handleDownloadDocx}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#c5032a] hover:bg-[#a5021f] rounded-lg transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {t.downloadDocx}
                  </button>
                ) : (
                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#c5032a] hover:bg-[#a5021f] rounded-lg transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {t.download}
                  </button>
                )}
              </div>
            </div>

            {/* Language pair indicator */}
            <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-sm">{src.flag}</span>
              <span className="text-xs font-medium text-gray-900">{src.name}</span>
              <span className="text-gray-300">&rarr;</span>
              <span className="text-sm">{tgt.flag}</span>
              <span className="text-xs font-medium text-gray-900">{tgt.name}</span>
            </div>

            {/* DOCX mode: side-by-side document previews */}
            {docxState?.translatedDocxBase64 ? (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Original document */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                      {t.originalDocument}
                    </p>
                  </div>
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-96">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </div>
                  }>
                    <DocxPreview
                      docxBase64={docxState.docxBase64}
                      className="h-[600px]"
                    />
                  </Suspense>
                </div>

                {/* Translated document */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 bg-green-50">
                    <p className="text-[10px] uppercase tracking-wider text-green-600 font-medium">
                      {t.translatedDocument}
                    </p>
                  </div>
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-96">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </div>
                  }>
                    <DocxPreview
                      docxBase64={docxState.translatedDocxBase64}
                      className="h-[600px]"
                    />
                  </Suspense>
                </div>
              </div>
            ) : (
              /* Plain text result */
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {result.translatedText}
                </div>
              </div>
            )}

            {/* Secondary plain-text DOCX download removed — main button already generates DOCX */}

            {/* New translation button */}
            <button
              onClick={handleNewTranslation}
              className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              {t.newTranslation}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main input view ──────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gray-100">
              <Languages className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{t.title}</h1>
              <p className="text-xs text-gray-500">{t.subtitle}</p>
            </div>
          </div>

          {/* Auto-detected language indicator */}
          {detectedLang && detectedLang.confidence >= 0.5 && (
            <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-blue-50/50 border border-blue-100">
              <ScanSearch className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <p className="text-[11px] text-blue-700">
                {t.detected}{' '}
                <span className="font-semibold">{getLang(detectedLang.lang).name}</span>{' '}
                {t.document}
                {detectedLang.confidence >= 0.8
                  ? ` ${t.highConfidence}`
                  : ` ${t.verifySelection}`}
              </p>
            </div>
          )}

          {/* Language pair selector */}
          <div className="rounded-xl border border-gray-200 p-4 mb-4 bg-gray-50/30">
            <div className="flex items-center gap-3">
              {/* Source lang */}
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-medium">
                  {t.from}
                </p>
                <div className="flex flex-col gap-1.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      type="button"
                      key={`src-${lang.code}`}
                      onClick={() => selectSource(lang.code)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                        sourceLang === lang.code
                          ? 'bg-white border border-gray-900 shadow-sm'
                          : 'hover:bg-gray-50 border border-transparent',
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <div>
                        <p className={cn(
                          'text-xs font-semibold',
                          sourceLang === lang.code ? 'text-gray-900' : 'text-gray-500',
                        )}>
                          {lang.name}
                        </p>
                        <p className="text-[10px] text-gray-400">{lang.nativeName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Swap button */}
              <button
                type="button"
                onClick={swapLanguages}
                className="flex-shrink-0 p-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow active:scale-95"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {/* Target lang */}
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-medium">
                  {t.to}
                </p>
                <div className="flex flex-col gap-1.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      type="button"
                      key={`tgt-${lang.code}`}
                      onClick={() => selectTarget(lang.code)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                        targetLang === lang.code
                          ? 'bg-white border border-gray-900 shadow-sm'
                          : 'hover:bg-gray-50 border border-transparent',
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <div>
                        <p className={cn(
                          'text-xs font-semibold',
                          targetLang === lang.code ? 'text-gray-900' : 'text-gray-500',
                        )}>
                          {lang.name}
                        </p>
                        <p className="text-[10px] text-gray-400">{lang.nativeName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected pair indicator */}
            <div className="mt-4 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white border border-gray-100">
              <span className="text-sm">{src.flag}</span>
              <span className="text-xs font-medium text-gray-900">{src.name}</span>
              <span className="text-gray-300">&rarr;</span>
              <span className="text-sm">{tgt.flag}</span>
              <span className="text-xs font-medium text-gray-900">{tgt.name}</span>
            </div>
          </div>

          {/* Input area: DOCX preview or plain text textarea */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'rounded-xl border-2 mb-4 bg-white overflow-hidden transition-all duration-200 relative',
              isDragOver
                ? 'border-[#c5032a] bg-red-50/30 shadow-lg'
                : 'border-gray-200',
            )}
          >
            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-50/80 backdrop-blur-sm">
                <Upload className="w-8 h-8 text-[#c5032a] mb-2" />
                <p className="text-sm font-medium text-[#c5032a]">{t.dropFileHere}</p>
                <p className="text-[10px] text-[#c5032a]/60 mt-1">{t.supportedFormats}</p>
              </div>
            )}

            {/* Extracting file overlay */}
            {isExtractingFile && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">{t.extractingText}</p>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                  {isDocxMode ? t.documentPreview : t.pasteOrUpload}
                </p>
                {loadedFileName && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded">
                    <FileText className="w-3 h-3" />
                    {loadedFileName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isDocxMode && sourceText && (
                  <span className="text-[10px] text-gray-400">
                    {sourceText.length.toLocaleString()} {t.charCount}
                  </span>
                )}
                {isDocxMode && (
                  <span className="text-[10px] text-gray-400">
                    {docxState.paragraphs.length} paragraphs
                  </span>
                )}
                {(sourceText || isDocxMode) && (
                  <button
                    onClick={() => { setSourceText(''); setResult(null); setDetectedLang(null); setLoadedFileName(null); setDocxState(null) }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                    {t.clearText}
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  {t.uploadFile}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.html,.htm,.csv,.pdf,.docx,.doc,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.eml,.msg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Content area */}
            {isDocxMode ? (
              <Suspense fallback={
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
              }>
                <DocxPreview
                  docxBase64={docxState.docxBase64}
                  className="h-[500px]"
                />
              </Suspense>
            ) : (
              <textarea
                ref={textareaRef}
                value={sourceText}
                onChange={(e) => { setSourceText(e.target.value); setResult(null); setLoadedFileName(null) }}
                placeholder={t.placeholder}
                rows={12}
                className="w-full px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
              />
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-red-50 border border-red-100">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={isTranslating || !canTranslate}
            className="w-full py-3 rounded-xl text-sm font-medium gap-2 flex items-center justify-center
                       bg-[#c5032a] hover:bg-[#a5021f] text-white shadow-sm hover:shadow-md
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isTranslating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isTranslating ? t.translating : t.translateBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
