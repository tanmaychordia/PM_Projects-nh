import { CollectorError, collectGooglePlayReviews } from '@/lib/voc/google-play-collector'
import { acquireFetchSlot, checkSameOrigin, type GuardRejection } from '@/lib/voc/request-guard'
import type { ApiErrorResponse, CollectionStreamEvent } from '@/lib/voc/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' }

function errorResponse({ code, status, message, retryAfterSeconds }: GuardRejection) {
  const body: ApiErrorResponse = { error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } }
  const headers: Record<string, string> = { ...NO_STORE }
  if (retryAfterSeconds) headers['Retry-After'] = String(retryAfterSeconds)
  return Response.json(body, { status, headers })
}

/**
 * Guard rejections return a JSON error with a matching HTTP status. Once collection starts,
 * the response is NDJSON: zero or more `progress` events, then exactly one `result` or `error`.
 */
export async function POST(request: Request) {
  const originRejection = checkSameOrigin(request)
  if (originRejection) return errorResponse(originRejection)

  const slot = acquireFetchSlot(request)
  if (!('release' in slot)) return errorResponse(slot)

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CollectionStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          // The client disconnected; collection is stopped through request.signal.
        }
      }

      try {
        const result = await collectGooglePlayReviews({
          signal: request.signal,
          onProgress: (progress) => send({ type: 'progress', progress }),
        })
        console.log(
          `[voc] reviews requests=${result.requestCount} fetched=${result.fetchedCount} retained=${result.retainedCount} invalid=${result.invalidCount} duplicates=${result.duplicateCount} complete=${result.complete} ms=${result.durationMs}`,
        )
        send({ type: 'result', result })
      } catch (error) {
        const collectorError =
          error instanceof CollectorError
            ? error
            : new CollectorError('INTERNAL_ERROR', 500, 'Review collection failed unexpectedly. No reviews were retained.')
        console.error(`[voc] review fetch failed code=${collectorError.code}`)
        send({
          type: 'error',
          error: {
            code: collectorError.code,
            message: collectorError.message,
            ...(collectorError.code === 'UPSTREAM_RATE_LIMITED' ? { retryAfterSeconds: 60 } : {}),
          },
        })
      } finally {
        slot.release()
        try {
          controller.close()
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
  })

  return new Response(stream, {
    headers: { ...NO_STORE, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}

export function GET() {
  return errorResponse({ code: 'METHOD_NOT_ALLOWED', status: 405, message: 'Use POST to fetch reviews.' })
}
