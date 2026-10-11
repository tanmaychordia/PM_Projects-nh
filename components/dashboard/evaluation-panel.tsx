'use client'

import { ClipboardCheck, Database, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { exportBenchmarkCsv, exportBenchmark as exportBenchmarkJson } from '@/lib/voc/evaluation'
import type { EvaluationResult } from '@/lib/voc/types'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-provider'
import { useReviewCollection } from './review-collection-provider'

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

export function EvaluationPanel() {
  const { state, benchmark, evaluationResult, runEvaluation, importBenchmarkJson, exportBenchmarkJson } = useAnalysis()
  const { state: collectionState } = useReviewCollection()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const reviews = collectionState.status === 'success' ? collectionState.result.reviews : []
  const canEvaluate = state.status === 'success' && benchmark.labels.length > 0 && reviews.length > 0
  const benchmarkComplete = benchmark.labels.length >= benchmark.targetSize

  function handleExportJson() {
    const json = exportBenchmarkJson()
    downloadFile(json, 'snabbit-voc-benchmark.json', 'application/json')
  }

  function handleExportCsv() {
    const csv = exportBenchmarkCsv(benchmark)
    downloadFile(csv, 'snabbit-voc-benchmark.csv', 'text/csv')
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      const ok = importBenchmarkJson(text)
      if (!ok) {
        setImportError('The file could not be parsed as a valid benchmark dataset.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Evaluation benchmark</CardTitle>
        <CardDescription className="text-xs">
          Compare rule-based predictions against manually labelled reviews
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 py-4">
        {/* Benchmark status */}
        <div className="flex items-center gap-3 rounded-md border bg-surface/60 px-3 py-2.5">
          <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-0.5 text-xs">
            <span className="font-medium text-foreground">
              {benchmark.labels.length} of {benchmark.targetSize} labels
            </span>
            <span className="text-muted-foreground">
              {benchmarkComplete
                ? 'Benchmark target reached. Run evaluation to see metrics.'
                : 'Benchmark is incomplete. Add labels manually to reach the target of 50 reviews.'}
            </span>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-4xl px-2 py-0.5 text-[11px] font-medium',
              benchmarkComplete ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground',
            )}
          >
            {benchmarkComplete ? 'Complete' : 'Incomplete'}
          </span>
        </div>

        {/* Import/Export */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportJson} variant="outline" size="sm" disabled={benchmark.labels.length === 0}>
            <Download className="size-3" aria-hidden="true" />
            Export JSON
          </Button>
          <Button onClick={handleExportCsv} variant="outline" size="sm" disabled={benchmark.labels.length === 0}>
            <Download className="size-3" aria-hidden="true" />
            Export CSV
          </Button>
          <Button onClick={handleImportClick} variant="outline" size="sm">
            <Upload className="size-3" aria-hidden="true" />
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        {importError && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{importError}</AlertDescription>
          </Alert>
        )}

        {/* Run evaluation */}
        {state.status === 'success' && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => runEvaluation(reviews)}
              disabled={!canEvaluate}
              size="sm"
              className="w-full"
            >
              <Database className="size-3" aria-hidden="true" />
              {benchmark.labels.length === 0
                ? 'Add labels to enable evaluation'
                : `Run evaluation (${benchmark.labels.length} labels)`}
            </Button>
            {benchmark.labels.length > 0 && !benchmarkComplete && (
              <p className="text-[11px] text-muted-foreground">
                Evaluation can run with fewer than 50 labels, but metrics will be less reliable.
              </p>
            )}
          </div>
        )}

        {/* Evaluation results */}
        {evaluationResult && <EvaluationResults result={evaluationResult} />}

        {/* No results yet */}
        {state.status === 'success' && !evaluationResult && (
          <Alert>
            <AlertTitle className="text-xs font-semibold">No evaluation run yet</AlertTitle>
            <AlertDescription className="text-xs">
              Run the analysis first, then add human labels and click "Run evaluation" to compare
              predictions against your benchmark. No metrics are shown until labels exist and
              evaluation is run — we do not fabricate evaluation results.
            </AlertDescription>
          </Alert>
        )}

        {/* Warning about findings */}
        {state.status === 'success' && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            Findings from the rule-based analysis are exploratory until validated against human labels.
            Use the evaluation metrics above to assess classification quality before acting on recommendations.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function EvaluationResults({ result }: { result: EvaluationResult }) {
  const columns = [
    { label: 'Category', className: '' },
    { label: 'Labelled', className: 'w-20 text-right' },
    { label: 'Predicted', className: 'w-20 text-right' },
    { label: 'Precision', className: 'w-20 text-right' },
    { label: 'Recall', className: 'w-20 text-right' },
    { label: 'F1', className: 'w-20 text-right' },
  ]

  const categoriesWithSignal = result.perCategory.filter((m) => m.labelled > 0 || m.predicted > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <MetricBox label="Macro precision" value={fmtPct(result.macroPrecision)} />
        <MetricBox label="Macro recall" value={fmtPct(result.macroRecall)} />
        <MetricBox label="Macro F1" value={fmtPct(result.macroF1)} />
        <MetricBox label="Primary accuracy" value={fmtPct(result.primaryAccuracy)} />
        <MetricBox label="Sentiment accuracy" value={fmtPct(result.sentimentAccuracy)} />
        <MetricBox label="Quote integrity" value={fmtPct(result.quoteIntegrityPassRate)} />
      </div>

      {result.evidenceRelevancePassRate !== null && (
        <div className="grid grid-cols-3 gap-2">
          <MetricBox label="Evidence relevance" value={fmtPct(result.evidenceRelevancePassRate)} />
          <MetricBox label="Labelled" value={String(result.labelledCount)} />
          <MetricBox label="Evaluated" value={String(result.evaluatedCount)} />
        </div>
      )}

      {result.evidenceRelevancePassRate === null && (
        <p className="text-[11px] text-muted-foreground">
          Evidence relevance pass rate is not shown because no human relevance labels have been added.
          Add the <code className="font-mono">evidenceRelevant</code> field to your labels to enable this metric.
        </p>
      )}

      {categoriesWithSignal.length > 0 && (
        <Table>
          <caption className="sr-only">Per-category evaluation metrics</caption>
          <TableHeader>
            <TableRow className="bg-surface hover:bg-surface">
              {columns.map((col) => (
                <TableHead
                  key={col.label}
                  className={`h-8 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${col.className}`}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoriesWithSignal.map((m) => (
              <TableRow key={m.categoryId}>
                <TableCell className="px-3 py-2 text-xs">{m.label}</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">{m.labelled}</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">{m.predicted}</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtPct(m.precision)}</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtPct(m.recall)}</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtPct(m.f1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-[11px] text-muted-foreground">
        Evaluated {result.evaluatedCount} of {result.labelledCount} labelled reviews.
        Categories with no labelled examples and no predictions are omitted.
        "—" indicates the metric could not be calculated (zero denominator).
      </p>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-surface/60 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
