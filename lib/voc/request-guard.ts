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

function toOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).origin
  } catch {
    return null
  }
}

/**
 * Origins trusted when a browser omits Fetch Metadata. Sourced only from
 * server-side configuration, never from request headers such as Host.
 * APP_ALLOWED_ORIGINS is a comma-separated list, e.g. "https://voc.example.com".
 */
function trustedOrigins(): Set<string> {
  const candidates = [
    ...(process.env.APP_ALLOWED_ORIGINS?.split(',') ?? []),
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
  const origins = new Set<string>()
  for (const candidate of candidates) {
    const origin = toOrigin(candidate?.trim())
    if (origin) origins.add(origin)
  }
  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }
  return origins
}

function reject(reason: string, message: string): GuardRejection {
  console.warn(`[voc] review fetch rejected reason=${reason}`)
  return { code: 'CROSS_ORIGIN_REJECTED', status: 403, message }
}

/**
 * Browsers set Sec-Fetch-Site themselves and page scripts cannot change it, so it
 * stays accurate behind proxies that rewrite Host. Only "same-origin" is accepted.
 * Without Fetch Metadata, a present Origin must match a configured trusted origin.
 * Requests with neither header come from non-browser clients, which cannot carry
 * a victim's browser context, so they are left to the throttling guard.
 */
export function checkSameOrigin(request: Request): GuardRejection | null {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) {
    if (fetchSite === 'same-origin') return null
    return reject(`sec-fetch-site:${fetchSite}`, 'Cross-site requests are not allowed.')
  }

  const originHeader = request.headers.get('origin')
  if (!originHeader) return null

  const origin = toOrigin(originHeader)
  if (!origin || originHeader === 'null') return reject('origin:invalid', 'Invalid Origin header.')
  if (trustedOrigins().has(origin)) return null
  return reject('origin:untrusted', 'Cross-origin requests are not allowed.')
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
