// Updated export_all_messages.ts - much simpler client-side code
import { Message } from 'ai/react'
import { toast } from 'sonner'
import { saveAs } from 'file-saver'

export const exportAllMessages = async (
  messages: Message[],
  locale: string
) => {
  // Early validation
  if (!messages || messages.length === 0) {
    toast.error('No messages to export')
    return
  }

  const filteredMessages = messages.filter((m) => m.content.trim() !== '')

  if (filteredMessages.length === 0) {
    toast.error('No valid messages to export')
    return
  }

  // Show initial progress
  const progressToastId = toast.loading('Προετοιμασία εξαγωγής...', {
    duration: Infinity,
  })

  try {
    // Quick size check before sending to server
    const totalContentLength = filteredMessages.reduce(
      (sum, m) => sum + m.content.length,
      0
    )

    if (totalContentLength > 5000000) {
      // 5MB limit
      toast.dismiss(progressToastId)
      toast.error(
        'Content too large to export. Please try with fewer messages.'
      )
      return
    }

    console.log(
      `Exporting ${filteredMessages.length} messages, total size: ${totalContentLength} chars`
    )

    // Update progress
    toast.loading('Προετοιμασία εξαγωγής...', { id: progressToastId })

    // Call the API
    const response = await fetch(`/${locale}/api/export_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: filteredMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        locale,
      }),
    })

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    // Update progress
    toast.loading('Generating document...', { id: progressToastId })

    // Get the blob from response
    const blob = await response.blob()

    if (blob.size === 0) {
      throw new Error('Received empty document')
    }

    console.log(`Received document blob: ${blob.size} bytes`)

    // Generate filename with timestamp
    const timestamp = new Date()
      .toLocaleString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(/[/:\s]/g, '_')

    // Download the file
    saveAs(blob, `lawgic_chat_export_${timestamp}.docx`)

    // Success
    toast.dismiss(progressToastId)
    toast.success(
      locale === 'el' ? 'Η συνομιλία λήφθηκε' : 'Chat exported successfully'
    )
  } catch (error) {
    console.error('Error exporting messages:', error)
    toast.dismiss(progressToastId)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    toast.error(
      locale === 'el'
        ? `Σφάλμα κατά την εξαγωγή: ${errorMessage}`
        : `Export failed: ${errorMessage}`
    )
  }
}

// Alternative version with progress polling (if you want real-time updates)
export const exportAllMessagesWithProgress = async (
  messages: Message[],
  locale: string
) => {
  if (!messages || messages.length === 0) {
    toast.error('No messages to export')
    return
  }

  const filteredMessages = messages.filter((m) => m.content.trim() !== '')

  if (filteredMessages.length === 0) {
    toast.error('No valid messages to export')
    return
  }

  const progressToastId = toast.loading('Starting export...', {
    duration: Infinity,
  })

  try {
    // Start the export process
    const response = await fetch(`/${locale}/api/export_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: filteredMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        locale,
      }),
    })

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    // If response has streaming or progress info, you can update toast here
    const contentLength = response.headers.get('Content-Length')
    if (contentLength) {
      toast.loading(
        `Processing ${Math.round(
          parseInt(contentLength) / 1024
        )}KB document...`,
        { id: progressToastId }
      )
    }

    const blob = await response.blob()

    if (blob.size === 0) {
      throw new Error('Received empty document')
    }

    const timestamp = new Date()
      .toLocaleString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(/[/:\s]/g, '_')

    saveAs(blob, `lawgic_chat_export_${timestamp}.docx`)

    toast.dismiss(progressToastId)
    toast.success(
      locale === 'el'
        ? 'Η συνομιλία λήφθηκε επιτυχώς!'
        : 'Chat exported successfully!'
    )
  } catch (error) {
    console.error('Error exporting messages:', error)
    toast.dismiss(progressToastId)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    toast.error(
      locale === 'el'
        ? `Σφάλμα κατά την εξαγωγή: ${errorMessage}`
        : `Export failed: ${errorMessage}`
    )
  }
}
