import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getResumeAIClient } from '@/lib/ai/client'
import { generateResumeHTML, getResumeParsingPrompt, ResumeData } from '@/lib/resume/resume-template'
import puppeteer from 'puppeteer'

/**
 * GET /api/resume/chat/sessions/[id]/preview
 * Preview resume PDF in browser (inline view)
 * 
 * Performance optimizations:
 * - Uses pre-parsed data from generation time (no AI call needed)
 * - Optimized Puppeteer launch args
 * - Faster page rendering with domcontentloaded
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Get user profile for fallback data
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    })

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

    // Validate that improved resume text is actually resume content
    const improvedResumeText = session.improvedResumeText.trim()
    if (improvedResumeText.length < 300) {
      return NextResponse.json(
        { error: 'The resume content appears invalid. Please regenerate it.' },
        { status: 400 }
      )
    }

    console.log(`[Preview] Starting preview generation (${Date.now() - startTime}ms)`)

    // Use cached parsed data if available (FAST PATH - no AI call needed!)
    let resumeData: ResumeData
    if (session.parsedResumeData && typeof session.parsedResumeData === 'object') {
      console.log(`[Preview] Using cached parsed data (${Date.now() - startTime}ms)`)
      resumeData = session.parsedResumeData as unknown as ResumeData
      
      // Apply fallbacks for cached data
      if (!resumeData.name && profile?.name) {
        resumeData.name = profile.name
      }
      if (!resumeData.email && profile?.email) {
        resumeData.email = profile.email
      }
    } else {
      // SLOW PATH - parse on demand (fallback if pre-parsing failed)
      console.log(`[Preview] No cached data, parsing now (${Date.now() - startTime}ms)...`)
      
      const client = getResumeAIClient()
      const parsePrompt = getResumeParsingPrompt(session.improvedResumeText)
      
      const response = await client.chatCompletion([
        { 
          role: 'system', 
          content: 'Extract structured data from resumes. Return valid JSON only.' 
        },
        { role: 'user', content: parsePrompt }
      ], {
        temperature: 0.1,
      })

      const jsonContent = response.data.choices[0]?.message?.content || '{}'
      const cleanJson = jsonContent
        .replace(/^```json\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()
      
      try {
        resumeData = JSON.parse(cleanJson)
        
        // Apply fallbacks
        if (!resumeData.name && profile?.name) {
          resumeData.name = profile.name
        }
        if (!resumeData.email && profile?.email) {
          resumeData.email = profile.email
        }
        
        // Validate required fields
        if (!resumeData.name || !resumeData.email) {
          return NextResponse.json(
            { error: 'Failed to extract required fields from resume' },
            { status: 500 }
          )
        }
        
        // Cache for future requests
        await prisma.resumeSession.update({
          where: { id: sessionId },
          data: { parsedResumeData: resumeData as any },
        }).catch(() => {}) // Non-fatal
        
        console.log(`[Preview] Parsed and cached (${Date.now() - startTime}ms)`)
      } catch {
        return NextResponse.json(
          { error: 'Failed to parse resume data' },
          { status: 500 }
        )
      }
    }

    // Generate HTML from template
    let htmlResume: string
    try {
      htmlResume = generateResumeHTML(resumeData)
      console.log(`[Preview] HTML generated (${Date.now() - startTime}ms)`)
    } catch (htmlError) {
      console.error('[Preview] Error generating HTML:', htmlError)
      return NextResponse.json(
        { error: 'Failed to generate HTML resume', details: htmlError instanceof Error ? htmlError.message : String(htmlError) },
        { status: 500 }
      )
    }

    // Convert HTML to PDF with optimized Puppeteer settings
    let browser
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--single-process', // Faster for simple pages
        ],
      })
      console.log(`[Preview] Puppeteer launched (${Date.now() - startTime}ms)`)
    } catch (browserError) {
      console.error('[Preview] Error launching Puppeteer:', browserError)
      return NextResponse.json(
        { error: 'Failed to launch PDF generator' },
        { status: 500 }
      )
    }
    
    try {
      const page = await browser.newPage()
      
      // Use domcontentloaded instead of networkidle0 (much faster for static HTML)
      await page.setContent(htmlResume, { waitUntil: 'domcontentloaded' })
      console.log(`[Preview] Page content set (${Date.now() - startTime}ms)`)
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })
      console.log(`[Preview] PDF generated, size: ${pdf.length} bytes (${Date.now() - startTime}ms total)`)

      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="resume.pdf"',
          'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        },
      })
    } catch (pdfError) {
      console.error('[Preview] Error generating PDF:', pdfError)
      return NextResponse.json(
        { error: 'Failed to generate PDF' },
        { status: 500 }
      )
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  } catch (error) {
    console.error('[Preview] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to preview resume' },
      { status: 500 }
    )
  }
}
