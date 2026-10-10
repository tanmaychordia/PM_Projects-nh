import {
  BlockedError,
  HttpError,
  NotFoundError,
  ParseError,
  RateLimitError,
  ValidationError,
  reviews as fetchPlayReviews,
  sort,
} from '@mradex77/google-play-scraper'
import { PLAY_STORE_PACKAGE_ID, REVIEW_FETCH } from './config'
import type { FetchReviewsErrorCode, FetchReviewsSuccess, Review, StarRating } from './types'

export class CollectorError extends Error {
  constructor(
    readonly code: FetchReviewsErrorCode,
    readonly httpStatus: number,
    message: string,
  ) {
    super(message)
    this.name = 'CollectorError'
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function toStarRating(value: unknown): StarRating | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? (value as StarRating)
    : null
}

/** Returns null when a required field (ID, rating, date) is missing or malformed. */
export function normalizeReview(raw: unknown): Review | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const reviewId = isNonEmptyString(r.id) ? r.id : null
  const rating = toStarRating(r.score)
  const postedAt = toIsoOrNull(r.date)
  if (!reviewId || !rating || !postedAt) return null

  const replyText = isNonEmptyString(r.replyText) ? r.replyText : null

  return {
    reviewId,
    source: 'google_play',
    rating,
    title: isNonEmptyString(r.title) ? r.title : null,
    text: isNonEmptyString(r.text) ? r.text : null,
    postedAt,
    appVersion: isNonEmptyString(r.version) ? r.version : null,
    thumbsUpCount:
      typeof r.thumbsUp === 'number' && Number.isFinite(r.thumbsUp) && r.thumbsUp >= 0 ? r.thumbsUp : null,
    developerResponse: replyText ? { text: replyText, respondedAt: toIsoOrNull(r.replyDate) } : null,
  }
}

function toCollectorError(error: unknown): CollectorError {
  if (error instanceof CollectorError) return error
  if (error instanceof RateLimitError) {
    return new CollectorError('UPSTREAM_RATE_LIMITED', 429, 'Google Play is rate-limiting requests. Wait a minute and try again.')
  }
  if (error instanceof BlockedError) {
    return new CollectorError('UPSTREAM_BLOCKED', 502, 'Google Play blocked the request from this server. No reviews were fetched.')
  }
  if (error instanceof NotFoundError) {
    return new CollectorError('APP_NOT_FOUND', 404, `Google Play did not find ${PLAY_STORE_PACKAGE_ID} in the requested storefront.`)
  }
  if (error instanceof HttpError) {
    return new CollectorError('UPSTREAM_HTTP_ERROR', 502, `Google Play responded with HTTP ${error.status}. No reviews were fetched.`)
  }
  if (error instanceof ParseError) {
    return new CollectorError('UPSTREAM_PARSE_ERROR', 502, 'Google Play returned a response the collector could not parse. The page format may have changed.')
  }
  if (error instanceof ValidationError) {
    return new CollectorError('COLLECTOR_CONFIG_ERROR', 500, 'The review collector is misconfigured. No reviews were fetched.')
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return new CollectorError('UPSTREAM_TIMEOUT', 504, 'Google Play did not respond in time. No reviews were fetched.')
  }
  return new CollectorError('INTERNAL_ERROR', 500, 'Review collection failed unexpectedly. No reviews were fetched.')
}

export async function collectGooglePlayReviews(): Promise<FetchReviewsSuccess> {
  const startedAt = Date.now()

  let result: Awaited<ReturnType<typeof fetchPlayReviews>>
  try {
    result = await fetchPlayReviews({
      appId: PLAY_STORE_PACKAGE_ID,
      sort: sort.NEWEST,
      num: REVIEW_FETCH.maxReviews,
      country: REVIEW_FETCH.country,
      lang: REVIEW_FETCH.language,
      requestOptions: {
        timeoutMs: REVIEW_FETCH.perRequestTimeoutMs,
        retries: REVIEW_FETCH.upstreamRetries,
        signal: AbortSignal.timeout(REVIEW_FETCH.totalTimeoutMs),
      },
    })
  } catch (error) {
    throw toCollectorError(error)
  }

  if (!result || !Array.isArray(result.data)) {
    throw new CollectorError('INVALID_UPSTREAM_RESPONSE', 502, 'Google Play returned an unexpected response shape. No reviews were fetched.')
  }

  // The library may return more than requested if a page overshoots; enforce the cap.
  const raw = result.data.slice(0, REVIEW_FETCH.maxReviews)
  const seen = new Set<string>()
  const retained: Review[] = []
  let invalidCount = 0
  let duplicateCount = 0

  for (const item of raw) {
    const review = normalizeReview(item)
    if (!review) {
      invalidCount++
      continue
    }
    if (seen.has(review.reviewId)) {
      duplicateCount++
      continue
    }
    seen.add(review.reviewId)
    retained.push(review)
  }

  return {
    packageId: PLAY_STORE_PACKAGE_ID,
    storefront: { country: REVIEW_FETCH.country, language: REVIEW_FETCH.language },
    sort: REVIEW_FETCH.sort,
    requestedCount: REVIEW_FETCH.maxReviews,
    fetchedCount: raw.length,
    invalidCount,
    duplicateCount,
    retainedCount: retained.length,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    reviews: retained,
  }
}
