'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AnalysisResponse, AnalysisState, BenchmarkDataset, EvaluationResult, HumanLabel, Review } from '@/lib/voc/types'
import { createEmptyBenchmark, evaluate, importBenchmark } from '@/lib/voc/evaluation'

interface AnalysisContextValue {
  state: AnalysisState
  selectedPainPointId: string | null
  runAnalysis: (reviews: Review[]) => Promise<void>
  selectPainPoint: (id: string | null) => void
  reset: () => void
  // Evaluation
  benchmark: BenchmarkDataset
  evaluationResult: EvaluationResult | null
  lastReviewedReviews: Review[] | null
  addHumanLabel: (label: HumanLabel) => void
  removeHumanLabel: (reviewId: string) => void
  importBenchmarkJson: (json: string) => boolean
  exportBenchmarkJson: () => string
  runEvaluation: (reviews: Review[]) => void
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const [selectedPainPointId, setSelectedPainPointId] = useState<string | null>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkDataset>(createEmptyBenchmark())
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null)
  const [lastReviewedReviews, setLastReviewedReviews] = useState<Review[] | null>(null)

  const runAnalysis = useCallback(async (reviews: Review[]) => {
    setState({ status: 'loading' })
    setSelectedPainPointId(null)
    setEvaluationResult(null)

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
      if (!data || !Array.isArray(data.painPoints) || !Array.isArray(data.recommendations) || !Array.isArray(data.classifications)) {
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
    setEvaluationResult(null)
  }, [])

  const addHumanLabel = useCallback((label: HumanLabel) => {
    setBenchmark((prev) => {
      const existing = prev.labels.filter((l) => l.reviewId !== label.reviewId)
      const labels = [...existing, label]
      return {
        ...prev,
        labels,
        updatedAt: new Date().toISOString(),
        reviewedCount: labels.length,
      }
    })
  }, [])

  const removeHumanLabel = useCallback((reviewId: string) => {
    setBenchmark((prev) => {
      const labels = prev.labels.filter((l) => l.reviewId !== reviewId)
      return {
        ...prev,
        labels,
        updatedAt: new Date().toISOString(),
        reviewedCount: labels.length,
      }
    })
  }, [])

  const importBenchmarkJson = useCallback((json: string): boolean => {
    const imported = importBenchmark(json)
    if (!imported) return false
    setBenchmark(imported)
    return true
  }, [])

  const exportBenchmarkJson = useCallback((): string => {
    return JSON.stringify(benchmark, null, 2)
  }, [benchmark])

  const runEvaluation = useCallback((reviews: Review[]) => {
    if (state.status !== 'success' || benchmark.labels.length === 0) {
      setEvaluationResult(null)
      return
    }
    setLastReviewedReviews(reviews)
    const result = evaluate(state.result.classifications, benchmark, reviews)
    setEvaluationResult(result)
  }, [state, benchmark])

  const value = useMemo(
    () => ({
      state,
      selectedPainPointId,
      runAnalysis,
      selectPainPoint,
      reset,
      benchmark,
      evaluationResult,
      lastReviewedReviews,
      addHumanLabel,
      removeHumanLabel,
      importBenchmarkJson,
      exportBenchmarkJson,
      runEvaluation,
    }),
    [state, selectedPainPointId, runAnalysis, selectPainPoint, reset, benchmark, evaluationResult, lastReviewedReviews, addHumanLabel, removeHumanLabel, importBenchmarkJson, exportBenchmarkJson, runEvaluation],
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider')
  return ctx
}
