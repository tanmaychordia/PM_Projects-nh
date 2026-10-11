'use client'

import { CheckCircle2, HelpCircle, Quote, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAnalysis } from './analysis-provider'
import { useReviewCollection } from './review-collection-provider'

export function EvidencePanel() {
  const { state, selectedPainPointId } = useAnalysis()
  const { state: collectionState } = useReviewCollection()

  const reviews = collectionState.status === 'success' ? collectionState.result.reviews : []
  const reviewRatingMap = new Map(reviews.map((r) => [r.reviewId, r.rating]))

  const painPoint =
    state.status === 'success'
      ? state.result.painPoints.find((pp) => pp.id === selectedPainPointId)
      : null

  const fields = ['Review ID', 'Verbatim quote', 'Rating', 'Integrity', 'Relevance']

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Evidence</CardTitle>
        <CardDescription className="text-xs">
          {painPoint
            ? `${painPoint.theme} — ${painPoint.evidence.length} quote${painPoint.evidence.length === 1 ? '' : 's'}`
            : 'Verbatim quotes, each traceable to a Google Play review ID'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col px-0">
        {painPoint && painPoint.evidence.length > 0 ? (
          <>
            <div className="grid grid-cols-[7rem_1fr_3rem_4rem_4.5rem] gap-3 border-b bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {fields.map((field) => (
                <span key={field}>{field}</span>
              ))}
            </div>
            <ul className="max-h-[400px] divide-y overflow-y-auto">
              {painPoint.evidence.map((eq) => {
                const rating = reviewRatingMap.get(eq.reviewId)
                return (
                  <li
                    key={`${eq.reviewId}-${eq.quote.slice(0, 20)}`}
                    className="grid grid-cols-[7rem_1fr_3rem_4rem_4.5rem] gap-3 px-4 py-3 text-xs"
                  >
                    <span className="truncate font-mono text-[11px] text-muted-foreground" title={eq.reviewId}>
                      {eq.reviewId}
                    </span>
                    <blockquote className="whitespace-pre-line leading-relaxed text-foreground">
                      {eq.quote}
                    </blockquote>
                    <span className="font-mono text-muted-foreground">
                      {rating ?? '—'}
                      {rating ? '★' : ''}
                    </span>
                    {eq.verified ? (
                      <span className="inline-flex items-center gap-1 text-success" title="Quote is an exact substring of the review text">
                        <ShieldCheck className="size-3" aria-hidden="true" />
                        <span className="text-[11px]">Yes</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground" title="Quote does not pass exact-string verification">
                        <span className="text-[11px]">No</span>
                      </span>
                    )}
                    {eq.relevant ? (
                      <span className="inline-flex items-center gap-1 text-success" title={eq.verificationNote}>
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        <span className="text-[11px]">Yes</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warning-foreground" title={eq.verificationNote}>
                        <HelpCircle className="size-3" aria-hidden="true" />
                        <span className="text-[11px]">Review</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="border-t px-4 py-2.5">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                <span className="font-medium">Integrity</span> = quote is an exact substring of the review.
                <span className="font-medium"> Relevance</span> = quote contextually supports this category.
                A quote can be textually valid but not relevant — those are marked "Review" and should be checked manually.
              </p>
            </div>
            {painPoint.scoreBreakdown && (
              <div className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium">Scoring rationale:</span> {painPoint.scoreBreakdown.rationale}
              </div>
            )}
            {painPoint.confidenceBasis && (
              <div className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium">Confidence basis:</span> {painPoint.confidenceBasis}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Quote className="size-4 text-muted-foreground/60" aria-hidden="true" />
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {state.status === 'success' && state.result.painPoints.length > 0
                ? 'Select a pain point above to inspect its supporting quotes. Integrity and relevance are shown separately — exact string matching does not prove semantic relevance.'
                : 'Run analysis and select a pain point to inspect its supporting quotes. Integrity and relevance are shown separately — exact string matching does not prove semantic relevance.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
