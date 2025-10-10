import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const pdfUrl = url.searchParams.get('pdfUrl')

  if (!pdfUrl) {
    return new NextResponse('PDF URL is required', { status: 400 })
  }

  try {
    // Validate that it's a Google Storage URL or other allowed domain
    const allowedDomains = [
      'https://storage.googleapis.com/',
      // Add other allowed domains if needed
    ]

    const isAllowedDomain = allowedDomains.some((domain) =>
      pdfUrl.startsWith(domain)
    )
    if (!isAllowedDomain && !pdfUrl.startsWith('http')) {
      return new NextResponse('Invalid PDF URL', { status: 400 })
    }

    const pdfResponse = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/pdf',
      },
      timeout: 30000, // 30 second timeout
    })

    const buffer = Buffer.from(pdfResponse.data)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error fetching PDF:', error)
    return new NextResponse('Failed to fetch PDF', { status: 500 })
  }
}
