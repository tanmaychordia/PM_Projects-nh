'use client'

import { AlertCircle, BrainCircuit, Info, Inbox, Loader2, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Confidence } from '@/lib/voc/types'
import { useAnalysis } from './analysis-provider'
import { AnalysisPipeline } from './analysis-pipeline'
import { useReviewCollection } from './review-collection-provider'

const painPointColumns = [
  { label: 'Rank', className: 'w-14' },
  { label: 'Theme / pain point', className: '' },
  { label: 'Reviews', className: 'w-24 text-right' },
  { label: 'Share of negative', className: 'w-36 text-right' },
  { label: 'Confidence', className: 'w-28' },
  { label: 'Evidence', className: 'w-28 text-right' },
]

const confidenceStyles: Record<Confidence, string> = {
  high: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning-foreground',
  low: 'bg-muted text-muted-foreground',
}

export function AnalysisWorkspace() {
  const { state: collectionState } = useReviewCollection()
  const { state: analysisState, selectedPainPointId, runAnalysis, selectPainPoint } = useAnalysis()

  const reviews = collectionState.status === 'success' ? collectionState.result.reviews : []
  const hasReviews = reviews.length > 0
  const canRun = hasReviews && analysisState.status !== 'loading'

  const pipelineStatuses = useMemo(() => {
    if (analysisState.status === 'idle') return undefined
    if (analysisState.status === 'loading') return ['done', 'active', 'pending', 'pending'] as const
    if (analysisState.status === 'error') return ['done', 'done', 'pending', 'pending'] as const
    return ['done', 'done', 'done', 'done'] as const
  }, [analysisState.status])

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Analysis workspace</CardTitle>
        <CardDescription className="text-xs">
          Ranked pain points, each linked to the source reviews that support it
        </CardDescription>
        <CardAction>
          {analysisState.status === 'success' ? (
            <Badge variant="outline" className="font-normal text-primary">
              <Sparkles className="size-3" aria-hidden="true" />
              {analysisState.result.meta.themesFound} themes
            </Badge>
          ) : analysisState.status === 'loading' ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Analyzing…
            </Badge>
          ) : analysisState.status === 'error' ? (
            <Badge variant="destructive" className="font-normal">
              <AlertCircle className="size-3" aria-hidden="true" />
              Failed
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              No analysis run
            </Badge>
          )}
        </CardAction>
      </CardHeader>

      <AnalysisPipeline stepStatuses={pipelineStatuses} />

      {analysisState.status === 'success' && (
        <div className="flex items-start gap-2 border-b bg-surface/60 px-4 py-2.5">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{analysisState.result.methodLabel}</span>
            {' — '}
            {analysisState.result.methodDescription}
            {analysisState.result.limitations.length > 0 && (
              <>
                {' '}
                <span className="text-muted-foreground/80">
                  Limitations: {analysisState.result.limitations.join(' ')}
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <CardContent className="px-0">
        {/* Idle / no reviews */}
        {analysisState.status === 'idle' && (
          <>
            {hasReviews ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-full border bg-surface">
                  <BrainCircuit className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex max-w-md flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">Ready to analyze</p>
                  <p className="text-xs leading-relaxed text-pretty text-muted-foreground whitespace-normal">
                    {reviews.length} reviews are available. Run the rule-based analysis to identify
                    pain points, group them into themes, and generate a ranked summary with
                    evidence quotes.
                  </p>
                </div>
                <Button onClick={() => runAnalysis(reviews)} size="lg">
                  <BrainCircuit aria-hidden="true" />
                  Run analysis
                </Button>
              </div>
            ) : (
              <EmptyState />
            )}
          </>
        )}

        {/* Loading */}
        {analysisState.status === 'loading' && (
          <div className="flex flex-col gap-3 px-4 py-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Matching keywords, verifying quotes, and ranking themes…
            </div>
          </div>
        )}

        {/* Error */}
        {analysisState.status === 'error' && (
          <div className="px-4 py-6">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="text-xs font-semibold">Analysis failed</AlertTitle>
              <AlertDescription className="text-xs">
                {analysisState.message}
                <span className="mt-1 block font-mono text-[11px] text-destructive/80">
                  {analysisState.code}
                </span>
              </AlertDescription>
            </Alert>
            {hasReviews && (
              <Button
                onClick={() => runAnalysis(reviews)}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Try again
              </Button>
            )}
          </div>
        )}

        {/* Success with results */}
        {analysisState.status === 'success' && analysisState.result.painPoints.length > 0 && (
          <>
            <Table>
              <caption className="sr-only">Ranked pain points</caption>
              <TableHeader>
                <TableRow className="bg-surface hover:bg-surface">
                  {painPointColumns.map((col) => (
                    <TableHead
                      key={col.label}
                      className={`h-9 px-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${col.className}`}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisState.result.painPoints.map((pp) => (
                  <TableRow
                    key={pp.id}
                    onClick={() => selectPainPoint(selectedPainPointId === pp.id ? null : pp.id)}
                    className={cn(
                      'cursor-pointer',
                      selectedPainPointId === pp.id && 'bg-primary/5',
                    )}
                    aria-selected={selectedPainPointId === pp.id}
                  >
                    <TableCell className="px-4 py-3 text-sm font-mono tabular-nums text-muted-foreground">
                      {pp.rank}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{pp.theme}</span>
                        <span className="text-[11px] leading-relaxed text-muted-foreground">
                          {pp.summary}
                        </span>
                        {pp.scoreBreakdown && (
                          <span className="text-[10px] font-mono text-muted-foreground/70">
                            Score {pp.score}/100 · freq {pp.scoreBreakdown.frequencyPoints} · neg {pp.scoreBreakdown.negativityPoints} · recency {pp.scoreBreakdown.recencyPoints} · evidence {pp.scoreBreakdown.evidencePoints}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                      {pp.reviewCount}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {(pp.shareOfNegative * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-4xl px-2 py-0.5 text-[11px] font-medium',
                          confidenceStyles[pp.confidence],
                        )}
                      >
                        {pp.confidence}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {pp.evidence.length} quotes
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <span className="text-[11px] text-muted-foreground">
                Click a row to inspect evidence in the Evidence panel.
              </span>
              <Button onClick={() => runAnalysis(reviews)} variant="ghost" size="sm">
                Re-run
              </Button>
            </div>
          </>
        )}

        {/* Success but no themes found */}
        {analysisState.status === 'success' && analysisState.result.painPoints.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex size-10 items-center justify-center rounded-full border bg-surface">
              <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="flex max-w-md flex-col gap-1">
              <p className="text-sm font-medium text-foreground">No themes met the evidence threshold</p>
              <p className="text-xs leading-relaxed text-pretty text-muted-foreground whitespace-normal">
                {analysisState.result.limitations.find((l) => l.includes('No themes')) ??
                  'Not enough reviews matched the keyword catalog with sufficient evidence. Try collecting more reviews.'}
              </p>
            </div>
            {hasReviews && (
              <Button onClick={() => runAnalysis(reviews)} variant="outline" size="sm">
                Re-run
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full border bg-surface">
        <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-sm font-medium text-foreground">No pain points yet</p>
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground whitespace-normal">
          Ranked pain points and recommendations will appear here after reviews are collected and
          analyzed. Every finding will cite review IDs and verbatim quotes so it can be checked
          against the source.
        </p>
      </div>
    </div>
  )
}
