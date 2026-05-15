export function countDedupedBotQueueJobs(jobs: Array<{ company: string; title: string }>): number {
  const seen = new Set<string>()

  for (const job of jobs) {
    seen.add(`${job.company.toLowerCase().trim()}::${job.title.toLowerCase().trim()}`)
  }

  return seen.size
}
