'use client'

import { BadgeCheck, Database, Layers, MessageSquareText, ScanSearch, type LucideIcon } from 'lucide-react'
import { useReviewCollection } from './review-collection-provider'
import type { DatasetQuality, StarRating } from '@/lib/voc/types'
import { cn } from '@/lib/utils'

interface Metric {
  label: string
  description: string
  icon: LucideIcon
}

const metrics: Metric[] = [
  {
    label: 'Total reviews',
    description: 'Unique reviews in database',
    icon: MessageSquareText,
  },
  {
    label: 'With text',
    description: 'Reviews containing written content',
    icon: ScanSearch,
  },
  {
    label: 'Date range',
    description: 'Earliest to latest review',
    icon: Layers,
  },
  {
    label: 'Avg rating',
    description: 'Mean star rating across all stored reviews',
    icon: BadgeCheck,
  },
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function avgRating(dist: Record<StarRating, number>): string {
  let total = 0
  let sum = 0
  for (const [star, count] of Object.entries(dist)) {
    const s = Number(star) as StarRating
    total += count
    sum += s * count
  }
  if (total === 0) return '—'
  return (sum / total).toFixed(1)
}

export function OverviewCards() {
  const { state } = useReviewCollection()
  const result = state.status === 'success' ? state.result : null
  const fromStorage = state.status === 'success' && state.source === 'storage'
  const quality: DatasetQuality | null = result?.quality ?? null
  const reviewCount = result?.reviews.length ?? 0

  const values: (string | number)[] = [
    reviewCount > 0 ? reviewCount : '—',
    quality ? `${quality.withTextCount} of ${reviewCount}` : '—',
    quality && quality.earliestPostedAt ? `${fmtDate(quality.earliestPostedAt)} → ${fmtDate(quality.latestPostedAt)}` : '—',
    quality ? avgRating(quality.ratingDistribution) : '—',
  ]

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">
        Overview
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        {metrics.map((metric, i) => (
          <div key={metric.label} className="flex flex-col gap-3 bg-card p-4">
            <div className="flex items-center justify-between">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </dt>
              <div className="flex items-center gap-1.5">
                {fromStorage && i === 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                    <Database className="size-3" aria-hidden="true" />
                    stored
                  </span>
                )}
                <metric.icon className="size-4 text-muted-foreground/70" aria-hidden="true" />
              </div>
            </div>
            <dd className="flex flex-col gap-1">
              <span className={cn(
                'font-mono text-2xl font-semibold tabular-nums',
                reviewCount > 0 ? 'text-foreground' : 'text-muted-foreground/50',
              )}>
                {values[i]}
              </span>
              <span className="text-xs text-muted-foreground">
                {metric.description}
                {reviewCount === 0 && <span className="text-muted-foreground/70">{' · Awaiting data'}</span>}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {quality && reviewCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
          <span className="font-medium">Rating distribution:</span>
          {([5, 4, 3, 2, 1] as StarRating[]).map((star) => (
            <span key={star} className="inline-flex items-center gap-1">
              <span className="font-mono">{star}★</span>
              <span className="tabular-nums">{quality.ratingDistribution[star]}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Low-info:</span>
            <span className="tabular-nums">{quality.lowInformationCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Dev responses:</span>
            <span className="tabular-nums">{quality.withDeveloperResponseCount}</span>
          </span>
        </div>
      )}
    </section>
  )
}
