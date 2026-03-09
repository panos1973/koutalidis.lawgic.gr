'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { detectDocumentLanguage, type LangCode } from '@/lib/translate/detect-language'

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
    download: 'Λήψη .txt',
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
    supportedFormats: 'TXT, PDF, DOCX',
    clearText: 'Καθαρισμός',
    charCount: 'χαρακτήρες',
    translationResult: 'Αποτέλεσμα Μετάφρασης',
    newTranslation: 'Νέα Μετάφραση',
    dropFileHere: 'Αφήστε το αρχείο εδώ',
    extractingText: 'Εξαγωγή κειμένου...',
    fileLoaded: 'Φορτώθηκε από',
    unsupportedFile: 'Μη υποστηριζόμενος τύπος αρχείου. Υποστηρίζονται: TXT, DOCX, DOC, PDF',
    extractionFailed: 'Αποτυχία εξαγωγής κειμένου από το αρχείο.',
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
    download: 'Download .txt',
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
    supportedFormats: 'TXT, PDF, DOCX',
    clearText: 'Clear',
    charCount: 'characters',
    translationResult: 'Translation Result',
    newTranslation: 'New Translation',
    dropFileHere: 'Drop file here',
    extractingText: 'Extracting text...',
    fileLoaded: 'Loaded from',
    unsupportedFile: 'Unsupported file type. Supported: TXT, DOCX, DOC, PDF',
    extractionFailed: 'Failed to extract text from file.',
  },
}

// ─── Progress type ──────────────────────────────────────────────────
interface TranslationProgress {
  phase: 'preparing' | 'translating' | 'complete'
  currentBatch: number
  totalBatches: number
  message: string
}

interface TranslationResult {
  translatedText: string
  paragraphCount: number
  domain: { primaryDomain: string; secondaryDomain: string | null }
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Auto-detect language when text changes (debounced)
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

  // Extract text from a file — always uses server API for binary formats
  const extractTextFromFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    const isTxt = name.endsWith('.txt')
    const isBinary = name.endsWith('.docx') || name.endsWith('.doc') || name.endsWith('.pdf')

    if (!isTxt && !isBinary) {
      setError(t.unsupportedFile)
      return
    }

    setIsExtractingFile(true)
    setError(null)

    try {
      // ALL file types go through the server API for reliable extraction
      // (even .txt for consistency, but especially DOCX/DOC/PDF which are binary)
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
  }, [locale, t])

  // Handle file input change
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
    // Only set false if we actually left the drop zone
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

  // Main translation handler
  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) {
      setError(t.noContent)
      return
    }

    setIsTranslating(true)
    setResult(null)
    setProgress(null)
    setError(null)

    try {
      // Phase 1: Prepare — split paragraphs, detect domain
      setProgress({
        phase: 'preparing',
        message: t.analyzingDomain,
        currentBatch: 0,
        totalBatches: 0,
      })

      const prepareRes = await fetch(`/${locale}/api/translate/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sourceText,
          sourceLang,
          targetLang,
        }),
      })

      if (!prepareRes.ok) {
        const errData = await prepareRes.json().catch(() => null)
        throw new Error(errData?.error || `Preparation failed (${prepareRes.status})`)
      }

      const prepareData = await prepareRes.json()
      const {
        paragraphs,
        domain,
        totalBatches,
        batchSize,
      }: {
        paragraphs: string[]
        domain: { primaryDomain: string; secondaryDomain: string | null }
        totalBatches: number
        batchSize: number
      } = prepareData

      // Phase 2: Translate each batch individually (avoids timeout)
      const allTranslations: string[] = []

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchTexts = paragraphs.slice(
          batchIdx * batchSize,
          (batchIdx + 1) * batchSize,
        )

        setProgress({
          phase: 'translating',
          message: `${t.translatingSection} ${batchIdx + 1} ${t.of} ${totalBatches}...`,
          currentBatch: batchIdx + 1,
          totalBatches,
        })

        const batchRes = await fetch(`/${locale}/api/translate/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: batchTexts,
            sourceLang,
            targetLang,
            domain,
          }),
        })

        if (!batchRes.ok) {
          const errData = await batchRes.json().catch(() => null)
          throw new Error(
            errData?.error || `Batch ${batchIdx + 1} failed (${batchRes.status})`,
          )
        }

        const { translations }: { translations: string[] } = await batchRes.json()
        allTranslations.push(...translations)
      }

      // Phase 3: Combine results
      const translatedText = allTranslations
        .filter((t) => t.trim().length > 0)
        .join('\n\n')

      setResult({
        translatedText,
        paragraphCount: paragraphs.length,
        domain,
      })
    } catch (err) {
      console.error('Translation error:', err)
      setError(err instanceof Error ? err.message : t.errorTranslating)
    } finally {
      setIsTranslating(false)
      setProgress(null)
    }
  }, [sourceText, sourceLang, targetLang, locale, t])

  const handleCopy = async () => {
    if (!result?.translatedText) return
    await navigator.clipboard.writeText(result.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!result?.translatedText) return
    const blob = new Blob([result.translatedText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `translation_${sourceLang}_to_${targetLang}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNewTranslation = () => {
    setResult(null)
    setSourceText('')
    setError(null)
    setDetectedLang(null)
    setLoadedFileName(null)
  }

  const src = getLang(sourceLang)
  const tgt = getLang(targetLang)

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
                  : `${t.section} ${progress.currentBatch}/${progress.totalBatches}`}
              </span>
              <span className="text-[10px] text-gray-500 font-bold">
                {progress.phase === 'preparing'
                  ? '...'
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
          <div className="max-w-4xl mx-auto">
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
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? t.copied : t.copy}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.download}
                </button>
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

            {/* Translation text */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {result.translatedText}
              </div>
            </div>

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

          {/* Text input area with drag-and-drop */}
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

            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                  {t.pasteOrUpload}
                </p>
                {loadedFileName && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded">
                    <FileText className="w-3 h-3" />
                    {loadedFileName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {sourceText && (
                  <>
                    <span className="text-[10px] text-gray-400">
                      {sourceText.length.toLocaleString()} {t.charCount}
                    </span>
                    <button
                      onClick={() => { setSourceText(''); setResult(null); setDetectedLang(null); setLoadedFileName(null) }}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                      {t.clearText}
                    </button>
                  </>
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
                  accept=".txt,.pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={sourceText}
              onChange={(e) => { setSourceText(e.target.value); setResult(null); setLoadedFileName(null) }}
              placeholder={t.placeholder}
              rows={12}
              className="w-full px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
            />
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
            disabled={isTranslating || sourceLang === targetLang || !sourceText.trim()}
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
