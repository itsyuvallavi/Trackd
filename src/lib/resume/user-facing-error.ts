/**
 * Maps thrown errors from OpenAI / resume pipeline to safe client-facing messages.
 */
export function getResumeInitUserMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()

  if (
    lower.includes('openai_api_key') ||
    (lower.includes('api key') && lower.includes('not set'))
  ) {
    return 'Resume analysis is unavailable: OpenAI is not configured on the server (OPENAI_API_KEY).'
  }
  if (lower.includes('401') || lower.includes('incorrect api key') || lower.includes('invalid api key')) {
    return 'Could not reach the AI service: check that OPENAI_API_KEY is valid.'
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'The AI service is busy. Please wait a minute and try again.'
  }
  if (lower.includes('file processing failed') || lower.includes('file processing timed out')) {
    return 'Could not read your file on the AI service. Try a smaller PDF or a .txt export.'
  }
  if (lower.includes('assistant') && lower.includes('not found')) {
    return 'Resume session expired or was reset. Upload your resume again.'
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Analysis took too long. Try again; if it keeps failing, use a smaller file.'
  }
  if (lower.includes('file url format not recognized')) {
    return 'Your file could not be loaded for analysis. Upload your resume again.'
  }

  return 'Could not analyze your resume right now. Please try again in a moment.'
}
