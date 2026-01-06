import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getAIClient } from '@/lib/ai/client'
import { generateResumeHTML, getResumeParsingPrompt, ResumeData } from '@/lib/resume/resume-template'
import puppeteer from 'puppeteer'

/**
 * GET /api/resume/chat/sessions/[id]/preview
 * Preview resume PDF in browser (inline view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Verify session belongs to user
    const session = await prisma.resumeSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Need improved resume text to generate PDF
    if (!session.improvedResumeText) {
      return NextResponse.json(
        { error: 'No improved resume available. Please generate one first.' },
        { status: 400 }
      )
    }

    // Use cached parsed data if available (much faster!)
    let resumeData: ResumeData
    if (session.parsedResumeData && typeof session.parsedResumeData === 'object') {
      console.log('[Preview] Using cached parsed resume data')
      resumeData = session.parsedResumeData as unknown as ResumeData
    } else {
      console.log('[Preview] Parsing resume text (this may take 20-30 seconds)...')
      
      // Parse the improved resume text into structured data using AI
      const client = getAIClient()
      const parsePrompt = getResumeParsingPrompt(session.improvedResumeText)
      
      const response = await client.chatCompletion([
        { role: 'system', content: 'You extract real data from resumes and return JSON. Never use placeholder text.' },
        { role: 'user', content: parsePrompt }
      ], {
        temperature: 0.1,
      })

      const jsonContent = response.data.choices[0]?.message?.content || '{}'
      
      // Clean up JSON if wrapped in markdown code blocks
      let cleanJson = jsonContent
        .replace(/^```json\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()
      
      try {
        resumeData = JSON.parse(cleanJson)
        console.log('[Preview] Parsed successfully')
        
        // Cache the parsed data for future requests
        try {
          await prisma.resumeSession.update({
            where: { id: sessionId },
            data: { parsedResumeData: resumeData as any },
          })
          console.log('[Preview] Cached parsed data for future use')
        } catch (cacheError) {
          // Log but don't fail - caching is optional
          console.error('[Preview] Error caching data (non-fatal):', cacheError)
        }
      } catch (parseError) {
        console.error('Failed to parse resume JSON:', cleanJson)
        return NextResponse.json(
          { error: 'Failed to parse resume data' },
          { status: 500 }
        )
      }
    }

    // Generate HTML from template
    let htmlResume: string
    try {
      console.log('[Preview] Generating HTML from template...')
      htmlResume = generateResumeHTML(resumeData)
      console.log('[Preview] HTML generated, length:', htmlResume.length)
    } catch (htmlError) {
      console.error('[Preview] Error generating HTML:', htmlError)
      return NextResponse.json(
        { error: 'Failed to generate HTML resume', details: htmlError instanceof Error ? htmlError.message : String(htmlError) },
        { status: 500 }
      )
    }

    // Convert HTML to PDF (optimized launch for speed)
    let browser
    try {
      console.log('[Preview] Launching Puppeteer...')
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      console.log('[Preview] Puppeteer launched successfully')
    } catch (browserError) {
      console.error('[Preview] Error launching Puppeteer:', browserError)
      return NextResponse.json(
        { error: 'Failed to launch PDF generator', details: browserError instanceof Error ? browserError.message : String(browserError) },
        { status: 500 }
      )
    }
    
    try {
      console.log('[Preview] Creating new page...')
      const page = await browser.newPage()
      console.log('[Preview] Setting page content...')
      await page.setContent(htmlResume, { waitUntil: 'networkidle0' })
      console.log('[Preview] Generating PDF...')
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })
      console.log('[Preview] PDF generated successfully, size:', pdf.length)

      // Return PDF for inline viewing (opens in browser)
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="resume.pdf"',
        },
      })
    } catch (pdfError) {
      console.error('[Preview] Error generating PDF:', pdfError)
      return NextResponse.json(
        { error: 'Failed to generate PDF', details: pdfError instanceof Error ? pdfError.message : String(pdfError) },
        { status: 500 }
      )
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  } catch (error) {
    console.error('[Preview] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[Preview] Error stack:', errorStack)
    return NextResponse.json(
      { error: 'Failed to preview resume', details: errorMessage },
      { status: 500 }
    )
  }
}

