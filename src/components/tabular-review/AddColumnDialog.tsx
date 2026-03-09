'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onAdd: (label: string, prompt: string, format: string) => void
  onClose: () => void
  locale: string
  language: string
}

const FORMAT_OPTIONS = [
  { value: 'text', label: 'Text', labelEl: 'Κείμενο' },
  { value: 'boolean', label: 'Yes / No', labelEl: 'Ναι / Όχι' },
  { value: 'date', label: 'Date', labelEl: 'Ημερομηνία' },
  { value: 'number', label: 'Number', labelEl: 'Αριθμός' },
  { value: 'list', label: 'List', labelEl: 'Λίστα' },
]

export function AddColumnDialog({ onAdd, onClose, locale, language }: Props) {
  const [label, setLabel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [format, setFormat] = useState('text')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGeneratePrompt = async () => {
    if (!label.trim()) return
    setIsGenerating(true)
    try {
      // Generate a prompt based on the label using a simple heuristic
      const lang = language === 'el' ? 'Greek' : 'English'
      const generated = generatePromptFromLabel(label, lang)
      setPrompt(generated)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = () => {
    if (!label.trim() || !prompt.trim()) return
    onAdd(label.trim(), prompt.trim(), format)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            {locale === 'el' ? 'Προσθήκη Στήλης' : 'Add Column'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Label
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                locale === 'el'
                  ? 'π.χ. Βασικοί Όροι, Εγγυήσεις, Αλλαγή Ελέγχου'
                  : 'e.g. Key Terms, Warranties, Change of Control'
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c5032a]/20 focus:border-[#c5032a]"
              autoFocus
            />
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c5032a]/20 focus:border-[#c5032a]"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === 'el' ? opt.labelEl : opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">
                Prompt
              </label>
              <button
                onClick={handleGeneratePrompt}
                disabled={!label.trim() || isGenerating}
                className="flex items-center gap-1 text-xs text-[#c5032a] hover:text-[#a50223] disabled:text-gray-400 transition-colors"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI Generate
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={
                locale === 'el'
                  ? 'Περιγράψτε τι πληροφορίες να εξαχθούν από κάθε έγγραφο...'
                  : 'Describe what information to extract from each document...'
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c5032a]/20 focus:border-[#c5032a] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <Button variant="outline" size="sm" onClick={onClose}>
            {locale === 'el' ? 'Ακύρωση' : 'Cancel'}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!label.trim() || !prompt.trim()}
            className="bg-[#c5032a] hover:bg-[#a50223]"
          >
            {locale === 'el' ? 'Προσθήκη' : 'Add Column'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function generatePromptFromLabel(label: string, language: string): string {
  const lower = label.toLowerCase()
  const langNote =
    language === 'Greek'
      ? ' Respond in Greek.'
      : ' Respond in English.'

  // Common legal column types with smart prompts
  if (lower.includes('key term') || lower.includes('βασικ')) {
    return `Identify and summarize the key terms of the agreement, including parties, subject matter, duration, financial terms, and governing law.${langNote}`
  }
  if (lower.includes('warrant') || lower.includes('εγγυήσ')) {
    return `List all representations and warranties provided in the document, including which party provides them and any qualifications or limitations.${langNote}`
  }
  if (lower.includes('change of control') || lower.includes('αλλαγή ελέγχου')) {
    return `Identify whether the document contains a change of control clause. If yes, describe the trigger events, consequences, and any consent requirements.${langNote}`
  }
  if (lower.includes('condition') || lower.includes('προϋπόθεσ') || lower.includes('cp')) {
    return `List all conditions precedent or conditions to closing specified in the document, categorized by responsible party.${langNote}`
  }
  if (lower.includes('terminat') || lower.includes('λήξη') || lower.includes('καταγγελ')) {
    return `Describe the termination provisions, including grounds for termination, notice requirements, and consequences.${langNote}`
  }
  if (lower.includes('indemni') || lower.includes('αποζημ')) {
    return `Identify all indemnification provisions, including indemnifying parties, covered losses, caps, baskets, and time limitations.${langNote}`
  }
  if (lower.includes('party') || lower.includes('parties') || lower.includes('μέρ')) {
    return `List all parties to the agreement, including their full legal names, roles, and jurisdictions.${langNote}`
  }
  if (lower.includes('date') || lower.includes('ημερομηνί')) {
    return `Extract all significant dates mentioned in the document, including execution date, effective date, expiry date, and any milestone dates.${langNote}`
  }
  if (lower.includes('amount') || lower.includes('ποσό') || lower.includes('price') || lower.includes('τιμή')) {
    return `Extract all monetary amounts, prices, or financial figures mentioned in the document, with context for each.${langNote}`
  }
  if (lower.includes('govern') || lower.includes('εφαρμοστέο')) {
    return `Identify the governing law and dispute resolution mechanism (courts or arbitration) specified in the document.${langNote}`
  }
  if (lower.includes('person') || lower.includes('πρόσωπ')) {
    return `List the names of all persons mentioned in the document. This includes any individuals referenced in the context of the content, such as authors, recipients, or other relevant parties involved in the discussions or transactions detailed within the document.${langNote}`
  }
  if (lower.includes('type') || lower.includes('τύπος') || lower.includes('κατηγορ')) {
    return `Classify the document type (e.g., loan agreement, lease, employment contract, SPA, NDA, etc.) based on its content.${langNote}`
  }
  if (lower.includes('structure') || lower.includes('δομή')) {
    return `Describe the structure of the arrangement documented, including the key financial and operational terms.${langNote}`
  }
  if (lower.includes('restrict') || lower.includes('covenant') || lower.includes('περιορισμ')) {
    return `List all restrictive covenants, including non-compete, non-solicitation, and negative pledge provisions with their scope and duration.${langNote}`
  }

  // Default: use the label as-is
  return `Extract information about "${label}" from the document. Provide a concise but complete summary.${langNote}`
}
