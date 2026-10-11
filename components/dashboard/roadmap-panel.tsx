'use client'

import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Recommendation } from '@/lib/voc/types'
import { useAnalysis } from './analysis-provider'

const horizons = [
  { key: 'now' as const, label: 'Now', detail: 'High impact, high confidence' },
  { key: 'next' as const, label: 'Next', detail: 'Validate scope' },
  { key: 'later' as const, label: 'Later', detail: 'Monitor signal' },
]

export function RoadmapPanel() {
  const { state } = useAnalysis()

  const recommendations: Recommendation[] =
    state.status === 'success' ? state.result.recommendations : []

  const byHorizon = (horizon: Recommendation['horizon']) =>
    recommendations.filter((r) => r.horizon === horizon)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Roadmap recommendations</CardTitle>
        <CardDescription className="text-xs">
          {recommendations.length > 0
            ? `${recommendations.length} action${recommendations.length === 1 ? '' : 's'} derived from ranked pain points`
            : 'Actions derived from ranked pain points, with supporting review counts'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 py-4">
        {horizons.map((horizon) => {
          const items = byHorizon(horizon.key)
          return (
            <section
              key={horizon.label}
              aria-label={`${horizon.label} recommendations`}
              className="flex min-h-40 flex-col rounded-md border border-dashed bg-surface/60"
            >
              <header className="flex flex-col gap-0.5 border-b border-dashed px-3 py-2">
                <span className="text-xs font-semibold text-foreground">{horizon.label}</span>
                <span className="text-[11px] text-muted-foreground">{horizon.detail}</span>
              </header>
              {items.length > 0 ? (
                <ul className="flex flex-1 flex-col gap-2 px-3 py-2">
                  {items.map((rec) => (
                    <li key={rec.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{rec.title}</span>
                        {rec.status === 'needs_validation' && (
                          <Badge variant="outline" className="shrink-0 font-normal text-[10px] text-warning-foreground">
                            <AlertCircle className="size-2.5" aria-hidden="true" />
                            Needs validation
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-medium">Problem:</span> {rec.problem}
                      </span>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-medium">Action:</span> {rec.action}
                      </span>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">
                        {rec.rationale}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        {rec.supportingReviewIds.length} supporting review{rec.supportingReviewIds.length === 1 ? '' : 's'}
                      </span>
                      <span className="text-[10px] leading-relaxed text-muted-foreground/70">
                        <span className="font-medium">Success metric:</span> {rec.successMetric}
                      </span>
                      <span className="text-[10px] leading-relaxed text-muted-foreground/60">
                        {rec.priorityRationale}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex flex-1 items-center justify-center px-3 text-center text-[11px] text-muted-foreground/80">
                  No recommendations
                </p>
              )}
            </section>
          )
        })}
      </CardContent>
    </Card>
  )
}
