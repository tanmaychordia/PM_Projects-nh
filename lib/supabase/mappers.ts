import type { Review, StarRating, CollectionSort, DatasetQuality, CollectionWarning } from '@/lib/voc/types'

export interface ReviewRow {
  review_id: string
  source: string
  rating: number
  title: string | null
  text: string | null
  posted_at: string
  app_version: string | null
  thumbs_up_count: number | null
  developer_response_text: string | null
  developer_response_at: string | null
  collected_via: string
  first_collected_at: string
  last_updated_at: string
}

export interface CollectionRunRow {
  id: string
  fetched_at: string
  package_id: string
  storefront_country: string
  storefront_language: string
  target_unique_count: number
  retained_count: number
  fetched_count: number
  invalid_count: number
  duplicate_count: number
  complete: boolean
  target_reached: boolean
  duration_ms: number
  warnings: CollectionWarning[]
  quality: DatasetQuality
  new_review_ids: string[]
  updated_review_ids: string[]
}

export function rowToReview(row: ReviewRow): Review {
  return {
    reviewId: row.review_id,
    source: 'google_play',
    rating: row.rating as StarRating,
    title: row.title,
    text: row.text,
    postedAt: row.posted_at,
    appVersion: row.app_version,
    thumbsUpCount: row.thumbs_up_count,
    developerResponse: row.developer_response_text
      ? {
          text: row.developer_response_text,
          respondedAt: row.developer_response_at,
        }
      : null,
    collectedVia: row.collected_via as CollectionSort,
  }
}

export function reviewToRow(review: Review): Omit<ReviewRow, 'first_collected_at' | 'last_updated_at'> {
  return {
    review_id: review.reviewId,
    source: 'google_play',
    rating: review.rating,
    title: review.title,
    text: review.text,
    posted_at: review.postedAt,
    app_version: review.appVersion,
    thumbs_up_count: review.thumbsUpCount,
    developer_response_text: review.developerResponse?.text ?? null,
    developer_response_at: review.developerResponse?.respondedAt ?? null,
    collected_via: review.collectedVia,
  }
}
