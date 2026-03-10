'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  Plus,
  Upload,
  Play,
  Loader2,
  Trash2,
  X,
  Pencil,
  Check,
  Download,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  LayoutTemplate,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  addTabularReviewColumn,
  addTabularReviewDocument,
  deleteTabularReviewColumn,
  deleteTabularReviewDocument,
  updateTabularReviewTitle,
  updateCellValue,
  updateCellReviewStatus,
  updateCellLockStatus,
  toggleRowReviewStatus,
  createPendingCells,
  createPendingCellsForColumn,
} from '@/app/[locale]/actions/tabular_review_actions'
import { AddColumnDialog } from './AddColumnDialog'
import { CellContent } from './CellContent'

interface Review {
  id: string
  title: string
  language: string | null
  userId?: string
  [key: string]: any
}

interface Column {
  id: string
  reviewId: string
  label: string
  prompt: string
  format: string | null
  sortOrder: number | null
}

interface Document {
  id: string
  reviewId: string
  fileName: string
  textContent: string | null
  sortOrder: number | null
}

interface Cell {
  id: string
  reviewId: string
  documentId: string
  columnId: string
  value: string | null
  reasoning: string | null
  sources: string | null
  status: string | null
  error: string | null
  isManualEdit: boolean | null
  isReviewed: boolean | null
  isLocked: boolean | null
}

interface Props {
  review: Review
  initialColumns: Column[]
  initialDocuments: Document[]
  initialCells: Cell[]
  userId?: string
}

interface SortConfig {
  columnId: string | null
  direction: 'asc' | 'desc'
}

interface FilterConfig {
  columnId: string
  query: string
}

