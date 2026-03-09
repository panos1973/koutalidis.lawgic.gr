'use client'

import { useState } from 'react'
import { Play, Loader2, AlertCircle, Pencil, Check, X } from 'lucide-react'

interface Cell {
  id: string
  value: string | null
  status: string | null
  error: string | null
  isManualEdit: boolean | null
}

interface Props {
  cell: Cell | undefined
  isRunning: boolean
  onRun: () => void
  onEdit: (value: string) => void
}

export function CellContent({ cell, isRunning, onRun, onEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  if (!cell) {
    return <span className="text-xs text-gray-300">-</span>
  }

  // Running state
  if (isRunning || cell.status === 'running') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c5032a]" />
        <span>Extracting...</span>
      </div>
    )
  }

  // Editing state
  if (isEditing) {
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
          <span className="text-xs text-red-500 line-clamp-2">{cell.error || 'Error'}</span>
          <button
            onClick={onRun}
            className="flex items-center gap-1 text-xs text-[#c5032a] hover:underline mt-0.5"
          >
            <Play className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Completed state with value
  if (cell.status === 'completed' && cell.value) {
    return (
      <div className="group/cell relative">
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-6">
          {cell.value}
        </p>
        <button
          onClick={() => {
            setEditValue(cell.value || '')
            setIsEditing(true)
          }}
          className="absolute top-0 right-0 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded bg-white shadow-sm border border-gray-200 transition-opacity"
        >
          <Pencil className="h-3 w-3 text-gray-400" />
        </button>
      </div>
    )
  }

  // Pending state
  return (
    <button
      onClick={onRun}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#c5032a] transition-colors"
      title="Run extraction"
    >
      <Play className="h-3.5 w-3.5" />
      <span>Run</span>
    </button>
  )
}
