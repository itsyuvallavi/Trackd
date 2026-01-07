'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Lightbulb, Download, Share2 } from 'lucide-react'
import { SessionSummary as SummaryType } from '@/lib/interview/types'

interface SessionSummaryProps {
  summary: SummaryType
  onRetry?: () => void
  onSave?: () => void
}

export function SessionSummary({ summary, onRetry, onSave }: SessionSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Overall Performance</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {summary.summary}
        </p>
      </div>

      {/* Strengths */}
      {summary.strengths.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="size-5 text-green-500" />
            <h3 className="text-lg font-semibold">Strengths</h3>
          </div>
          <ul className="space-y-2">
            {summary.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-green-500 mt-1">•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas for Improvement */}
      {summary.improvements.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="size-5 text-amber-500" />
            <h3 className="text-lg font-semibold">Areas for Improvement</h3>
          </div>
          <ul className="space-y-2">
            {summary.improvements.map((improvement, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-amber-500 mt-1">•</span>
                <span>{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      {summary.tips.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">Personalized Tips</h3>
          </div>
          <ul className="space-y-2">
            {summary.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-1">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            Practice Again
          </Button>
        )}
        {onSave && (
          <Button onClick={onSave}>
            Save Summary
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          <Download className="size-4 mr-2" />
          Export PDF
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({
                  title: 'Interview Prep Summary',
                  text: summary.summary,
                })
              } catch (error) {
                console.error('Error sharing:', error)
              }
            } else {
              // Fallback: copy to clipboard
              navigator.clipboard.writeText(summary.summary)
              alert('Summary copied to clipboard')
            }
          }}
        >
          <Share2 className="size-4 mr-2" />
          Share
        </Button>
      </div>
    </div>
  )
}




