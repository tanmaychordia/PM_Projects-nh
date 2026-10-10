'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ApiErrorResponse, CollectionProgress, CollectionStreamEvent, FetchReviewsSuccess } from '@/lib/voc/types'

export type FetchState =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: string; progress: CollectionProgress | null }
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

export function ReviewCollectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FetchState>({ status: 'idle' })
  const inFlight = useRef(false)

  const fail = useCallback((code: string, message: string) => {
    setState({ status: 'error', code, message, at: new Date().toISOString() })
  }, [])

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
        setState({ status: 'success', result: terminal.result })
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

  const value = useMemo(() => ({ state, fetchReviews }), [state, fetchReviews])
  return <ReviewCollectionContext.Provider value={value}>{children}</ReviewCollectionContext.Provider>
}

export function useReviewCollection() {
  const ctx = useContext(ReviewCollectionContext)
  if (!ctx) throw new Error('useReviewCollection must be used within ReviewCollectionProvider')
  return ctx
}
