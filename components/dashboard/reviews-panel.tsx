'use client'

import { AlertCircle, CornerDownRight, Inbox, Star, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Review } from '@/lib/voc/types'
import { cn } from '@/lib/utils'
import { useReviewCollection } from './review-collection-provider'

const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn('size-3', i <= rating ? 'fill-warning text-warning' : 'text-border')}
        />
      ))}
    </span>
  )
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <li className="grid grid-cols-[180px_1fr] gap-4 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-1.5 text-xs">
        <RatingStars rating={review.rating} />
        <time dateTime={review.postedAt} className="text-muted-foreground">
          {dateFormatter.format(new Date(review.postedAt))} UTC
        </time>
        <span className="truncate font-mono text-[11px] text-muted-foreground" title={review.reviewId}>
          {review.reviewId}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>v{review.appVersion ?? ' n/a'}</span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="size-3" aria-hidden="true" />
            <span className="sr-only">Helpful votes:</span>
            {review.thumbsUpCount ?? 'n/a'}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {review.title && <p className="text-sm font-medium">{review.title}</p>}
        {review.text ? (
          <blockquote className="whitespace-pre-line text-sm leading-relaxed text-foreground">{review.text}</blockquote>
        ) : (
          <p className="text-sm italic text-muted-foreground">Rating only — no review text provided.</p>
        )}
        {review.developerResponse && (
          <div className="flex gap-2 rounded-md border bg-surface px-3 py-2 text-xs">
            <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium text-muted-foreground">
                Developer response
                {review.developerResponse.respondedAt &&
                  ` · ${dateFormatter.format(new Date(review.developerResponse.respondedAt))} UTC`}
              </span>
              <p className="whitespace-pre-line leading-relaxed">{review.developerResponse.text}</p>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

function EmptyState({ title, description, icon: Icon = Inbox }: { title: string; description: string; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex size-9 items-center justify-center rounded-md border bg-surface">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

export function ReviewsPanel() {
  const { state } = useReviewCollection()
  const result = state.status === 'success' ? state.result : null

  return (
    <Card className="gap-0 py-0" aria-busy={state.status === 'loading'}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b py-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-semibold">Collected reviews</CardTitle>
          <CardDescription className="text-xs">
            Verbatim Google Play reviews with source IDs. Text is shown exactly as returned.
          </CardDescription>
        </div>
        {result && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[11px]">
              {result.fetchedCount} fetched
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px]">
              {result.retainedCount} retained
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] uppercase">
              {result.storefront.country} · {result.storefront.language}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {state.status === 'idle' && (
          <EmptyState
            title="No reviews collected yet"
            description="Use “Fetch reviews” to pull the latest reviews for com.snabbit.customer from the Indian Google Play storefront."
          />
        )}

        {state.status === 'loading' && (
          <ul className="divide-y" aria-label="Loading reviews">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="grid grid-cols-[180px_1fr] gap-4 px-4 py-3.5">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {state.status === 'error' && (
          <EmptyState
            icon={AlertCircle}
            title="No reviews to display"
            description={`The last fetch failed (${state.code}). Nothing was substituted — fix the issue or retry from the Data import panel.`}
          />
        )}

        {result && result.reviews.length === 0 && (
          <EmptyState
            title="Google Play returned no reviews"
            description="The request succeeded, but no valid reviews were returned for this storefront and language."
          />
        )}

        {result && result.reviews.length > 0 && (
          <ul className="max-h-[640px] divide-y overflow-y-auto" aria-label={`${result.retainedCount} collected reviews`}>
            {result.reviews.map((review) => (
              <ReviewRow key={review.reviewId} review={review} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
