import { getServerSupabase } from '@/lib/supabase/server'
import { rowToReview, type ReviewRow, type CollectionRunRow } from '@/lib/supabase/mappers'
import type { FetchReviewsSuccess, Review } from '@/lib/voc/types'
import { PLAY_STORE_PACKAGE_ID, REVIEW_FETCH, SAMPLING_NOTE, SCRAPER } from '@/lib/voc/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    const supabase = getServerSupabase()

    // Get the latest collection run
    const { data: runRow, error: runError } = await supabase
      .from('collection_runs')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runError) {
      return Response.json(
        { error: { code: 'DB_READ_ERROR', message: runError.message } },
        { status: 500, headers: NO_STORE },
      )
    }

    if (!runRow) {
      return Response.json(
        { error: { code: 'NO_SAVED_DATA', message: 'No saved reviews found. Fetch reviews first.' } },
        { status: 404, headers: NO_STORE },
      )
    }

    const run = runRow as unknown as CollectionRunRow

    // Get all saved reviews ordered by posted_at descending
    const { data: reviewRows, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .order('posted_at', { ascending: false })

    if (reviewsError) {
      return Response.json(
        { error: { code: 'DB_READ_ERROR', message: reviewsError.message } },
        { status: 500, headers: NO_STORE },
      )
    }

    const reviews: Review[] = (reviewRows as unknown as ReviewRow[]).map(rowToReview)

    // Reconstruct a FetchReviewsSuccess-compatible payload from stored data
    const result: FetchReviewsSuccess = {
      packageId: run.package_id,
      storefront: {
        country: run.storefront_country,
        language: run.storefront_language,
      },
      method: {
        source: 'google_play',
        scraper: `${SCRAPER.name}@${SCRAPER.version}`,
        pagination: 'server_side_token',
        passes: [
          { sort: 'newest', order: 1 },
          { sort: 'helpfulness', order: 2 },
        ],
        pageSize: REVIEW_FETCH.pageSize,
      },
      samplingNote: SAMPLING_NOTE,
      targetUniqueCount: run.target_unique_count,
      complete: run.complete,
      targetReached: run.target_reached,
      requestCount: 0,
      requestedCount: 0,
      fetchedCount: run.fetched_count,
      invalidCount: run.invalid_count,
      duplicateCount: run.duplicate_count,
      overflowCount: 0,
      retainedCount: reviews.length,
      passes: [],
      quality: run.quality,
      warnings: run.warnings,
      fetchedAt: run.fetched_at,
      durationMs: run.duration_ms,
      reviews,
    }

    return Response.json(
      {
        result,
        newReviewIds: run.new_review_ids ?? [],
        updatedReviewIds: run.updated_review_ids ?? [],
        loadedFromStorage: true,
      },
      { status: 200, headers: NO_STORE },
    )
  } catch (error) {
    console.error('[voc] load route error:', error)
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load saved reviews.' } },
      { status: 500, headers: NO_STORE },
    )
  }
}
