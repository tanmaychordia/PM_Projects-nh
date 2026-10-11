import { checkSameOrigin } from '@/lib/voc/request-guard'
import { analyzeReviews } from '@/lib/voc/analysis-engine'
import type { AnalysisErrorCode, AnalysisResponse, ApiErrorResponse, Review } from '@/lib/voc/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

function errorResponse(code: AnalysisErrorCode, status: number, message: string) {
  const body: ApiErrorResponse = { error: { code, message } }
  return Response.json(body, { status, headers: NO_STORE })
}

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Review>
  return (
    typeof v.reviewId === 'string' &&
    typeof v.rating === 'number' &&
    typeof v.postedAt === 'string' &&
    v.source === 'google_play'
  )
}

export async function POST(request: Request) {
  const originRejection = checkSameOrigin(request)
  if (originRejection) {
    return errorResponse('METHOD_NOT_ALLOWED' as AnalysisErrorCode, originRejection.status, originRejection.message)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('INVALID_BODY', 400, 'Request body is not valid JSON.')
  }

  if (!body || typeof body !== 'object') {
    return errorResponse('INVALID_BODY', 400, 'Request body must be a JSON object.')
  }

  const payload = body as { reviews?: unknown }
  if (!Array.isArray(payload.reviews)) {
    return errorResponse('INVALID_BODY', 400, 'Missing or malformed "reviews" array.')
  }

  const reviews = payload.reviews.filter(isReview) as Review[]

  if (reviews.length === 0) {
    return errorResponse('NO_REVIEWS', 400, 'No valid reviews were provided for analysis.')
  }

  const reviewsWithText = reviews.filter((r) => (r.title?.trim() || r.text?.trim()))
  if (reviewsWithText.length === 0) {
    return errorResponse('NO_TEXT_REVIEWS', 400, 'All reviews lack title and text content. Theme matching requires written content.')
  }

  try {
    const result: AnalysisResponse = analyzeReviews(reviews)
    return Response.json(result, { status: 200, headers: NO_STORE })
  } catch (error) {
    console.error('[voc] analysis failed:', error)
    return errorResponse('INTERNAL_ERROR', 500, 'Analysis failed unexpectedly.')
  }
}

export function GET() {
  return errorResponse('METHOD_NOT_ALLOWED', 405, 'Use POST to run analysis.')
}
