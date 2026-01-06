/**
 * AI Prompts for Interview Prep
 * 
 * Contains all prompts used for generating interview questions,
 * analyzing responses, and creating summaries
 */

import { InterviewType } from '@prisma/client'
import { InterviewMessage, JobContext } from './types'

export function getInterviewSystemPrompt(
  type: InterviewType,
  jobContext?: JobContext
): string {
  const jobContextText = jobContext
    ? `
Job Context:
- Position: ${jobContext.title}
- Company: ${jobContext.company}
${jobContext.location ? `- Location: ${jobContext.location}` : ''}
${jobContext.notes ? `- Notes: ${jobContext.notes}` : ''}
${jobContext.interviewAt ? `- Interview Date: ${jobContext.interviewAt.toLocaleDateString()}` : ''}
`
    : ''

  const typeInstructions =
    type === 'TECHNICAL'
      ? 'Focus on technical questions: coding problems, system design, algorithms, data structures, and technical problem-solving.'
      : type === 'GENERAL'
      ? 'Focus on general interview questions: behavioral questions, problem-solving scenarios, communication skills, and professional experience.'
      : 'Mix technical and general questions. Start with a few general questions to warm up, then move to technical questions, and include behavioral questions throughout.'

  return `You are an experienced, friendly, and professional technical interviewer conducting a mock interview to help a candidate prepare for their upcoming interview.

${jobContextText}

Interview Type: ${type}
${typeInstructions}

Your role:
1. Ask clear, realistic interview questions appropriate for the role and interview type
2. Listen carefully to the candidate's responses
3. Provide constructive, encouraging feedback
4. Adapt your questions based on the candidate's responses - if they struggle with a topic, ask follow-up questions or provide hints
5. Keep the conversation natural and conversational, not robotic
6. After each response, provide brief, constructive feedback before moving to the next question
7. For technical questions, you can provide hints if the candidate is stuck
8. For behavioral questions, help them structure their answers using clear examples

Tone: Professional but friendly, encouraging, and supportive. This is a practice session, so help the candidate improve.

After asking a question, wait for the candidate's response. Then provide brief feedback before asking the next question.`
}

export function getQuestionGenerationPrompt(
  conversationHistory: InterviewMessage[],
  type: InterviewType,
  questionCount: number
): string {
  const recentMessages = conversationHistory
    .slice(-10)
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n')

  const questionType =
    type === 'TECHNICAL'
      ? 'technical'
      : type === 'GENERAL'
      ? 'general/behavioral'
      : questionCount < 3
      ? 'general/behavioral (warm-up)'
      : questionCount < 6
      ? 'technical'
      : 'general/behavioral'

  return `Generate the next interview question for this mock interview session.

Conversation so far:
${recentMessages || 'No previous conversation'}

Question number: ${questionCount + 1}
Question type: ${questionType}

Generate a single, clear interview question that:
1. Is appropriate for the interview type (${type})
2. Hasn't been asked yet in this conversation
3. Builds on previous responses if relevant
4. Is realistic and similar to what would be asked in a real interview
5. Is clear and specific

Return your response as JSON:
{
  "question": "The interview question to ask",
  "type": "${questionType}",
  "hints": ["optional hint 1", "optional hint 2"] // Only if technical question
}`
}

export function getResponseAnalysisPrompt(
  question: string,
  response: string,
  questionType: string
): string {
  return `Analyze the candidate's response to this interview question.

Question: ${question}
Question Type: ${questionType}
Candidate's Response: ${response}

Provide constructive feedback on:
1. Content quality (did they answer the question? is it relevant?)
2. Clarity and communication (was it clear and well-structured?)
3. Technical accuracy (if technical question)
4. Areas for improvement
5. What they did well

Return your response as JSON:
{
  "feedback": "Brief, constructive feedback (2-3 sentences)",
  "score": 0-10, // Overall score out of 10
  "strengths": ["what they did well"],
  "suggestions": ["specific suggestions for improvement"],
  "followUp": "optional follow-up question or clarification if needed"
}`
}

export function getSummaryPrompt(messages: InterviewMessage[]): string {
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n')

  return `Analyze this complete interview session and provide a comprehensive summary.

Interview Conversation:
${conversation}

Provide a detailed analysis including:

1. Overall Performance Summary (2-3 paragraphs)
   - Overall impression
   - Key strengths demonstrated
   - Main areas needing improvement
   - Readiness assessment

2. Strengths (3-5 specific strengths)
   - What the candidate did well
   - Strong points in their responses

3. Areas for Improvement (3-5 specific areas)
   - What needs work
   - Specific weaknesses or gaps

4. Personalized Tips (5-7 actionable tips)
   - Specific advice for improvement
   - Practice recommendations
   - Preparation suggestions

Return your response as JSON:
{
  "summary": "Overall performance summary (2-3 paragraphs)",
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["area 1", "area 2", ...],
  "tips": ["tip 1", "tip 2", ...]
}`
}

