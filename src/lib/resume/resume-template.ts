/**
 * ATS-Friendly Resume HTML Template
 * 
 * Single-column layout, optimized for ATS parsing
 * Follows 2025+ resume best practices
 */

export interface ResumeData {
  name: string
  title?: string
  email: string
  phone: string
  location: string
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

export function generateResumeHTML(data: ResumeData): string {
  // Validate required fields
  if (!data.name || !data.email || !data.phone || !data.location) {
    throw new Error('Missing required fields: name, email, phone, or location')
  }
  if (!data.experience || data.experience.length === 0) {
    throw new Error('Missing required field: experience')
  }
  if (!data.education || data.education.length === 0) {
    throw new Error('Missing required field: education')
  }
  if (!data.skills || data.skills.length === 0) {
    throw new Error('Missing required field: skills')
  }

  // Contact Information
  const contactInfo = [
    data.email,
    data.phone,
    data.location,
    data.linkedin ? `LinkedIn: ${data.linkedin}` : '',
    data.portfolio ? `Portfolio: ${data.portfolio}` : ''
  ].filter(Boolean).join(' | ')

  // Experience
  const experienceHTML = data.experience.map(exp => `
    <div class="experience-item">
      <div class="job-header">
        <strong>${exp.title}</strong> | <span class="company">${exp.company}</span>
        <span class="job-meta">${exp.dates} | ${exp.location}</span>
      </div>
      <ul class="bullets">
        ${exp.bullets.map(b => `<li>${b}</li>`).join('\n        ')}
      </ul>
    </div>
  `).join('\n')

  // Education
  const educationHTML = data.education.map(edu => {
    const parts = [
      `<strong>${edu.degree}</strong>`,
      edu.school,
      edu.location ? edu.location : '',
      edu.dates,
      edu.gpa ? `GPA: ${edu.gpa}` : '',
      edu.honors ? `Honors: ${edu.honors}` : ''
    ].filter(Boolean)
    return `<div class="education-item">${parts.join(' | ')}</div>`
  }).join('\n')

  // Skills - inline with bullet points, single line, single space between
  const skillsHTML = `<p class="skills-inline">${data.skills.map(s => `• ${s}`).join(' ')}</p>`
  
  // Certifications
  const certificationsHTML = data.certifications?.length 
    ? `
      <div class="section">
        <h2>Certifications</h2>
        ${data.certifications.map(cert => {
          const parts = [
            `<strong>${cert.name}</strong>`,
            cert.organization,
            cert.date ? cert.date : ''
          ].filter(Boolean)
          return `<div class="cert-item">${parts.join(' | ')}</div>`
        }).join('\n        ')}
      </div>
    ` 
    : ''

  // Projects
  const projectsHTML = data.projects?.length
    ? `
      <div class="section">
        <h2>Projects</h2>
        ${data.projects.map(proj => `
          <div class="project-item">
            <div class="project-header">
              <strong>${proj.name}</strong>
              ${proj.role ? ` | ${proj.role}` : ''}
              ${proj.context ? ` (${proj.context})` : ''}
              ${proj.link ? ` | <a href="${proj.link}">${proj.link}</a>` : ''}
            </div>
            ${proj.technologies?.length ? `<div class="tech-stack">Technologies: ${proj.technologies.join(', ')}</div>` : ''}
            <ul class="bullets">
              ${proj.bullets.map(b => `<li>${b}</li>`).join('\n              ')}
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
  <title>${data.name} - Resume</title>
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
      color: #000;
      background: white;
    }
    
    .container {
      max-width: 100%;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 8pt;
      border-bottom: 2px solid #000;
      padding-bottom: 4pt;
    }
    
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 2pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .header .title {
      font-size: 11pt;
      font-weight: normal;
      margin-bottom: 4pt;
      font-style: italic;
    }
    
    .header .contact {
      font-size: 9pt;
      line-height: 1.4;
    }
    
    /* Sections */
    .section {
      margin-bottom: 8pt;
    }
    
    .section h2 {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4pt;
      border-bottom: 1px solid #000;
      padding-bottom: 1pt;
    }
    
