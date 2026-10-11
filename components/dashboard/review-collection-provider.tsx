'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ApiErrorResponse, CollectionProgress, CollectionStreamEvent, FetchReviewsSuccess } from '@/lib/voc/types'

export type FetchState =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: string; progress: CollectionProgress | null }
  | { status: 'success'; result: FetchReviewsSuccess; source: 'fetch' | 'storage'; newReviewIds?: string[]; updatedReviewIds?: string[] }
  | { status: 'error'; code: string; message: string; at: string }

interface ReviewCollectionContextValue {
  state: FetchState
  fetchReviews: () => Promise<void>
  loadSavedReviews: () => Promise<void>
}

const ReviewCollectionContext = createContext<ReviewCollectionContextValue | null>(null)

function isFetchReviewsSuccess(body: unknown): body is FetchReviewsSuccess {
  if (!body || typeof body !== 'object') return false
  const b = body as Partial<FetchReviewsSuccess>
  return (
    typeof b.fetchedCount === 'number' &&
    typeof b.retainedCount === 'number' &&
    Array.isArray(b.reviews) &&
    Array.isArray(b.passes) &&
    typeof b.quality === 'object'
  )
}

function parseEvent(line: string): CollectionStreamEvent | null {
  try {
    const event = JSON.parse(line) as CollectionStreamEvent
    return event && typeof event === 'object' && 'type' in event ? event : null
  } catch {
    return null
  }
}

interface SaveResponse {
  saved: boolean
  runId?: string
  newCount: number
  updatedCount: number
  totalSaved: number
}

interface LoadResponse {
  result: FetchReviewsSuccess
  newReviewIds: string[]
  updatedReviewIds: string[]
  loadedFromStorage: boolean
}

export function ReviewCollectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FetchState>({ status: 'idle' })
  const inFlight = useRef(false)

  const fail = useCallback((code: string, message: string) => {
    setState({ status: 'error', code, message, at: new Date().toISOString() })
  }, [])

  const loadSavedReviews = useCallback(async () => {
    setState({ status: 'loading', startedAt: new Date().toISOString(), progress: null })

    try {
      const res = await fetch('/api/reviews/load', { cache: 'no-store' })

      if (res.status === 404) {
        setState({ status: 'idle' })
        return
      }

      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null)
        const error = (body as ApiErrorResponse | null)?.error
        fail(
          error?.code ?? `HTTP_${res.status}`,
          error?.message ?? `The server responded with HTTP ${res.status}.`,
        )
        return
      }

      const data = (await res.json()) as LoadResponse
      if (data.result && isFetchReviewsSuccess(data.result)) {
        setState({
          status: 'success',
          result: data.result,
          source: 'storage',
          newReviewIds: data.newReviewIds,
          updatedReviewIds: data.updatedReviewIds,
        })
      } else {
        fail('LOAD_FAILED', 'Saved data was malformed. Fetch reviews again.')
      }
    } catch {
      fail('NETWORK_ERROR', 'Could not reach the server to load saved reviews.')
    }
  }, [fail])

  const fetchReviews = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setState({ status: 'loading', startedAt: new Date().toISOString(), progress: null })

    try {
      const res = await fetch('/api/reviews/fetch', { method: 'POST', cache: 'no-store' })

      if (!res.ok || !res.headers.get('content-type')?.includes('ndjson') || !res.body) {
        const body: unknown = await res.json().catch(() => null)
        const error = (body as ApiErrorResponse | null)?.error
        fail(
          error?.code ?? `HTTP_${res.status}`,
          error?.message ?? `The server responded with HTTP ${res.status}. No reviews were retained.`,
        )
        return
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      let terminal: CollectionStreamEvent | null = null

      while (!terminal) {
        const { value, done } = await reader.read()
        if (value) buffer += value
        const lines = buffer.split('\n')
        buffer = done ? '' : (lines.pop() ?? '')
        for (const line of done ? lines : lines) {
          if (!line.trim()) continue
          const event = parseEvent(line)
          if (!event) continue
          if (event.type === 'progress') {
            setState((prev) => (prev.status === 'loading' ? { ...prev, progress: event.progress } : prev))
          } else {
            terminal = event
            break
          }
        }
        if (done) break
      }

      if (terminal?.type === 'result' && isFetchReviewsSuccess(terminal.result)) {
        setState({ status: 'success', result: terminal.result, source: 'fetch' })

        // Persist to database — fire and forget, but log failures
        try {
          const saveRes = await fetch('/api/reviews/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ result: terminal.result }),
            cache: 'no-store',
          })
          if (!saveRes.ok) {
            const saveBody = (await saveRes.json().catch(() => null)) as ApiErrorResponse | null
            console.error('[voc] save failed:', saveBody?.error?.code, saveBody?.error?.message)
          } else {
            const saveData = (await saveRes.json()) as SaveResponse
            console.log(`[voc] saved ${saveData.totalSaved} reviews (${saveData.newCount} new, ${saveData.updatedCount} updated)`)
          }
        } catch (saveErr) {
          console.error('[voc] save request failed:', saveErr)
        }
      } else if (terminal?.type === 'error') {
        fail(terminal.error.code, terminal.error.message)
      } else {
        fail('STREAM_INCOMPLETE', 'The connection closed before collection finished. No reviews were retained.')
      }
    } catch {
      fail('NETWORK_ERROR', 'Could not reach the server or the connection dropped. No reviews were retained.')
    } finally {
      inFlight.current = false
    }
  }, [fail])

  // Load saved reviews on mount so data survives page refresh
  useEffect(() => {
    loadSavedReviews()
  }, [loadSavedReviews])

  const value = useMemo(() => ({ state, fetchReviews, loadSavedReviews }), [state, fetchReviews, loadSavedReviews])
  return <ReviewCollectionContext.Provider value={value}>{children}</ReviewCollectionContext.Provider>
}

export function useReviewCollection() {
  const ctx = useContext(ReviewCollectionContext)
  if (!ctx) throw new Error('useReviewCollection must be used within ReviewCollectionProvider')
  return ctx
}
