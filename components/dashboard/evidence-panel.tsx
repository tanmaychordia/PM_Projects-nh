'use client'

import { useMemo } from 'react'
import { Quote } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buildTaxonomyExport } from '@/lib/voc/taxonomy-export'
import type { Review } from '@/lib/voc/types'
import { useAnalysis } from './analysis-provider'
import { useReviewCollection } from './review-collection-provider'

const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export function EvidencePanel() {
  const { state, selectedCategoryId, selectCategory } = useAnalysis()
  const { state: collectionState } = useReviewCollection()

  const reviews = collectionState.status === 'success' ? collectionState.result.reviews : []
  const taxonomy = useMemo(() => buildTaxonomyExport(), [])

  const selectedCategory =
    state.status === 'success' && selectedCategoryId
      ? taxonomy.children.find((c) => c.id === selectedCategoryId) ?? null
      : null

  // Reviews assigned to the selected child category (primary or secondary),
  // based on the classifier output already in the dataset.
  const matchedReviews: Review[] = useMemo(() => {
    if (state.status !== 'success' || !selectedCategoryId) return []
    const byId = new Map(reviews.map((r) => [r.reviewId, r]))
    return state.result.classifications
      .filter(
        (c) =>
          c.primaryCategory === selectedCategoryId ||
          c.secondaryCategories.includes(selectedCategoryId),
      )
      .map((c) => byId.get(c.reviewId))
      .filter((r): r is Review => Boolean(r))
  }, [state, selectedCategoryId, reviews])

  const fields = ['Review ID', 'Verbatim text', 'Rating', 'Date']

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Evidence</CardTitle>
        <CardDescription className="text-xs">
          {selectedCategory
            ? `${selectedCategory.label} — ${matchedReviews.length} review${matchedReviews.length === 1 ? '' : 's'}`
            : 'Select a child category above to see its reviews'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col px-0">
        {selectedCategory ? (
          matchedReviews.length > 0 ? (
            <>
              <div className="grid grid-cols-[7rem_1fr_3rem_9rem] gap-3 border-b bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {fields.map((field) => (
                  <span key={field}>{field}</span>
                ))}
              </div>
              <ul className="max-h-[400px] divide-y overflow-y-auto">
                {matchedReviews.map((review) => (
                  <li
                    key={review.reviewId}
                    className="grid grid-cols-[7rem_1fr_3rem_9rem] gap-3 px-4 py-3 text-xs"
                  >
                    <span
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={review.reviewId}
                    >
                      {review.reviewId}
                    </span>
                    <blockquote className="whitespace-pre-line leading-relaxed text-foreground">
                      {review.text?.trim() || review.title?.trim() || '—'}
                    </blockquote>
                    <span className="font-mono text-muted-foreground">
                      {review.rating}★
                    </span>
                    <time
                      dateTime={review.postedAt}
                      className="text-[11px] text-muted-foreground"
                    >
                      {dateFormatter.format(new Date(review.postedAt))} UTC
                    </time>
                  </li>
                ))}
              </ul>
              <div className="border-t px-4 py-2.5">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Reviews matched via the classifier's primary or secondary category assignments.
                  Labels are overlapping — a review can appear in multiple categories.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Quote className="size-4 text-muted-foreground/60" aria-hidden="true" />
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                No reviews matched "{selectedCategory.label}". Try another child category, or
                collect more reviews.
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Quote className="size-4 text-muted-foreground/60" aria-hidden="true" />
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {state.status === 'success'
                ? 'Select a child category above to inspect its reviews here.'
                : 'Run analysis, then select a child category to inspect its reviews here.'}
            </p>
            {selectedCategoryId === null && state.status !== 'success' && reviews.length > 0 && (
              <p className="text-[11px] text-muted-foreground/80">
                No analysis run yet.
              </p>
            )}
          </div>
        )}
        {selectedCategoryId !== null && (
          <div className="border-t px-4 py-2.5">
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