    /* Experience */
    .experience-item {
      margin-bottom: 7pt;
    }
    
    .job-header {
      margin-bottom: 3pt;
      line-height: 1.4;
    }
    
    .job-header strong {
      font-size: 10pt;
    }
    
    .job-header .company {
      font-weight: normal;
    }
    
    .job-header .job-meta {
      float: right;
      font-size: 9pt;
      font-weight: normal;
      color: #333;
    }
    
    .bullets {
      margin-left: 18pt;
      margin-top: 2pt;
      font-size: 9pt;
    }
    
    .bullets li {
      margin-bottom: 2pt;
      line-height: 1.3;
    }
    
    /* Education */
    .education-item {
      margin-bottom: 4pt;
      font-size: 9pt;
      line-height: 1.4;
    }
    
    /* Skills - single line, inline bullets, single space between */
    .skills-inline {
      font-size: 9pt;
      line-height: 1.6;
      margin: 0;
    }
    
    /* Summary */
    .summary {
      font-size: 9pt;
      line-height: 1.4;
      margin-bottom: 7pt;
      text-align: justify;
    }
    
    /* Certifications */
    .cert-item {
      margin-bottom: 3pt;
      font-size: 9pt;
      line-height: 1.4;
    }
    
    /* Projects */
    .project-item {
      margin-bottom: 6pt;
    }
    
    .project-header {
      margin-bottom: 2pt;
      font-size: 9pt;
      line-height: 1.4;
    }
    
