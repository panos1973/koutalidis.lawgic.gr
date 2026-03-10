'use client'

import { useState } from 'react'
import {
  Play,
  Loader2,
  AlertCircle,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  CheckCircle2,
  Quote,
} from 'lucide-react'

interface Cell {
  id: string
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
  cell: Cell | undefined
  isRunning: boolean
  onRun: () => void
  onEdit: (value: string) => void
  onToggleReview: () => void
  onToggleLock: () => void
  locale: string
}

export function CellContent({
  cell,
  isRunning,
  onRun,
  onEdit,
  onToggleReview,
  onToggleLock,
  locale,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showSources, setShowSources] = useState(false)

  if (!cell) {
    return <span className="text-xs text-gray-300">-</span>
  }

  const isLocked = cell.isLocked === true
  const isReviewed = cell.isReviewed === true

  // Running state
  if (isRunning || cell.status === 'running') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c5032a]" />
        <span>{locale === 'el' ? 'Εξαγωγή...' : 'Extracting...'}</span>
      </div>
    )
  }

  // Editing state
  if (isEditing && !isLocked) {
    return (
      <div className="space-y-1">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          rows={3}
          className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 resize-none"
          autoFocus
        />
        <div className="flex gap-1">
          <button
            onClick={() => {
              onEdit(editValue)
              setIsEditing(false)
            }}
            className="p-0.5 rounded hover:bg-green-50"
          >
            <Check className="h-3.5 w-3.5 text-green-600" />
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="p-0.5 rounded hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (cell.status === 'error') {
    return (
      <div className="flex items-start gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-xs text-red-500 line-clamp-2">
            {cell.error || 'Error'}
          </span>
          <button
            onClick={onRun}
            className="flex items-center gap-1 text-xs text-[#c5032a] hover:underline mt-0.5"
          >
            <Play className="h-3 w-3" />
            {locale === 'el' ? 'Επανάληψη' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  // Parse sources
  let parsedSources: string[] = []
  if (cell.sources) {
    try {
      parsedSources = JSON.parse(cell.sources)
    } catch {
      // ignore parse errors
    }
  }

  // Completed state with value
  if (cell.status === 'completed' && cell.value) {
    return (
      <div className="group/cell relative">
        {/* Status indicators */}
        <div className="flex items-center gap-1 mb-1">
          {isReviewed && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {locale === 'el' ? 'Ελεγμένο' : 'Reviewed'}
            </span>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              <Lock className="h-2.5 w-2.5" />
              {locale === 'el' ? 'Κλειδωμένο' : 'Locked'}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-6">
          {cell.value}
        </p>

        {/* Sources / Citations */}
        {(parsedSources.length > 0 || cell.reasoning) && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Quote className="h-2.5 w-2.5" />
              {showSources
                ? locale === 'el'
                  ? 'Απόκρυψη πηγών'
                  : 'Hide sources'
                : locale === 'el'
                  ? `Πηγές (${parsedSources.length})`
                  : `Sources (${parsedSources.length})`}
              {showSources ? (
                <ChevronUp className="h-2.5 w-2.5" />
              ) : (
                <ChevronDown className="h-2.5 w-2.5" />
              )}
            </button>

            {showSources && (
              <div className="mt-1.5 space-y-1.5">
                {/* Reasoning */}
                {cell.reasoning && (
                  <div className="bg-blue-50/60 rounded px-2 py-1.5 border border-blue-100">
                    <p className="text-[10px] font-medium text-blue-700 mb-0.5">
                      {locale === 'el' ? 'Αιτιολογία' : 'Reasoning'}
                    </p>
                    <p className="text-[10px] text-blue-600 leading-relaxed">
                      {cell.reasoning}
                    </p>
                  </div>
                )}
                {/* Source quotes */}
                {parsedSources.map((source, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 rounded px-2 py-1.5 border-l-2 border-gray-300"
                  >
                    <p className="text-[10px] text-gray-600 leading-relaxed italic">
                      &ldquo;{source}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons (hover) */}
        <div className="absolute top-0 right-0 opacity-0 group-hover/cell:opacity-100 flex items-center gap-0.5 bg-white shadow-sm border border-gray-200 rounded px-0.5 py-0.5 transition-opacity">
          {!isLocked && (
            <button
              onClick={() => {
                setEditValue(cell.value || '')
                setIsEditing(true)
              }}
              className="p-0.5 rounded hover:bg-gray-100"
              title={locale === 'el' ? 'Επεξεργασία' : 'Edit'}
            >
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
          )}
          <button
            onClick={onToggleReview}
            className="p-0.5 rounded hover:bg-green-50"
            title={
              isReviewed
                ? locale === 'el'
                  ? 'Αφαίρεση ελέγχου'
                  : 'Unmark reviewed'
                : locale === 'el'
                  ? 'Σημείωση ως ελεγμένο'
                  : 'Mark as reviewed'
            }
          >
            <CheckCircle2
              className={`h-3 w-3 ${isReviewed ? 'text-green-500' : 'text-gray-400'}`}
            />
          </button>
          <button
            onClick={onToggleLock}
            className="p-0.5 rounded hover:bg-amber-50"
            title={
              isLocked
                ? locale === 'el'
                  ? 'Ξεκλείδωμα'
                  : 'Unlock'
                : locale === 'el'
                  ? 'Κλείδωμα'
                  : 'Lock'
            }
          >
            {isLocked ? (
              <Lock className="h-3 w-3 text-amber-500" />
            ) : (
              <Unlock className="h-3 w-3 text-gray-400" />
            )}
          </button>
        </div>
      </div>
    )
  }

  // Pending state
  return (
    <button
      onClick={onRun}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#c5032a] transition-colors"
      title={locale === 'el' ? 'Εκτέλεση εξαγωγής' : 'Run extraction'}
    >
      <Play className="h-3.5 w-3.5" />
      <span>{locale === 'el' ? 'Εκτέλεση' : 'Run'}</span>
    </button>
  )
}