// ─── DD TEMPLATES ──────────────────────────────────────────────────
const DD_TEMPLATES = {
  ma: {
    label: 'M&A Due Diligence',
    labelEl: 'Due Diligence Εξαγορών',
    columns: [
      { label: 'Document Type', labelEl: 'Τύπος Εγγράφου', prompt: 'Classify the document type (e.g., SPA, NDA, loan agreement, lease, employment contract, etc.) based on its content.', format: 'text' },
      { label: 'Parties', labelEl: 'Συμβαλλόμενα Μέρη', prompt: 'List all parties to the agreement, including their full legal names, roles, and jurisdictions.', format: 'text' },
      { label: 'Key Terms', labelEl: 'Βασικοί Όροι', prompt: 'Identify and summarize the key terms of the agreement, including subject matter, duration, financial terms, and governing law.', format: 'text' },
      { label: 'Change of Control', labelEl: 'Αλλαγή Ελέγχου', prompt: 'Identify whether the document contains a change of control clause. If yes, describe trigger events, consequences, and consent requirements.', format: 'boolean' },
      { label: 'Termination', labelEl: 'Καταγγελία', prompt: 'Describe the termination provisions, including grounds, notice requirements, and consequences.', format: 'text' },
      { label: 'Governing Law', labelEl: 'Εφαρμοστέο Δίκαιο', prompt: 'Identify the governing law and dispute resolution mechanism (courts or arbitration).', format: 'text' },
    ],
  },
  contract: {
    label: 'Contract Review',
    labelEl: 'Επισκόπηση Συμβάσεων',
    columns: [
      { label: 'Parties', labelEl: 'Συμβαλλόμενα Μέρη', prompt: 'List all parties with their full legal names and roles.', format: 'text' },
      { label: 'Effective Date', labelEl: 'Ημερομηνία Έναρξης', prompt: 'Extract the effective date or execution date of the agreement.', format: 'date' },
      { label: 'Term / Duration', labelEl: 'Διάρκεια', prompt: 'What is the term or duration of this agreement? Include any renewal provisions.', format: 'text' },
      { label: 'Financial Terms', labelEl: 'Οικονομικοί Όροι', prompt: 'Extract all financial terms: amounts, payment schedules, pricing, fees, and any caps or floors.', format: 'text' },
      { label: 'Warranties', labelEl: 'Εγγυήσεις', prompt: 'List all representations and warranties, including which party provides them and any qualifications.', format: 'text' },
      { label: 'Indemnification', labelEl: 'Αποζημίωση', prompt: 'Identify indemnification provisions, covered losses, caps, baskets, and time limitations.', format: 'text' },
      { label: 'Termination', labelEl: 'Καταγγελία', prompt: 'Describe termination provisions, grounds, notice requirements, and consequences.', format: 'text' },
      { label: 'Governing Law', labelEl: 'Εφαρμοστέο Δίκαιο', prompt: 'Identify governing law and dispute resolution mechanism.', format: 'text' },
    ],
  },
  compliance: {
    label: 'Compliance Check',
    labelEl: 'Έλεγχος Συμμόρφωσης',
    columns: [
      { label: 'Document Type', labelEl: 'Τύπος Εγγράφου', prompt: 'Classify the document type based on its content.', format: 'text' },
      { label: 'Regulatory References', labelEl: 'Κανονιστικές Αναφορές', prompt: 'List all references to laws, regulations, directives, or regulatory authorities mentioned in the document.', format: 'list' },
      { label: 'Obligations', labelEl: 'Υποχρεώσεις', prompt: 'List all compliance obligations, reporting requirements, or mandatory actions specified in the document.', format: 'text' },
      { label: 'Deadlines', labelEl: 'Προθεσμίες', prompt: 'Extract all deadlines, filing dates, and time-sensitive requirements.', format: 'text' },
      { label: 'Risk Flags', labelEl: 'Σημεία Κινδύνου', prompt: 'Identify any potential compliance risks, ambiguities, or areas requiring further review.', format: 'text' },
    ],
  },
  litigation: {
    label: 'Litigation Review',
    labelEl: 'Επισκόπηση Δικαστικών Υποθέσεων',
    columns: [
      { label: 'Document Type', labelEl: 'Τύπος Εγγράφου', prompt: 'Classify the document type (e.g., complaint, motion, brief, contract, correspondence).', format: 'text' },
      { label: 'Key Persons', labelEl: 'Βασικά Πρόσωπα', prompt: 'List all persons mentioned, including their roles and affiliations.', format: 'list' },
      { label: 'Key Dates', labelEl: 'Βασικές Ημερομηνίες', prompt: 'Extract all significant dates and events referenced in the document.', format: 'text' },
      { label: 'Key Facts', labelEl: 'Βασικά Γεγονότα', prompt: 'Summarize the key facts and allegations described in the document.', format: 'text' },
      { label: 'Relevance', labelEl: 'Συνάφεια', prompt: 'Assess the potential relevance of this document. Is it highly relevant, somewhat relevant, or low relevance to a legal dispute? Explain briefly.', format: 'text' },
    ],
  },
}

