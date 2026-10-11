'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AnalysisResponse, AnalysisState, Review } from '@/lib/voc/types'

interface AnalysisContextValue {
  state: AnalysisState
  selectedPainPointId: string | null
  runAnalysis: (reviews: Review[]) => Promise<void>
  selectPainPoint: (id: string | null) => void
  reset: () => void
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const [selectedPainPointId, setSelectedPainPointId] = useState<string | null>(null)

  const runAnalysis = useCallback(async (reviews: Review[]) => {
    setState({ status: 'loading' })
    setSelectedPainPointId(null)

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
        setState({
          status: 'error',
          code: body?.error?.code ?? `HTTP_${res.status}`,
          message: body?.error?.message ?? `The server responded with HTTP ${res.status}.`,
        })
        return
      }

      const data = (await res.json()) as AnalysisResponse
      if (!data || !Array.isArray(data.painPoints) || !Array.isArray(data.recommendations)) {
        setState({
          status: 'error',
          code: 'MALFORMED_RESPONSE',
          message: 'The analysis response was malformed.',
        })
        return
      }

      setState({ status: 'success', result: data })
    } catch {
      setState({
        status: 'error',
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server to run analysis.',
      })
    }
  }, [])

  const selectPainPoint = useCallback((id: string | null) => {
    setSelectedPainPointId(id)
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle' })
    setSelectedPainPointId(null)
  }, [])

  const value = useMemo(
    () => ({ state, selectedPainPointId, runAnalysis, selectPainPoint, reset }),
    [state, selectedPainPointId, runAnalysis, selectPainPoint, reset],
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider')
  return ctx
}
