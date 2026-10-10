import { CollectorError, collectGooglePlayReviews } from '@/lib/voc/google-play-collector'
import { acquireFetchSlot, checkSameOrigin, type GuardRejection } from '@/lib/voc/request-guard'
import type { ApiErrorResponse } from '@/lib/voc/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE = { 'Cache-Control': 'no-store' }

function errorResponse({ code, status, message, retryAfterSeconds }: GuardRejection) {
  const body: ApiErrorResponse = { error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } }
  const headers: Record<string, string> = { ...NO_STORE }
  if (retryAfterSeconds) headers['Retry-After'] = String(retryAfterSeconds)
  return Response.json(body, { status, headers })
}

export async function POST(request: Request) {
  const originRejection = checkSameOrigin(request)
  if (originRejection) return errorResponse(originRejection)

  const slot = acquireFetchSlot(request)
  if (!('release' in slot)) return errorResponse(slot)

  try {
    const result = await collectGooglePlayReviews()
    console.log(
      `[voc] reviews fetched=${result.fetchedCount} retained=${result.retainedCount} invalid=${result.invalidCount} duplicates=${result.duplicateCount} ms=${result.durationMs}`,
    )
    return Response.json(result, { headers: NO_STORE })
  } catch (error) {
    const collectorError =
      error instanceof CollectorError
        ? error
        : new CollectorError('INTERNAL_ERROR', 500, 'Review collection failed unexpectedly. No reviews were fetched.')
    console.error(`[voc] review fetch failed code=${collectorError.code}`)
    return errorResponse({
      code: collectorError.code,
      status: collectorError.httpStatus,
      message: collectorError.message,
      retryAfterSeconds: collectorError.code === 'UPSTREAM_RATE_LIMITED' ? 60 : undefined,
    })
  } finally {
    slot.release()
  }
}

export function GET() {
  return errorResponse({ code: 'METHOD_NOT_ALLOWED', status: 405, message: 'Use POST to fetch reviews.' })
}
