import React, { useEffect, useRef } from 'react'
import ReactDOMServer from 'react-dom/server'
import { DocumentText1, CloseCircle } from 'iconsax-react'

interface TemplateInputRendererProps {
  input: string
  selectedTemplate: string | null
  locale: string
  defaultTemplates: any[]
  onTemplateRemove: () => void
  placeholder: string
  onChange: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  disabled: boolean
  isDragActive: boolean
}

const TemplateInputRenderer: React.FC<TemplateInputRendererProps> = ({
  input,
  selectedTemplate,
  locale,
  defaultTemplates,
  onTemplateRemove,
  placeholder,
  onChange,
  onKeyDown,
  disabled,
  isDragActive,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdatingRef = useRef(false)

  const getTemplateName = (key: string) => {
    const template = defaultTemplates.find((t) => t.key === key)
    if (!template) return key
    return locale === 'el'
      ? template.title_greek || template.title
      : template.title
  }

  const updateEditorContent = () => {
    const editor = editorRef.current
    if (!editor) return

    // Store current cursor position
    const selection = window.getSelection()
    let cursorOffset = 0
    let wasEditorFocused = document.activeElement === editor

    if (selection && selection.rangeCount > 0 && wasEditorFocused) {
      const range = selection.getRangeAt(0)
      cursorOffset = range.startOffset
    }

    // Clear existing content
    editor.innerHTML = ''

    if (selectedTemplate && input) {
      const templateName = getTemplateName(selectedTemplate)
      const textParts = input.split(templateName)

      textParts.forEach((part, index) => {
        if (part) {
          editor.appendChild(document.createTextNode(part))
        }
        if (index < textParts.length - 1) {
          const tag = document.createElement('span')
          tag.className =
            'inline-flex items-center bg-blue-100 border border-blue-300 rounded-lg px-2 py-1 text-xs font-medium text-blue-800 mx-1'
          tag.contentEditable = 'false'

          const textNode = document.createTextNode(templateName)

          const closeButton = document.createElement('button')
          closeButton.type = 'button'
          closeButton.className =
            'ml-1 hover:bg-blue-200/80 rounded-full p-0.5 cursor-pointer transition-colors duration-200'
          closeButton.onclick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            onTemplateRemove()
          }

          const docIconString = ReactDOMServer.renderToString(
            <DocumentText1
              variant="Bold"
              size="14"
              color="#1e40af"
              style={{ marginRight: '4px' }}
            />
          )
          const closeIconString = ReactDOMServer.renderToString(
            <CloseCircle
              size="14"
              variant="Bulk"
              color="#1e40af"
            />
          )

          const docIcon = new DOMParser().parseFromString(
            docIconString,
            'image/svg+xml'
          ).documentElement
          const closeIcon = new DOMParser().parseFromString(
            closeIconString,
            'image/svg+xml'
          ).documentElement

          tag.appendChild(docIcon)
          tag.appendChild(textNode)
          closeButton.appendChild(closeIcon)
          tag.appendChild(closeButton)

          editor.appendChild(tag)
        }
      })
    } else if (input) {
      // Just add the plain text if no template
      editor.appendChild(document.createTextNode(input))
    }

    // Restore cursor position only if editor was focused and we have content
    if (wasEditorFocused && input && cursorOffset > 0) {
      try {
        const range = document.createRange()
        const sel = window.getSelection()

        // Find the text node to place cursor in
        let textNode = editor.firstChild
        while (textNode && textNode.nodeType !== Node.TEXT_NODE) {
          textNode = textNode.nextSibling
        }

        if (textNode) {
          const maxOffset = Math.min(
            cursorOffset,
            textNode.textContent?.length || 0
          )
          range.setStart(textNode, maxOffset)
          range.setEnd(textNode, maxOffset)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      } catch (e) {
        // If cursor positioning fails, just place at end
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(editor)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }

  // Force update when input or selectedTemplate changes
  useEffect(() => {
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false
      return
    }
    updateEditorContent()
  }, [input, selectedTemplate, locale, defaultTemplates])

  // Additional effect to handle input clearing (when input becomes empty)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    // Force clear when input is empty and editor has content
    if (!input && editor.innerText.trim()) {
      editor.innerHTML = ''
    }
  }, [input])

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText

    // Prevent infinite loops
    isUpdatingRef.current = true

    const syntheticEvent = {
      target: { value: text },
    } as React.ChangeEvent<HTMLTextAreaElement>
    onChange(syntheticEvent)
  }

  return (
    <div
      ref={editorRef}
      className="w-full min-h-[60px] bg-transparent focus:outline-none text-sm md:pt-4 pb-4 resize-none cursor-text relative z-10"
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={onKeyDown}
      data-placeholder={isDragActive ? 'Drop files here...' : placeholder}
    />
  )
}

export default TemplateInputRenderer
