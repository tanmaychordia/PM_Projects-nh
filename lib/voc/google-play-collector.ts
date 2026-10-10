import {
  BlockedError,
  HttpError,
  NotFoundError,
  ParseError,
  RateLimitError,
  ValidationError,
  reviews as fetchPlayReviews,
  sort as playSort,
} from '@mradex77/google-play-scraper'
import { PLAY_STORE_PACKAGE_ID, REVIEW_FETCH, SAMPLING_NOTE, SCRAPER, type CollectionPassPlan } from './config'
import type {
  CollectionPassSummary,
  CollectionProgress,
  CollectionSort,
  CollectionWarning,
  DatasetQuality,
  FetchReviewsErrorCode,
  FetchReviewsSuccess,
  Review,
  StarRating,
} from './types'

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

export interface PageRequest {
  sort: CollectionSort
  num: number
  token: string | undefined
  signal: AbortSignal
}

export interface PageResponse {
  data: unknown[]
  nextPaginationToken: string | null
}

export type FetchPage = (request: PageRequest) => Promise<PageResponse>

export interface CollectionPlan {
  targetUniqueReviews: number
  pageSize: number
  passes: readonly CollectionPassPlan[]
  pauseBetweenRequestsMs: number
  totalDeadlineMs: number
  lowInformationMaxWords: number
}

export interface CollectOptions {
  fetchPage?: FetchPage
  plan?: CollectionPlan
  signal?: AbortSignal
  onProgress?: (progress: CollectionProgress) => void
}

const SORT_CODES = { newest: playSort.NEWEST, helpfulness: playSort.HELPFULNESS } as const

/** Errors that mean further upstream requests in this run would be unsafe or pointless. */
const HALTING_CODES = new Set<FetchReviewsErrorCode>([
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_BLOCKED',
  'APP_NOT_FOUND',
  'COLLECTOR_CONFIG_ERROR',
  'COLLECTION_DEADLINE',
  'CLIENT_ABORTED',
])

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

/** Returns null when a required field (ID, rating, date) is missing or malformed. Text is kept verbatim. */
export function normalizeReview(raw: unknown, collectedVia: CollectionSort): Review | null {
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
    collectedVia,
  }
}

function toCollectorError(error: unknown, signals: { deadline: AbortSignal; client?: AbortSignal }): CollectorError {
  if (error instanceof CollectorError) return error
  if (signals.client?.aborted) {
    return new CollectorError('CLIENT_ABORTED', 499, 'The request was cancelled before collection finished.')
  }
  if (signals.deadline.aborted) {
    return new CollectorError('COLLECTION_DEADLINE', 504, 'The collection time budget ran out.')
  }
  if (error instanceof RateLimitError) {
    return new CollectorError('UPSTREAM_RATE_LIMITED', 429, 'Google Play is rate-limiting requests. Wait a minute and try again.')
  }
  if (error instanceof BlockedError) {
    return new CollectorError('UPSTREAM_BLOCKED', 502, 'Google Play blocked the request from this server.')
  }
  if (error instanceof NotFoundError) {
    return new CollectorError('APP_NOT_FOUND', 404, `Google Play did not find ${PLAY_STORE_PACKAGE_ID} in the requested storefront.`)
  }
  if (error instanceof HttpError) {
    return new CollectorError('UPSTREAM_HTTP_ERROR', 502, `Google Play responded with HTTP ${error.status}.`)
  }
  if (error instanceof ParseError) {
    return new CollectorError('UPSTREAM_PARSE_ERROR', 502, 'Google Play returned a response the collector could not parse. The page format may have changed.')
  }
  if (error instanceof ValidationError) {
    return new CollectorError('COLLECTOR_CONFIG_ERROR', 500, 'The review collector is misconfigured.')
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return new CollectorError('UPSTREAM_TIMEOUT', 504, 'Google Play did not respond in time.')
  }
  return new CollectorError('INTERNAL_ERROR', 500, 'Review collection failed unexpectedly.')
}

