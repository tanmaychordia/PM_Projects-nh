'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ApiErrorResponse, FetchReviewsSuccess } from '@/lib/voc/types'

export type FetchState =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: string }
  | { status: 'success'; result: FetchReviewsSuccess }
  | { status: 'error'; code: string; message: string; at: string }

interface ReviewCollectionContextValue {
  state: FetchState
  fetchReviews: () => Promise<void>
}

const ReviewCollectionContext = createContext<ReviewCollectionContextValue | null>(null)

function isFetchReviewsSuccess(body: unknown): body is FetchReviewsSuccess {
  if (!body || typeof body !== 'object') return false
  const b = body as Partial<FetchReviewsSuccess>
  return typeof b.fetchedCount === 'number' && typeof b.retainedCount === 'number' && Array.isArray(b.reviews)
}

export function ReviewCollectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FetchState>({ status: 'idle' })

  const fetchReviews = useCallback(async () => {
    const startedAt = new Date().toISOString()
    setState({ status: 'loading', startedAt })
    try {
      const res = await fetch('/api/reviews/fetch', { method: 'POST', cache: 'no-store' })
      const body: unknown = await res.json().catch(() => null)

      if (res.ok && isFetchReviewsSuccess(body)) {
        setState({ status: 'success', result: body })
        return
      }

      const error = (body as ApiErrorResponse | null)?.error
      setState({
        status: 'error',
        code: error?.code ?? `HTTP_${res.status}`,
        message: error?.message ?? `The server responded with HTTP ${res.status}. No reviews were fetched.`,
        at: new Date().toISOString(),
      })
    } catch {
      setState({
        status: 'error',
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection and try again. No reviews were fetched.',
        at: new Date().toISOString(),
      })
    }
  }, [])

  const value = useMemo(() => ({ state, fetchReviews }), [state, fetchReviews])
  return <ReviewCollectionContext.Provider value={value}>{children}</ReviewCollectionContext.Provider>
}

export function useReviewCollection() {
  const ctx = useContext(ReviewCollectionContext)
  if (!ctx) throw new Error('useReviewCollection must be used within ReviewCollectionProvider')
  return ctx
}
