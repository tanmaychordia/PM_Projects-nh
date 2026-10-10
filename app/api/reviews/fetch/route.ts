import { PLAY_STORE_PACKAGE_ID } from '@/lib/voc/config'
import type { ApiErrorResponse } from '@/lib/voc/types'

export const dynamic = 'force-dynamic'

// Placeholder until Google Play collection is implemented. Always reports
// "not implemented" so the UI never shows a fabricated successful fetch.
export function POST() {
  const body: ApiErrorResponse = {
    error: {
      code: 'REVIEW_SOURCE_NOT_CONFIGURED',
      message: `Google Play review collection for ${PLAY_STORE_PACKAGE_ID} has not been connected yet. No reviews were fetched.`,
    },
  }

  return Response.json(body, { status: 501, headers: { 'Cache-Control': 'no-store' } })
}