export function TabularReviewWorkspace({
  review,
  initialColumns,
  initialDocuments,
  initialCells,
  userId,
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [cells, setCells] = useState<Cell[]>(initialCells)
  const [isUploading, setIsUploading] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set())
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(review.title)

  // Sorting & filtering state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    columnId: null,
    direction: 'asc',
  })
  const [filters, setFilters] = useState<FilterConfig[]>([])
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)
  const [filterInput, setFilterInput] = useState('')

  // Get cell for a document × column intersection
  const getCell = useCallback(
    (documentId: string, columnId: string): Cell | undefined => {
      return cells.find(
        (c) => c.documentId === documentId && c.columnId === columnId
      )
    },
    [cells]
  )

  // Filtered and sorted documents
  const processedDocuments = useMemo(() => {
    let docs = [...documents]

    // Apply filters
    for (const filter of filters) {
      if (!filter.query.trim()) continue
      const query = filter.query.toLowerCase()

      if (filter.columnId === '__filename__') {
        docs = docs.filter((doc) =>
          doc.fileName.toLowerCase().includes(query)
        )
      } else {
        docs = docs.filter((doc) => {
          const cell = cells.find(
            (c) => c.documentId === doc.id && c.columnId === filter.columnId
          )
          return cell?.value?.toLowerCase().includes(query) ?? false
        })
      }
    }

    // Apply sorting
    if (sortConfig.columnId) {
      const { columnId, direction } = sortConfig

      docs.sort((a, b) => {
        let aVal = ''
        let bVal = ''

        if (columnId === '__filename__') {
          aVal = a.fileName.toLowerCase()
          bVal = b.fileName.toLowerCase()
        } else {
          const aCell = cells.find(
            (c) => c.documentId === a.id && c.columnId === columnId
          )
          const bCell = cells.find(
            (c) => c.documentId === b.id && c.columnId === columnId
          )
          aVal = (aCell?.value || '').toLowerCase()
          bVal = (bCell?.value || '').toLowerCase()
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1
        if (aVal > bVal) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return docs
  }, [documents, cells, filters, sortConfig])

  // Toggle sort for a column
  const toggleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev.columnId === columnId) {
        if (prev.direction === 'asc') return { columnId, direction: 'desc' }
        return { columnId: null, direction: 'asc' }
      }
      return { columnId, direction: 'asc' }
    })
  }

  // Add/update filter
  const applyFilter = (columnId: string, query: string) => {
    setFilters((prev) => {
      const existing = prev.findIndex((f) => f.columnId === columnId)
      if (!query.trim()) {
        return prev.filter((f) => f.columnId !== columnId)
      }
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { columnId, query }
        return updated
      }
      return [...prev, { columnId, query }]
    })
    setActiveFilterColumn(null)
    setFilterInput('')
  }

  // Upload files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/${locale}/api/translate/extract-text`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          console.error(`Failed to extract text from ${file.name}`)
          continue
        }

        const data = await res.json()
        const doc = await addTabularReviewDocument(
          review.id,
          file.name,
          data.text,
          file.type,
          file.size
        )

        if (columns.length > 0) {
          const newCells = await createPendingCells(
            review.id,
            doc.id,
            columns.map((c) => c.id)
          )
          setCells((prev) => [...prev, ...newCells])
        }

        setDocuments((prev) => [...prev, doc])
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Add column
  const handleAddColumn = async (
    label: string,
    prompt: string,
    format: string
  ) => {
    try {
      const column = await addTabularReviewColumn(
        review.id,
        label,
        prompt,
        format
      )
      setColumns((prev) => [...prev, column])

      if (documents.length > 0) {
        const newCells = await createPendingCellsForColumn(
          review.id,
          column.id,
          documents.map((d) => d.id)
        )
        setCells((prev) => [...prev, ...newCells])
      }

      setShowAddColumn(false)
    } catch (error) {
      console.error('Error adding column:', error)
    }
  }

  // Apply template - add multiple columns at once
  const handleApplyTemplate = async (templateKey: string) => {
    const template = DD_TEMPLATES[templateKey as keyof typeof DD_TEMPLATES]
    if (!template) return

    setShowTemplates(false)

    for (const col of template.columns) {
      const colLabel = locale === 'el' ? col.labelEl : col.label
      const langNote = locale === 'el' ? ' Respond in Greek.' : ' Respond in English.'
      try {
        const column = await addTabularReviewColumn(
          review.id,
          colLabel,
          col.prompt + langNote,
          col.format
        )
        setColumns((prev) => [...prev, column])

        if (documents.length > 0) {
          const newCells = await createPendingCellsForColumn(
            review.id,
            column.id,
            documents.map((d) => d.id)
          )
          setCells((prev) => [...prev, ...newCells])
        }
      } catch (error) {
        console.error('Error adding template column:', error)
      }
    }
  }

  // Delete column
  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm(locale === 'el' ? 'Διαγραφή στήλης;' : 'Delete this column?'))
      return
    await deleteTabularReviewColumn(columnId)
    setColumns((prev) => prev.filter((c) => c.id !== columnId))
    setCells((prev) => prev.filter((c) => c.columnId !== columnId))
  }

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    await deleteTabularReviewDocument(documentId)
    setDocuments((prev) => prev.filter((d) => d.id !== documentId))
    setCells((prev) => prev.filter((c) => c.documentId !== documentId))
  }

  // Run extraction for a single cell
  const runCell = async (cell: Cell, doc: Document, col: Column) => {
    if (!doc.textContent) return
    if (cell.isLocked) return

    setRunningCells((prev) => new Set(prev).add(cell.id))
    setCells((prev) =>
      prev.map((c) =>
        c.id === cell.id ? { ...c, status: 'running' } : c
      )
    )

    try {
      const res = await fetch(`/${locale}/api/tabular-review/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cellId: cell.id,
          documentText: doc.textContent,
          columnPrompt: col.prompt,
          columnFormat: col.format || 'text',
          language: review.language || locale,
        }),
      })

      if (!res.ok) throw new Error('Extraction failed')

      const data = await res.json()
      setCells((prev) =>
        prev.map((c) =>
          c.id === cell.id
            ? {
                ...c,
                value: data.value,
                reasoning: data.reasoning || null,
                sources: data.sources || null,
                status: 'completed',
                error: null,
              }
            : c
        )
      )
    } catch (error: any) {
      setCells((prev) =>
        prev.map((c) =>
          c.id === cell.id
            ? { ...c, status: 'error', error: error.message }
            : c
        )
      )
    } finally {
      setRunningCells((prev) => {
        const next = new Set(prev)
        next.delete(cell.id)
        return next
      })
    }
  }

  // Run all pending/error cells
  const runAll = async () => {
    const pendingCells = cells.filter(
      (c) =>
        (c.status === 'pending' || c.status === 'error') &&
        c.isLocked !== true
    )

    const batchSize = 5
    for (let i = 0; i < pendingCells.length; i += batchSize) {
      const batch = pendingCells.slice(i, i + batchSize)
      await Promise.all(
        batch.map((cell) => {
          const doc = documents.find((d) => d.id === cell.documentId)
          const col = columns.find((c) => c.id === cell.columnId)
          if (doc && col) return runCell(cell, doc, col)
          return Promise.resolve()
        })
      )
    }
  }

  // Save title
  const saveTitle = async () => {
    await updateTabularReviewTitle(review.id, title)
    setEditingTitle(false)
  }

  // Toggle review on a cell
  const handleToggleReview = async (cell: Cell) => {
    const newReviewed = !(cell.isReviewed === true)
    setCells((prev) =>
      prev.map((c) =>
        c.id === cell.id ? { ...c, isReviewed: newReviewed } : c
      )
    )
    await updateCellReviewStatus(cell.id, newReviewed, userId || '')
  }

  // Toggle lock on a cell
  const handleToggleLock = async (cell: Cell) => {
    const newLocked = !(cell.isLocked === true)
    setCells((prev) =>
      prev.map((c) =>
        c.id === cell.id ? { ...c, isLocked: newLocked } : c
      )
    )
    await updateCellLockStatus(cell.id, newLocked)
  }

  // Toggle review for entire row
  const handleToggleRowReview = async (docId: string) => {
    const docCells = cells.filter(
      (c) => c.documentId === docId && c.status === 'completed'
    )
    const allReviewed = docCells.every((c) => c.isReviewed === true)
    const newReviewed = !allReviewed

    setCells((prev) =>
      prev.map((c) =>
        c.documentId === docId && c.status === 'completed'
          ? { ...c, isReviewed: newReviewed }
          : c
      )
    )
    await toggleRowReviewStatus(review.id, docId, newReviewed, userId || '')
  }

  // Export to CSV
  const exportCsv = () => {
    const headers = ['Document', ...columns.map((c) => c.label)]
    const rows = processedDocuments.map((doc) => {
      const row = [doc.fileName]
      columns.forEach((col) => {
        const cell = getCell(doc.id, col.id)
        row.push(
          cell?.value
            ? `"${cell.value.replace(/"/g, '""')}"`
            : ''
        )
      })
      return row
    })

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pendingCount = cells.filter(
    (c) =>
      (c.status === 'pending' || c.status === 'error') &&
      c.isLocked !== true
  ).length
  const isRunning = runningCells.size > 0
  const activeFilterCount = filters.filter((f) => f.query.trim()).length

  // Check if a row is fully reviewed
  const isRowReviewed = (docId: string) => {
    const docCells = cells.filter(
      (c) => c.documentId === docId && c.status === 'completed'
    )
    return docCells.length > 0 && docCells.every((c) => c.isReviewed === true)
  }

  // Sort indicator for column header
  const getSortIcon = (columnId: string) => {
    if (sortConfig.columnId !== columnId)
      return <ArrowUpDown className="h-3 w-3 text-gray-300" />
    if (sortConfig.direction === 'asc')
      return <ArrowUp className="h-3 w-3 text-[#c5032a]" />
    return <ArrowDown className="h-3 w-3 text-[#c5032a]" />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          {/* Editable title */}
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold border-b-2 border-[#c5032a] outline-none bg-transparent px-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') {
                    setTitle(review.title)
                    setEditingTitle(false)
                  }
                }}
              />
              <button onClick={saveTitle} className="p-1 hover:bg-gray-100 rounded">
                <Check className="h-4 w-4 text-green-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="flex items-center gap-1.5 group"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
              <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Active filters indicator */}
          {activeFilterCount > 0 && (
            <span className="text-xs text-[#c5032a] bg-red-50 px-2 py-0.5 rounded-full">
              {activeFilterCount} {locale === 'el' ? 'φίλτρα' : 'filters'}
              <button
                onClick={() => setFilters([])}
                className="ml-1 hover:text-red-700"
              >
                <X className="h-3 w-3 inline" />
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Add documents */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.rtf,.odt,.xlsx,.xls,.csv,.pptx,.ppt,.html,.htm"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            {locale === 'el' ? 'Προσθήκη εγγράφων' : 'Add documents'}
          </Button>

          {/* Templates */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <LayoutTemplate className="h-4 w-4 mr-1.5" />
              {locale === 'el' ? 'Πρότυπα' : 'Templates'}
            </Button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-500 px-2 py-1">
                    {locale === 'el'
                      ? 'Προσθήκη ομάδας στηλών'
                      : 'Add column preset'}
                  </p>
                  {Object.entries(DD_TEMPLATES).map(([key, tmpl]) => (
                    <button
                      key={key}
                      onClick={() => handleApplyTemplate(key)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <span className="font-medium">
                        {locale === 'el' ? tmpl.labelEl : tmpl.label}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">
                        ({tmpl.columns.length} {locale === 'el' ? 'στήλες' : 'columns'})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add column */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddColumn(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {locale === 'el' ? 'Προσθήκη στήλης' : 'Add column'}
          </Button>

          {/* Run all */}
          <Button
            size="sm"
            onClick={runAll}
            disabled={pendingCount === 0 || isRunning}
            className="bg-[#c5032a] hover:bg-[#a50223]"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Play className="h-4 w-4 mr-1.5" />
            )}
            {isRunning
              ? `${runningCells.size} running...`
              : locale === 'el'
                ? `Εκτέλεση${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                : `Run all${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </Button>

          {/* Download */}
          {documents.length > 0 && columns.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {documents.length === 0 && columns.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-gray-500 mb-4">
              {locale === 'el'
                ? 'Ξεκινήστε ανεβάζοντας έγγραφα και προσθέτοντας στήλες εξαγωγής.'
                : 'Start by uploading documents and adding extraction columns.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {locale === 'el' ? 'Ανέβασμα εγγράφων' : 'Upload documents'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTemplates(true)}
              >
                <LayoutTemplate className="h-4 w-4 mr-1.5" />
                {locale === 'el' ? 'Χρήση Προτύπου' : 'Use Template'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddColumn(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {locale === 'el' ? 'Προσθήκη στήλης' : 'Add column'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet table */}
      {(documents.length > 0 || columns.length > 0) && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse min-w-max">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Row number */}
                <th className="w-10 px-2 py-2 text-xs font-medium text-gray-500 text-center border-r border-gray-200 sticky left-0 bg-gray-50 z-20">
                  #
                </th>
                {/* Review status column */}
                <th className="w-8 px-1 py-2 text-xs font-medium text-gray-500 text-center border-r border-gray-200 sticky left-10 bg-gray-50 z-20">
                  <CheckCircle2 className="h-3.5 w-3.5 mx-auto text-gray-400" />
                </th>
                {/* Document column */}
                <th className="min-w-[200px] max-w-[250px] px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-200 sticky left-[4.5rem] bg-gray-50 z-20">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleSort('__filename__')}
                      className="flex items-center gap-1 hover:text-[#c5032a] transition-colors"
                    >
                      {locale === 'el' ? 'Έγγραφο' : 'Document'}
                      {getSortIcon('__filename__')}
                    </button>
                    <button
                      onClick={() => {
                        setActiveFilterColumn(
                          activeFilterColumn === '__filename__'
                            ? null
                            : '__filename__'
                        )
                        setFilterInput(
                          filters.find((f) => f.columnId === '__filename__')
                            ?.query || ''
                        )
                      }}
                      className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
                        filters.some(
                          (f) => f.columnId === '__filename__' && f.query
                        )
                          ? 'text-[#c5032a]'
                          : 'text-gray-400'
                      }`}
                    >
                      <Filter className="h-3 w-3" />
                    </button>
                  </div>
                  {activeFilterColumn === '__filename__' && (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        value={filterInput}
                        onChange={(e) => setFilterInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            applyFilter('__filename__', filterInput)
                          if (e.key === 'Escape') setActiveFilterColumn(null)
                        }}
                        placeholder={locale === 'el' ? 'Φίλτρο...' : 'Filter...'}
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30"
                        autoFocus
                      />
                      <button
                        onClick={() =>
                          applyFilter('__filename__', filterInput)
                        }
                        className="p-0.5 rounded hover:bg-gray-200"
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </button>
                    </div>
                  )}
                </th>
                {/* Dynamic columns */}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="min-w-[200px] max-w-[350px] px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          onClick={() => toggleSort(col.id)}
                          className="flex items-center gap-1 hover:text-[#c5032a] transition-colors truncate"
                          title={col.prompt}
                        >
                          <span className="truncate">{col.label}</span>
                          {getSortIcon(col.id)}
                        </button>
                        <button
                          onClick={() => {
                            setActiveFilterColumn(
                              activeFilterColumn === col.id ? null : col.id
                            )
                            setFilterInput(
                              filters.find((f) => f.columnId === col.id)
                                ?.query || ''
                            )
                          }}
                          className={`p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0 ${
                            filters.some(
                              (f) => f.columnId === col.id && f.query
                            )
                              ? 'text-[#c5032a]'
                              : 'text-gray-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Filter className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-opacity ml-1"
                        title={
                          locale === 'el'
                            ? 'Διαγραφή στήλης'
                            : 'Delete column'
                        }
                      >
                        <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                    {activeFilterColumn === col.id && (
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          value={filterInput}
                          onChange={(e) => setFilterInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              applyFilter(col.id, filterInput)
                            if (e.key === 'Escape')
                              setActiveFilterColumn(null)
                          }}
                          placeholder={
                            locale === 'el' ? 'Φίλτρο...' : 'Filter...'
                          }
                          className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30"
                          autoFocus
                        />
                        <button
                          onClick={() => applyFilter(col.id, filterInput)}
                          className="p-0.5 rounded hover:bg-gray-200"
                        >
                          <Check className="h-3 w-3 text-green-600" />
                        </button>
                      </div>
                    )}
                  </th>
                ))}
                {/* Add column button in header */}
                <th className="w-10 px-2 py-2 border-r border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setShowAddColumn(true)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    title={
                      locale === 'el' ? 'Προσθήκη στήλης' : 'Add column'
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedDocuments.map((doc, index) => {
                const rowReviewed = isRowReviewed(doc.id)
                return (
                  <tr
                    key={doc.id}
                    className={`border-b border-gray-100 hover:bg-gray-50/50 group/row ${
                      rowReviewed ? 'bg-green-50/30' : ''
                    }`}
                  >
                    {/* Row number */}
                    <td className="px-2 py-2 text-xs text-gray-400 text-center border-r border-gray-200 sticky left-0 bg-white z-10">
                      {index + 1}
                    </td>
                    {/* Row review toggle */}
                    <td className="px-1 py-2 text-center border-r border-gray-200 sticky left-10 bg-white z-10">
                      <button
                        onClick={() => handleToggleRowReview(doc.id)}
                        className="p-0.5 rounded hover:bg-green-50 transition-colors"
                        title={
                          rowReviewed
                            ? locale === 'el'
                              ? 'Αφαίρεση ελέγχου σειράς'
                              : 'Unmark row as reviewed'
                            : locale === 'el'
                              ? 'Σημείωση σειράς ως ελεγμένη'
                              : 'Mark row as reviewed'
                        }
                      >
                        <CheckCircle2
                          className={`h-3.5 w-3.5 ${
                            rowReviewed
                              ? 'text-green-500'
                              : 'text-gray-300 hover:text-green-400'
                          }`}
                        />
                      </button>
                    </td>
                    {/* Document name */}
                    <td className="px-3 py-2 border-r border-gray-200 sticky left-[4.5rem] bg-white z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-sm text-gray-900 truncate flex-1"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </span>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded hover:bg-red-50 transition-opacity shrink-0"
                          title={locale === 'el' ? 'Αφαίρεση' : 'Remove'}
                        >
                          <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </td>
                    {/* Data cells */}
                    {columns.map((col) => {
                      const cell = getCell(doc.id, col.id)
                      return (
                        <td
                          key={`${doc.id}-${col.id}`}
                          className={`px-3 py-2 border-r border-gray-200 align-top ${
                            cell?.isLocked ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <CellContent
                            cell={cell}
                            isRunning={
                              cell ? runningCells.has(cell.id) : false
                            }
                            onRun={() => {
                              if (cell) runCell(cell, doc, col)
                            }}
                            onEdit={(value) => {
                              if (cell && !cell.isLocked) {
                                updateCellValue(cell.id, value, true)
                                setCells((prev) =>
                                  prev.map((c) =>
                                    c.id === cell.id
                                      ? {
                                          ...c,
                                          value,
                                          isManualEdit: true,
                                          status: 'completed',
                                        }
                                      : c
                                  )
                                )
                              }
                            }}
                            onToggleReview={() => {
                              if (cell) handleToggleReview(cell)
                            }}
                            onToggleLock={() => {
                              if (cell) handleToggleLock(cell)
                            }}
                            locale={locale}
                          />
                        </td>
                      )
                    })}
                    {/* Empty add-column cell */}
                    <td className="border-r border-gray-200" />
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* No results after filter */}
          {processedDocuments.length === 0 && documents.length > 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Filter className="h-4 w-4 mr-2" />
              {locale === 'el'
                ? 'Δεν βρέθηκαν αποτελέσματα. Δοκιμάστε διαφορετικό φίλτρο.'
                : 'No results found. Try a different filter.'}
            </div>
          )}
        </div>
      )}

      {/* Add Column Dialog */}
      {showAddColumn && (
        <AddColumnDialog
          onAdd={handleAddColumn}
          onClose={() => setShowAddColumn(false)}
          locale={locale}
          language={review.language || locale}
        />
      )}
    </div>
  )
}
