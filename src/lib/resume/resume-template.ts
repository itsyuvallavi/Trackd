/**
 * ATS-Friendly Resume HTML Template
 * 
 * Generates a clean, single-column PDF resume from structured data.
 * Optimized for ATS parsing and professional appearance.
 */

export interface ResumeData {
  name: string
  title?: string
  email: string
  phone?: string
  location?: string
  linkedin?: string
  portfolio?: string
  summary?: string
  experience: Array<{
    title: string
    company: string
    dates: string
    location: string
    bullets: string[]
  }>
  education: Array<{
    degree: string
    school: string
    dates: string
    location?: string
    gpa?: string
    honors?: string
  }>
  skills: string[]
  certifications?: Array<{
    name: string
    organization: string
    date?: string
  }>
  projects?: Array<{
    name: string
    role?: string
    context?: string
    technologies?: string[]
    bullets: string[]
    link?: string
  }>
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Extract display-friendly domain from URL
 */
function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return url
  }
}

/**
 * Generate HTML resume from structured data
 */
export function generateResumeHTML(data: ResumeData): string {
  // Validate required fields
  if (!data.name) {
    throw new Error('Missing required field: name. Please regenerate the resume.')
  }
  if (!data.email) {
    throw new Error('Missing required field: email. Please regenerate the resume.')
  }
  if (!data.experience || data.experience.length === 0) {
    throw new Error('Missing required field: experience. Please regenerate the resume.')
  }
  if (!data.education || data.education.length === 0) {
    throw new Error('Missing required field: education. Please regenerate the resume.')
  }
  if (!data.skills || data.skills.length === 0) {
    throw new Error('Missing required field: skills. Please regenerate the resume.')
  }

  // Build contact line with cleaner link display
  const contactParts = [escapeHtml(data.email)]
  if (data.phone) contactParts.push(escapeHtml(data.phone))
  if (data.location) contactParts.push(escapeHtml(data.location))
  if (data.linkedin) {
    contactParts.push(`<a href="${escapeHtml(data.linkedin)}">LinkedIn</a>`)
  }
  if (data.portfolio) {
    contactParts.push(`<a href="${escapeHtml(data.portfolio)}">Portfolio</a>`)
  }
  const contactInfo = contactParts.join(' | ')

  // Generate experience HTML
  const experienceHTML = data.experience.map(exp => `
    <div class="experience-item">
      <div class="job-header">
        <strong>${escapeHtml(exp.title)}</strong> | <span class="company">${escapeHtml(exp.company)}</span>
        <span class="job-meta">${escapeHtml(exp.dates)}${exp.location ? ` | ${escapeHtml(exp.location)}` : ''}</span>
      </div>
      <ul class="bullets">
        ${exp.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('\n        ')}
      </ul>
    </div>
  `).join('\n')

  // Generate education HTML
  const educationHTML = data.education.map(edu => {
    const parts = [`<strong>${escapeHtml(edu.degree)}</strong>`, escapeHtml(edu.school)]
    if (edu.location) parts.push(escapeHtml(edu.location))
    parts.push(escapeHtml(edu.dates))
    if (edu.gpa) parts.push(`GPA: ${escapeHtml(edu.gpa)}`)
    if (edu.honors) parts.push(escapeHtml(edu.honors))
    return `<div class="education-item">${parts.join(' | ')}</div>`
  }).join('\n')

  // Generate skills HTML (inline format)
  const skillsHTML = `<p class="skills-inline">${data.skills.map(s => `• ${escapeHtml(s)}`).join(' ')}</p>`

  // Generate certifications HTML
  const certificationsHTML = data.certifications?.length
    ? `
      <div class="section">
        <h2>Certifications</h2>
        ${data.certifications.map(cert => {
          const parts = [`<strong>${escapeHtml(cert.name)}</strong>`, escapeHtml(cert.organization)]
          if (cert.date) parts.push(escapeHtml(cert.date))
          return `<div class="cert-item">${parts.join(' | ')}</div>`
        }).join('\n        ')}
      </div>
    `
    : ''

  // Generate projects HTML with cleaner link display
  const projectsHTML = data.projects?.length
    ? `
      <div class="section">
        <h2>Projects</h2>
        ${data.projects.map(proj => `
          <div class="project-item">
            <div class="project-header">
              <strong>${escapeHtml(proj.name)}</strong>
              ${proj.role ? ` | ${escapeHtml(proj.role)}` : ''}
              ${proj.link ? ` | <a href="${escapeHtml(proj.link)}">${getDisplayUrl(proj.link)}</a>` : ''}
            </div>
            ${proj.technologies?.length ? `<div class="tech-stack">Technologies: ${proj.technologies.map(t => escapeHtml(t)).join(', ')}</div>` : ''}
            <ul class="bullets">
              ${proj.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('\n              ')}
            </ul>
          </div>
        `).join('\n        ')}
      </div>
    `
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.name)} - Resume</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 0.5in;
    }
    
    body {
      font-family: 'Calibri', 'Arial', 'Helvetica', sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #1a1a1a;
      background: white;
    }
    
    .container {
      max-width: 100%;
    }
    
    /* Header with subtle accent */
    .header {
      text-align: center;
      margin-bottom: 10pt;
      border-bottom: 2px solid #2c5282;
      padding-bottom: 6pt;
    }
    
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 2pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a365d;
    }
    
    .header .title {
      font-size: 11pt;
      font-weight: normal;
      margin-bottom: 4pt;
      color: #4a5568;
    }
    
    .header .contact {
      font-size: 9pt;
      line-height: 1.5;
      color: #2d3748;
    }
    
    /* Links */
    a {
      color: #2b6cb0;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    /* Sections */
    .section {
      margin-bottom: 10pt;
    }
    
    .section h2 {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 5pt;
      border-bottom: 1.5px solid #2c5282;
      padding-bottom: 2pt;
      color: #1a365d;
      letter-spacing: 0.5px;
    }
    
    /* Experience */
    .experience-item {
      margin-bottom: 8pt;
    }
    
    .job-header {
      margin-bottom: 3pt;
      line-height: 1.4;
    }
    
    .job-header strong {
      font-size: 10pt;
      color: #1a202c;
    }
    
    .job-header .company {
      font-weight: normal;
      color: #4a5568;
    }
    
    .job-header .job-meta {
      float: right;
      font-size: 9pt;
      font-weight: normal;
      color: #718096;
    }
    
    .bullets {
      margin-left: 18pt;
      margin-top: 3pt;
      font-size: 9pt;
    }
    
    .bullets li {
      margin-bottom: 2pt;
      line-height: 1.35;
      color: #2d3748;
    }
    
    /* Education */
    .education-item {
      margin-bottom: 4pt;
      font-size: 9pt;
      line-height: 1.4;
      color: #2d3748;
    }
    
    /* Skills */
    .skills-inline {
      font-size: 9pt;
      line-height: 1.6;
      margin: 0;
      color: #2d3748;
    }
    
    /* Summary */
    .summary {
      font-size: 9pt;
      line-height: 1.45;
      margin-bottom: 8pt;
      text-align: justify;
      color: #2d3748;
    }
    
    /* Certifications */
    .cert-item {
      margin-bottom: 3pt;
      font-size: 9pt;
      line-height: 1.4;
      color: #2d3748;
    }
    
    /* Projects */
    .project-item {
      margin-bottom: 7pt;
    }
    
    .project-header {
      margin-bottom: 2pt;
      font-size: 9pt;
      line-height: 1.4;
    }
    
    .project-header strong {
      color: #1a202c;
    }
    
    .tech-stack {
      font-size: 8pt;
      font-style: italic;
      margin-bottom: 2pt;
      color: #718096;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.name)}</h1>
      ${data.title ? `<div class="title">${escapeHtml(data.title)}</div>` : ''}
      <div class="contact">${contactInfo}</div>
    </div>

    ${data.summary ? `
      <div class="section">
        <h2>Professional Summary</h2>
        <div class="summary">${escapeHtml(data.summary)}</div>
      </div>
    ` : ''}

    <div class="section">
      <h2>Key Skills</h2>
      ${skillsHTML}
    </div>

    <div class="section">
      <h2>Work Experience</h2>
      ${experienceHTML}
    </div>

    <div class="section">
      <h2>Education</h2>
      ${educationHTML}
    </div>

    ${certificationsHTML}
    ${projectsHTML}
  </div>
</body>
</html>`
}

/**
 * Generate the prompt for parsing resume text into structured JSON
 * 
 * This prompt extracts ACTUAL data from the resume - no fabrication allowed.
 */
export function getResumeParsingPrompt(resumeText: string): string {
  return `Parse this resume and extract the data into structured JSON.

RESUME TEXT:
---
${resumeText}
---

INSTRUCTIONS:
- Extract ONLY the actual information from the resume above
- DO NOT use placeholder text or example data
- DO NOT add information that isn't in the resume
- If a field is not found in the resume, use null
- The name is usually at the very top of the resume

RETURN THIS JSON STRUCTURE:
{
  "name": "The actual person's name from the resume (REQUIRED)",
  "title": "Their job title or professional title, or null",
  "email": "Their actual email address (REQUIRED)",
  "phone": "Their phone number, or null if not found",
  "location": "Their city/state/location, or null if not found",
  "linkedin": "LinkedIn URL if present, or null",
  "portfolio": "Portfolio/GitHub URL if present, or null",
  "summary": "Professional summary if present, or null",
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "dates": "Employment dates",
      "location": "Job location",
      "bullets": ["Achievement 1", "Achievement 2", "..."]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "school": "School name",
      "dates": "Dates attended",
      "location": "School location or null",
      "gpa": "GPA if mentioned, or null",
      "honors": "Honors if mentioned, or null"
    }
  ],
  "skills": ["Skill 1", "Skill 2", "..."],
  "certifications": [
    {
      "name": "Certification name",
      "organization": "Issuing organization",
      "date": "Date if mentioned, or null"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "role": "Role if mentioned, or null",
      "context": "Context (personal/academic/work) if mentioned, or null",
      "technologies": ["Tech 1", "Tech 2"],
      "bullets": ["Description 1", "Description 2"],
      "link": "URL if mentioned, or null"
    }
  ]
}

RULES:
- Extract ALL work experience entries in order
- Extract ALL education entries
- Extract ALL skills listed
- Extract ALL projects if present
- Extract ALL certifications if present
- Keep original wording - do not modify or enhance
- Return ONLY valid JSON, no explanations`
}

/**
 * Parse resume text to JSON using AI
 * This is exported so it can be called during generation to pre-cache the data
 */
export async function parseResumeText(
  resumeText: string,
  aiClient: { chatCompletion: Function }
): Promise<ResumeData> {
  const parsePrompt = getResumeParsingPrompt(resumeText)
  
  const response = await aiClient.chatCompletion([
    { 
      role: 'system', 
      content: 'You are an expert at extracting structured data from resumes. Extract the actual data - never use placeholders. Always return valid JSON.' 
    },
    { role: 'user', content: parsePrompt }
  ], {
    temperature: 0.1,
  })

  const jsonContent = response.data.choices[0]?.message?.content || '{}'
  
  // Clean up JSON if wrapped in markdown code blocks
  const cleanJson = jsonContent
    .replace(/^```json\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
  
  return JSON.parse(cleanJson)
}
