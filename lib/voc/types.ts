import type { IntegrationStatus } from './config'

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
  | 'INTERNAL_ERROR'

export interface ApiErrorResponse {
  error: {
    code: FetchReviewsErrorCode | (string & {})
    message: string
    retryAfterSeconds?: number
  }
}

export interface FetchReviewsSuccess {
  packageId: string
  storefront: { country: string; language: string }
  sort: 'newest'
  requestedCount: number
  /** Raw items returned by Google Play before validation. */
  fetchedCount: number
  /** Items dropped because required fields were missing or malformed. */
  invalidCount: number
  /** Items dropped because their source ID was already seen. */
  duplicateCount: number
  /** Reviews returned in `reviews` after validation and deduplication. */
  retainedCount: number
  fetchedAt: string
  durationMs: number
  reviews: Review[]
}