export const fetchGooglePlayPage: FetchPage = async ({ sort, num, token, signal }) => {
  const result = await fetchPlayReviews({
    appId: PLAY_STORE_PACKAGE_ID,
    sort: SORT_CODES[sort],
    num,
    paginate: true,
    ...(token ? { nextPaginationToken: token } : {}),
    country: REVIEW_FETCH.country,
    lang: REVIEW_FETCH.language,
    requestOptions: {
      timeoutMs: REVIEW_FETCH.perRequestTimeoutMs,
      retries: REVIEW_FETCH.upstreamRetries,
      signal,
    },
  })
  if (!result || !Array.isArray(result.data)) {
    throw new CollectorError('INVALID_UPSTREAM_RESPONSE', 502, 'Google Play returned an unexpected response shape.')
  }
  return {
    data: result.data,
    nextPaginationToken: isNonEmptyString(result.nextPaginationToken) ? result.nextPaginationToken : null,
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length
}

export function summarizeDataset(reviews: Review[], lowInformationMaxWords: number): DatasetQuality {
  const ratingDistribution: Record<StarRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const bySort: Record<CollectionSort, number> = { newest: 0, helpfulness: 0 }
  let earliest: string | null = null
  let latest: string | null = null
  let withText = 0
  let lowInformation = 0
  let withDeveloperResponse = 0

  for (const review of reviews) {
    ratingDistribution[review.rating]++
    bySort[review.collectedVia]++
    if (!earliest || review.postedAt < earliest) earliest = review.postedAt
    if (!latest || review.postedAt > latest) latest = review.postedAt
    if (review.text) withText++
    if (!review.text || wordCount(review.text) <= lowInformationMaxWords) lowInformation++
    if (review.developerResponse) withDeveloperResponse++
  }

  return {
    ratingDistribution,
    earliestPostedAt: earliest,
    latestPostedAt: latest,
    withTextCount: withText,
    lowInformationCount: lowInformation,
    lowInformationRule: `No text, or ${lowInformationMaxWords} words or fewer`,
    withDeveloperResponseCount: withDeveloperResponse,
    bySort,
  }
}

const DEFAULT_PLAN: CollectionPlan = {
  targetUniqueReviews: REVIEW_FETCH.targetUniqueReviews,
  pageSize: REVIEW_FETCH.pageSize,
  passes: REVIEW_FETCH.passes,
  pauseBetweenRequestsMs: REVIEW_FETCH.pauseBetweenRequestsMs,
  totalDeadlineMs: REVIEW_FETCH.totalDeadlineMs,
  lowInformationMaxWords: REVIEW_FETCH.lowInformationMaxWords,
}

/**
 * Collects reviews in sequential passes (newest, then helpfulness), following Google Play
 * pagination tokens server-side. Reviews are deduplicated by source ID across passes.
 * A failure after some pages returns the reviews already collected with explicit warnings;
 * only a run that retains nothing and hit an error throws.
 */
export async function collectGooglePlayReviews(options: CollectOptions = {}): Promise<FetchReviewsSuccess> {
  const plan = options.plan ?? DEFAULT_PLAN
  const fetchPage = options.fetchPage ?? fetchGooglePlayPage
  const startedAt = Date.now()
  const deadline = AbortSignal.timeout(plan.totalDeadlineMs)
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline
  const signals = { deadline, client: options.signal }

  const collected = new Map<string, Review>()
  const passes: CollectionPassSummary[] = []
  const warnings: CollectionWarning[] = []
  let requestCount = 0
  let overflowCount = 0
  let firstError: CollectorError | null = null
  let haltingError: CollectorError | null = null

  for (const [passIndex, passPlan] of plan.passes.entries()) {
    const pass: CollectionPassSummary = {
      sort: passPlan.sort,
      pagesFetched: 0,
      requestedCount: 0,
      fetchedCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      newUniqueCount: 0,
      stopReason: 'max_pages_reached',
      error: null,
    }
    passes.push(pass)

    if (haltingError) {
      pass.stopReason = 'skipped'
      continue
    }

    const budget = Math.min(passPlan.cumulativeUniqueBudget, plan.targetUniqueReviews)
    const usedTokens = new Set<string>()
    let token: string | undefined

    for (let page = 0; ; page++) {
      if (collected.size >= budget) {
        pass.stopReason = collected.size >= plan.targetUniqueReviews ? 'target_reached' : 'pass_budget_reached'
        break
      }
      if (page >= passPlan.maxPages) {
        pass.stopReason = 'max_pages_reached'
        break
      }

      const num = Math.min(plan.pageSize, budget - collected.size)
      let response: PageResponse
      try {
        if (requestCount > 0) await pause(plan.pauseBetweenRequestsMs, signal)
        requestCount++
        response = await fetchPage({ sort: passPlan.sort, num, token, signal })
      } catch (error) {
        const collectorError = toCollectorError(error, signals)
        firstError ??= collectorError
        pass.error = { code: collectorError.code, message: collectorError.message }
        pass.stopReason =
          collectorError.code === 'COLLECTION_DEADLINE'
            ? 'deadline_reached'
            : collectorError.code === 'CLIENT_ABORTED'
              ? 'client_aborted'
              : 'upstream_error'
        if (HALTING_CODES.has(collectorError.code)) haltingError = collectorError
        break
      }

      pass.pagesFetched++
      pass.requestedCount += num
      pass.fetchedCount += response.data.length

      let newInPage = 0
      for (const item of response.data) {
        const review = normalizeReview(item, passPlan.sort)
        if (!review) {
          pass.invalidCount++
          continue
        }
        if (collected.has(review.reviewId)) {
          pass.duplicateCount++
          continue
        }
        if (collected.size >= budget) {
          overflowCount++
          continue
        }
        collected.set(review.reviewId, review)
        pass.newUniqueCount++
        newInPage++
      }

      options.onProgress?.({
        pass: passPlan.sort,
        passIndex,
        passCount: plan.passes.length,
        page: page + 1,
        fetchedCount: passes.reduce((sum, p) => sum + p.fetchedCount, 0),
        retainedCount: collected.size,
        targetUniqueCount: plan.targetUniqueReviews,
      })

      if (response.data.length === 0) {
        pass.stopReason = 'empty_page'
        break
      }
      if (newInPage === 0 && collected.size < budget) {
        pass.stopReason = 'no_new_reviews'
        break
      }
      const next = response.nextPaginationToken
      if (!next) {
        pass.stopReason = 'no_more_pages'
        break
      }
      if (next === token || usedTokens.has(next)) {
        pass.stopReason = 'repeated_token'
        break
      }
      usedTokens.add(next)
      token = next
    }
  }

  const reviews = [...collected.values()]

  if (reviews.length === 0 && firstError) {
    throw new CollectorError(firstError.code, firstError.httpStatus, `${firstError.message} No reviews were retained.`)
  }

  for (const pass of passes) {
    if (pass.error) {
      warnings.push({
        code: pass.error.code === 'COLLECTION_DEADLINE' ? 'DEADLINE_REACHED' : 'PASS_FAILED',
        message: `The ${pass.sort} pass stopped after ${pass.pagesFetched} page${pass.pagesFetched === 1 ? '' : 's'}: ${pass.error.message} Reviews already collected were kept.`,
      })
    } else if (pass.stopReason === 'skipped') {
      warnings.push({
        code: 'PASS_SKIPPED',
        message: `The ${pass.sort} pass was skipped because an earlier pass hit ${haltingError?.code ?? 'a halting error'}.`,
      })
    }
  }
  if (overflowCount > 0) {
    warnings.push({
      code: 'OVERFLOW_TRIMMED',
      message: `Google Play returned ${overflowCount} more unique reviews than requested; they were not retained to respect the ${plan.targetUniqueReviews}-review target.`,
    })
  }
  if (reviews.length === 0) {
    warnings.push({ code: 'NO_REVIEWS', message: 'Google Play returned no valid reviews for this storefront and language.' })
  } else if (reviews.length < plan.targetUniqueReviews) {
    warnings.push({
      code: 'TARGET_NOT_REACHED',
      message: `Collected ${reviews.length} of the ${plan.targetUniqueReviews}-review target.`,
    })
  }

  const totals = passes.reduce(
    (acc, p) => ({
      requested: acc.requested + p.requestedCount,
      fetched: acc.fetched + p.fetchedCount,
      invalid: acc.invalid + p.invalidCount,
      duplicate: acc.duplicate + p.duplicateCount,
    }),
    { requested: 0, fetched: 0, invalid: 0, duplicate: 0 },
  )

  return {
    packageId: PLAY_STORE_PACKAGE_ID,
    storefront: { country: REVIEW_FETCH.country, language: REVIEW_FETCH.language },
    method: {
      source: 'google_play',
      scraper: `${SCRAPER.name}@${SCRAPER.version}`,
      pagination: 'server_side_token',
      passes: plan.passes.map((p, order) => ({ sort: p.sort, order: order + 1 })),
      pageSize: plan.pageSize,
    },
    samplingNote: SAMPLING_NOTE,
    targetUniqueCount: plan.targetUniqueReviews,
    complete: passes.every((p) => !p.error && p.stopReason !== 'skipped'),
    targetReached: reviews.length >= plan.targetUniqueReviews,
    requestCount,
    requestedCount: totals.requested,
    fetchedCount: totals.fetched,
    invalidCount: totals.invalid,
    duplicateCount: totals.duplicate,
    overflowCount,
    retainedCount: reviews.length,
    passes,
    quality: summarizeDataset(reviews, plan.lowInformationMaxWords),
    warnings,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    reviews,
  }
}
