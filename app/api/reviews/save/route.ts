import { getServerSupabase } from '@/lib/supabase/server'
import { reviewToRow, type CollectionRunRow } from '@/lib/supabase/mappers'
import type { ApiErrorResponse, FetchReviewsSuccess } from '@/lib/voc/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

interface SaveRequestBody {
  result: FetchReviewsSuccess
}

export async function POST(request: Request) {
  let body: SaveRequestBody
  try {
    body = (await request.json()) as SaveRequestBody
  } catch {
    const errorBody: ApiErrorResponse = { error: { code: 'INVALID_BODY', message: 'Request body is not valid JSON.' } }
    return Response.json(errorBody, { status: 400, headers: NO_STORE })
  }

  if (!body.result || !Array.isArray(body.result.reviews)) {
    const errorBody: ApiErrorResponse = { error: { code: 'INVALID_BODY', message: 'Missing or malformed collection result.' } }
    return Response.json(errorBody, { status: 400, headers: NO_STORE })
  }

  try {
    const supabase = getServerSupabase()
    const { result } = body
    const reviews = result.reviews

    // Check which review IDs already exist so we can distinguish new vs updated
    const reviewIds = reviews.map((r) => r.reviewId)
    const existingIds = new Set<string>()
    if (reviewIds.length > 0) {
      const { data: existingRows } = await supabase
        .from('reviews')
        .select('review_id')
        .in('review_id', reviewIds)
      if (existingRows) {
        for (const row of existingRows) {
          existingIds.add(row.review_id as string)
        }
      }
    }

    const newReviewIds: string[] = []
    const updatedReviewIds: string[] = []

    // Upsert reviews in batches
    const BATCH_SIZE = 100
    for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
      const batch = reviews.slice(i, i + BATCH_SIZE)
      const rows = batch.map((review) => {
        const row = reviewToRow(review)
        if (existingIds.has(review.reviewId)) {
          updatedReviewIds.push(review.reviewId)
        } else {
          newReviewIds.push(review.reviewId)
        }
        return row
      })
      const { error: upsertError } = await supabase
        .from('reviews')
        .upsert(rows, { onConflict: 'review_id' })
      if (upsertError) {
        console.error('[voc] upsert batch failed:', upsertError.message)
        const errorBody: ApiErrorResponse = {
          error: { code: 'DB_WRITE_ERROR', message: `Failed to save reviews: ${upsertError.message}` },
        }
        return Response.json(errorBody, { status: 500, headers: NO_STORE })
      }
    }

    // Record the collection run
    const runRow = {
      fetched_at: result.fetchedAt,
      package_id: result.packageId,
      storefront_country: result.storefront.country,
      storefront_language: result.storefront.language,
      target_unique_count: result.targetUniqueCount,
      retained_count: result.retainedCount,
      fetched_count: result.fetchedCount,
      invalid_count: result.invalidCount,
      duplicate_count: result.duplicateCount,
      complete: result.complete,
      target_reached: result.targetReached,
      duration_ms: result.durationMs,
      warnings: JSON.stringify(result.warnings),
      quality: JSON.stringify(result.quality),
      new_review_ids: JSON.stringify(newReviewIds),
      updated_review_ids: JSON.stringify(updatedReviewIds),
    }

    const { data: runData, error: runError } = await supabase
      .from('collection_runs')
      .insert(runRow)
      .select('id')
      .single()

    if (runError) {
      console.error('[voc] collection_runs insert failed:', runError.message)
      const errorBody: ApiErrorResponse = {
        error: { code: 'DB_WRITE_ERROR', message: `Failed to save collection run: ${runError.message}` },
      }
      return Response.json(errorBody, { status: 500, headers: NO_STORE })
    }

    return Response.json(
      {
        saved: true,
        runId: runData?.id,
        newCount: newReviewIds.length,
        updatedCount: updatedReviewIds.length,
        totalSaved: reviews.length,
      },
      { status: 200, headers: NO_STORE },
    )
  } catch (error) {
    console.error('[voc] save route error:', error)
    const errorBody: ApiErrorResponse = {
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save reviews to database.' },
    }
    return Response.json(errorBody, { status: 500, headers: NO_STORE })
  }
}