    .tech-stack {
      font-size: 8pt;
      font-style: italic;
      margin-bottom: 2pt;
      color: #555;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .container {
        min-height: auto;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header with Contact -->
    <div class="header">
      <h1>${data.name}</h1>
      ${data.title ? `<div class="title">${data.title}</div>` : ''}
      <div class="contact">${contactInfo}</div>
    </div>

    <!-- Professional Summary -->
    ${data.summary ? `
      <div class="section">
        <h2>Professional Summary</h2>
        <div class="summary">${data.summary}</div>
      </div>
    ` : ''}

    <!-- Key Skills -->
    <div class="section">
      <h2>Key Skills</h2>
      ${skillsHTML}
    </div>

    <!-- Work Experience -->
    <div class="section">
      <h2>Work Experience</h2>
      ${experienceHTML}
    </div>

    <!-- Education -->
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
 * Parse improved resume text into structured data
 * Uses AI to extract structured data from the improved resume text
 */
export function getResumeParsingPrompt(resumeText: string): string {
  return `Extract the ACTUAL information from this resume and return it as JSON.

RESUME CONTENT TO PARSE:
---
${resumeText}
---

Extract the REAL data from above. DO NOT use placeholder text like "Full Name" or "email@example.com".
Find and extract the actual person's name, their real email, phone, job titles, companies, etc.

Return JSON in this format:
{
  "name": "[Extract the actual person's name from the resume]",
  "title": "[Their current/most recent job title or professional title]",
  "email": "[Their actual email address]",
  "phone": "[Their actual phone number]",
  "location": "[Their actual city, state]",
  "linkedin": "[LinkedIn URL if mentioned, or null]",
  "portfolio": "[Portfolio/GitHub URL if mentioned, or null]",
  "summary": "[Professional summary if present - 2-4 sentences or 3-5 bullets, or null]",
  "experience": [
    {
      "title": "[Actual job title]",
      "company": "[Actual company name]",
      "dates": "[Actual dates - Month Year - Month Year or Present]",
      "location": "[Actual location - City, State]",
      "bullets": ["[Actual achievement 1]", "[Actual achievement 2]", "[Actual achievement 3-7 for recent roles]"]
    }
  ],
  "education": [
    {
      "degree": "[Actual degree - e.g., B.S. in Computer Science]",
      "school": "[Actual school name]",
      "dates": "[Actual dates or graduation date]",
      "location": "[Location if available]",
      "gpa": "[GPA if mentioned and strong, or null]",
      "honors": "[Honors if mentioned, or null]"
    }
  ],
  "skills": ["[Review and optimize skills - see SKILLS OPTIMIZATION rules below]"],
  "certifications": [
    {
      "name": "[Certification name]",
      "organization": "[Issuing organization]",
      "date": "[Date if mentioned, or null]"
    }
  ],
  "projects": [
    {
      "name": "[Project name]",
      "role": "[Role if mentioned, or null]",
      "context": "[personal/academic/open-source/client, or null]",
      "technologies": ["[Tech 1]", "[Tech 2]"],
      "bullets": ["[Achievement 1]", "[Achievement 2-4]"],
      "link": "[URL if mentioned, or null]"
    }
  ]
}

#1 RULE - NEVER EXCEED 1 PAGE (MOST IMPORTANT):
- The resume MUST fit on exactly 1 page - this is the absolute priority
- If content is too long after extraction, note which sections can be shortened (summary, older jobs, less impressive projects)

CRITICAL RULES - EXTRACT ALL DATA:
- Extract REAL information, not placeholder text
- Include ALL work experience positions in reverse chronological order
- Extract ALL bullet points for each job initially (will be shortened if needed for 1 page)
- Each bullet should be concise (1 line max, ~70-90 characters if possible)
- Bullets should follow: "Action verb + what + how + metric" format
- Include ALL education entries (keep concise)
- Include ALL certifications if any (keep brief)
- Include ALL projects - order by impressiveness (most impressive first, least impressive last)
- Extract ALL bullets for each project initially (will be shortened if needed for 1 page)
- Summary should be 3-5 sentences minimum (50-80 words) - it's very important and should be comprehensive

PROJECT PRIORITIZATION (MANDATORY):
- Order projects by impressiveness/advancement - most impressive at the top, least at the bottom
- Consider: Full-stack applications > static websites, AI/ML features > basic features, Complex integrations > simple sites, Modern tech stack > older tech
- Most impressive project = first in list, least impressive = last

SKILLS OPTIMIZATION (MANDATORY - Must be done):
You MUST review and optimize the skills list. This is not optional.

1. REMOVE duplicates and merge related:
   - "Git" + "GitHub" → "Git/GitHub"
   - "React" + "Vite" + "Next.js" → "React (Vite, Next.js)"
   - "Version Control" is redundant if "Git/GitHub" exists → remove it
   - "React - Vite" + "React" → "React (Vite)"
   - "Tailwind CSS" + "Tailwind" → "Tailwind CSS"

2. REMOVE skills not related to the target role:
   - For web dev roles: Remove audio/studio tools (Pro Tools, RX, VSTs, etc.)
   - Remove generic terms like "Deployment workflows" if specific tools are listed
   - Keep only skills relevant to the primary role

3. ADD missing skills from projects/jobs:
   - Scan ALL projects for technologies mentioned
   - Scan ALL jobs for relevant technologies
   - If "Firebase" is used in projects but not in skills → ADD it
   - If "EmailJS" is used in projects but not in skills → ADD it
   - If "Netlify" is used in projects but not in skills → ADD it

4. GROUP related skills intelligently:
   - Multiple React tools → "React (Vite, Next.js)"
   - Multiple CSS tools → "CSS (Tailwind, shadcn/ui)"
   - Version control tools → "Git/GitHub"

5. PRIORITIZE: Hard skills first (languages, frameworks, tools), remove soft/generic skills

6. TARGET: 12-16 skills total that are most relevant to the role

MANDATORY EXAMPLES:
- Original: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "React - Vite", "Next.js", "Git", "GitHub", "Version Control", "Deployment workflows"]
- Optimized: ["HTML", "CSS", "JavaScript", "TypeScript", "React (Vite, Next.js)", "Tailwind CSS", "shadcn/ui", "Git/GitHub", "Firebase", "Netlify"]

- Original: ["p5.js", "three.js", "GSAP", "Claude Code"]
- If role is web dev: Keep all (they're relevant)
- If role is not creative/visual: Consider removing or grouping

DO NOT just copy the original skills list. You MUST optimize it.

Return ONLY the JSON object, no explanation or markdown`
}
