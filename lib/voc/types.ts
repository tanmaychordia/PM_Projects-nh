import type { CollectionSort, IntegrationStatus } from './config'

export type { CollectionSort }

export type StarRating = 1 | 2 | 3 | 4 | 5

export interface DeveloperResponse {
  text: string
  respondedAt: string | null
}

/**
 * A single Google Play review, normalized from the collector's output.
 * Fields Google Play did not provide are `null` — never inferred or filled in.
 */
export interface Review {
  reviewId: string
  source: 'google_play'
  rating: StarRating
  title: string | null
  text: string | null
  postedAt: string
  appVersion: string | null
  thumbsUpCount: number | null
  developerResponse: DeveloperResponse | null
  /** The collection pass that first returned this review. */
  collectedVia: CollectionSort
}

export interface EvidenceQuote {
  reviewId: string
  quote: string
  verified: boolean
}

export type Confidence = 'high' | 'medium' | 'low'

export interface PainPoint {
  id: string
  rank: number
  theme: string
  summary: string
  reviewCount: number
  shareOfNegative: number
  confidence: Confidence
  evidence: EvidenceQuote[]
}

export interface Recommendation {
  id: string
  painPointId: string
  title: string
  rationale: string
  horizon: 'now' | 'next' | 'later'
  supportingReviewIds: string[]
}

export interface HealthResponse {
  status: 'ok'
  service: string
  version: string
  timestamp: string
  uptimeSeconds: number
  runtime: string
  environment: string
  checks: {
    api: 'ok'
    reviewSource: IntegrationStatus
    analysisEngine: IntegrationStatus
  }
}

export type FetchReviewsErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'CROSS_ORIGIN_REJECTED'
  | 'COOLDOWN_ACTIVE'
  | 'FETCH_IN_PROGRESS'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_BLOCKED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_HTTP_ERROR'
  | 'UPSTREAM_PARSE_ERROR'
  | 'APP_NOT_FOUND'
  | 'INVALID_UPSTREAM_RESPONSE'
  | 'COLLECTOR_CONFIG_ERROR'
  | 'COLLECTION_DEADLINE'
  | 'CLIENT_ABORTED'
  | 'INTERNAL_ERROR'

export interface ApiErrorResponse {
  error: {
    code: FetchReviewsErrorCode | (string & {})
    message: string
    retryAfterSeconds?: number
  }
}

export type PassStopReason =
  | 'target_reached'
  | 'pass_budget_reached'
  | 'max_pages_reached'
  | 'no_more_pages'
  | 'empty_page'
  | 'no_new_reviews'
  | 'repeated_token'
  | 'deadline_reached'
  | 'client_aborted'
  | 'upstream_error'
  | 'skipped'

export interface CollectionPassSummary {
  sort: CollectionSort
  pagesFetched: number
  /** Sum of `num` values sent to Google Play in this pass. */
  requestedCount: number
  /** Raw items Google Play returned in this pass, before validation. */
  fetchedCount: number
  invalidCount: number
  /** Items whose review ID was already collected (in this or an earlier pass). */
  duplicateCount: number
  newUniqueCount: number
  stopReason: PassStopReason
  error: { code: string; message: string } | null
}

export interface CollectionWarning {
  code: 'TARGET_NOT_REACHED' | 'PASS_FAILED' | 'PASS_SKIPPED' | 'DEADLINE_REACHED' | 'OVERFLOW_TRIMMED' | 'NO_REVIEWS'
  message: string
}

export interface DatasetQuality {
  ratingDistribution: Record<StarRating, number>
  earliestPostedAt: string | null
  latestPostedAt: string | null
  withTextCount: number
  lowInformationCount: number
  lowInformationRule: string
  withDeveloperResponseCount: number
  bySort: Record<CollectionSort, number>
}

export interface CollectionProgress {
  pass: CollectionSort
  passIndex: number
  passCount: number
  page: number
  fetchedCount: number
  retainedCount: number
  targetUniqueCount: number
}

export interface FetchReviewsSuccess {
  packageId: string
  storefront: { country: string; language: string }
  method: {
    source: 'google_play'
    scraper: string
    pagination: 'server_side_token'
    passes: { sort: CollectionSort; order: number }[]
    pageSize: number
  }
  samplingNote: string
  targetUniqueCount: number
  /** True only if every planned pass ran without upstream errors, deadlines, or skips. */
  complete: boolean
  targetReached: boolean
  requestCount: number
  requestedCount: number
  /** Raw items returned by Google Play before validation. */
  fetchedCount: number
  /** Items dropped because required fields were missing or malformed. */
  invalidCount: number
  /** Items dropped because their source ID was already seen. */
  duplicateCount: number
  /** Valid, unique items beyond the target that upstream returned in excess of `num`. */
  overflowCount: number
  /** Reviews returned in `reviews` after validation and deduplication. */
  retainedCount: number
  passes: CollectionPassSummary[]
  quality: DatasetQuality
  warnings: CollectionWarning[]
  fetchedAt: string
  durationMs: number
  reviews: Review[]
}

export type CollectionStreamEvent =
  | { type: 'progress'; progress: CollectionProgress }
  | { type: 'result'; result: FetchReviewsSuccess }
  | { type: 'error'; error: { code: FetchReviewsErrorCode; message: string; retryAfterSeconds?: number } }
