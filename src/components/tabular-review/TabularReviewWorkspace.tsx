'use client'

import { useState, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  addTabularReviewColumn,
  addTabularReviewDocument,
  deleteTabularReviewColumn,
  deleteTabularReviewDocument,
  updateTabularReviewTitle,
  updateCellValue,
  createPendingCells,
  createPendingCellsForColumn,
} from '@/app/[locale]/actions/tabular_review_actions'
import { AddColumnDialog } from './AddColumnDialog'
import { CellContent } from './CellContent'

interface Review {
  id: string
  title: string
  language: string | null
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
  status: string | null
  error: string | null
  isManualEdit: boolean | null
}

interface Props {
  review: Review
  initialColumns: Column[]
  initialDocuments: Document[]
  initialCells: Cell[]
}

export function TabularReviewWorkspace({
  review,
  initialColumns,
  initialDocuments,
  initialCells,
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [cells, setCells] = useState<Cell[]>(initialCells)
  const [isUploading, setIsUploading] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set())
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(review.title)

  // Get cell for a document × column intersection
  const getCell = useCallback(
    (documentId: string, columnId: string): Cell | undefined => {
      return cells.find(
        (c) => c.documentId === documentId && c.columnId === columnId
      )
    },
    [cells]
  )

  // Upload files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Extract text via the existing translate API
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

        // Save document to DB
        const doc = await addTabularReviewDocument(
          review.id,
          file.name,
          data.text,
          file.type,
          file.size
        )

        // Create pending cells for all existing columns
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

      // Create pending cells for all existing documents
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
            ? { ...c, value: data.value, status: 'completed', error: null }
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
      (c) => c.status === 'pending' || c.status === 'error'
    )

    // Run in batches of 5 to avoid overwhelming the API
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

  // Export to CSV
  const exportCsv = () => {
    const headers = ['Document', ...columns.map((c) => c.label)]
    const rows = documents.map((doc) => {
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
    (c) => c.status === 'pending' || c.status === 'error'
  ).length
  const isRunning = runningCells.size > 0

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
                {/* Document column */}
                <th className="min-w-[200px] max-w-[250px] px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-200 sticky left-10 bg-gray-50 z-20">
                  {locale === 'el' ? 'Έγγραφο' : 'Document'}
                </th>
                {/* Dynamic columns */}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="min-w-[200px] max-w-[350px] px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate" title={col.prompt}>
                        {col.label}
                      </span>
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-opacity ml-1"
                        title={locale === 'el' ? 'Διαγραφή στήλης' : 'Delete column'}
                      >
                        <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  </th>
                ))}
                {/* Add column button in header */}
                <th className="w-10 px-2 py-2 border-r border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setShowAddColumn(true)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    title={locale === 'el' ? 'Προσθήκη στήλης' : 'Add column'}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, index) => (
                <tr
                  key={doc.id}
                  className="border-b border-gray-100 hover:bg-gray-50/50 group/row"
                >
                  {/* Row number */}
                  <td className="px-2 py-2 text-xs text-gray-400 text-center border-r border-gray-200 sticky left-0 bg-white z-10">
                    {index + 1}
                  </td>
                  {/* Document name */}
                  <td className="px-3 py-2 border-r border-gray-200 sticky left-10 bg-white z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-gray-900 truncate flex-1" title={doc.fileName}>
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
                        className="px-3 py-2 border-r border-gray-200 align-top"
                      >
                        <CellContent
                          cell={cell}
                          isRunning={cell ? runningCells.has(cell.id) : false}
                          onRun={() => {
                            if (cell) runCell(cell, doc, col)
                          }}
                          onEdit={(value) => {
                            if (cell) {
                              updateCellValue(cell.id, value, true)
                              setCells((prev) =>
                                prev.map((c) =>
                                  c.id === cell.id
                                    ? { ...c, value, isManualEdit: true, status: 'completed' }
                                    : c
                                )
                              )
                            }
                          }}
                        />
                      </td>
                    )
                  })}
                  {/* Empty add-column cell */}
                  <td className="border-r border-gray-200" />
                </tr>
              ))}
            </tbody>
          </table>
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
