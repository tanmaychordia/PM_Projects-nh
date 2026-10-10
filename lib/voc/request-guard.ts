import { REVIEW_FETCH } from './config'
import type { FetchReviewsErrorCode } from './types'

export interface GuardRejection {
  code: FetchReviewsErrorCode
  status: number
  message: string
  retryAfterSeconds?: number
}

// Best-effort, per-instance protection. Serverless instances do not share this
// memory, so it limits bursts rather than enforcing a global quota.
const lastRequestByClient = new Map<string, number>()
let inFlight = false

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export function checkSameOrigin(request: Request): GuardRejection | null {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return { code: 'CROSS_ORIGIN_REJECTED', status: 403, message: 'Cross-site requests are not allowed.' }
  }
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return { code: 'CROSS_ORIGIN_REJECTED', status: 403, message: 'Cross-origin requests are not allowed.' }
      }
    } catch {
      return { code: 'CROSS_ORIGIN_REJECTED', status: 403, message: 'Invalid Origin header.' }
    }
  }
  return null
}

/** Reserves the collector for this request; call the returned release function when done. */
export function acquireFetchSlot(request: Request): { release: () => void } | GuardRejection {
  if (inFlight) {
    return {
      code: 'FETCH_IN_PROGRESS',
      status: 429,
      message: 'A review fetch is already running. Wait for it to finish.',
      retryAfterSeconds: 5,
    }
  }

  const key = clientKey(request)
  const now = Date.now()
  const last = lastRequestByClient.get(key)
  const cooldownMs = REVIEW_FETCH.cooldownSeconds * 1000
  if (last && now - last < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - (now - last)) / 1000)
    return {
      code: 'COOLDOWN_ACTIVE',
      status: 429,
      message: `Please wait ${retryAfterSeconds}s before fetching again.`,
      retryAfterSeconds,
    }
  }

  if (lastRequestByClient.size > 1000) lastRequestByClient.clear()
  lastRequestByClient.set(key, now)
  inFlight = true
  return {
    release: () => {
      inFlight = false
    },
  }
}
