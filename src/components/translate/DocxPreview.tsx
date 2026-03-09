'use client'

import { useEffect, useRef } from 'react'

interface DocxPreviewProps {
  /** Base64-encoded DOCX file content */
  docxBase64: string
  /** Optional CSS class for the container */
  className?: string
}

/**
 * Renders a DOCX file in the browser using docx-preview.
 * Shows the document with tables, styles, formatting preserved.
 */
export default function DocxPreview({ docxBase64, className }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !docxBase64) return

    let cancelled = false

    async function render() {
      try {
        // Dynamic import to avoid SSR issues
        const docxPreview = await import('docx-preview')

        // Convert base64 to Blob
        const binaryString = atob(docxBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })

        if (cancelled || !containerRef.current) return

        await docxPreview.renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
        })
      } catch (err) {
        console.error('DOCX preview render error:', err)
        if (containerRef.current && !cancelled) {
          containerRef.current.innerHTML =
            '<p class="text-sm text-gray-500 p-4">Unable to preview document</p>'
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [docxBase64])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'auto',
        background: '#f9fafb',
      }}
    />
  )
}
