'use client'

import { Download, FileJson, FileSpreadsheet, Loader2, Package } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AiProposal, AuditPackage, ProposalValidationResult } from '@/lib/voc/types'
import { useAnalysis } from './analysis-provider'
import { useReviewCollection } from './review-collection-provider'

type AuditPhase = 'idle' | 'sampling' | 'proposals' | 'packaging' | 'done' | 'error'

export function AuditPanel() {
  const { state: analysisState } = useAnalysis()
  const { state: collectionState } = useReviewCollection()
  const [phase, setPhase] = useState<AuditPhase>('idle')
  const [auditPackage, setAuditPackage] = useState<AuditPackage | null>(null)
  const [sampleSize, setSampleSize] = useState<40 | 50>(40)
  const [error, setError] = useState<string | null>(null)
  const [hasAiProvider, setHasAiProvider] = useState<boolean | null>(null)

  const reviews = collectionState.status === 'success' ? collectionState.result.reviews : []
  const classifications = analysisState.status === 'success' ? analysisState.result.classifications : []
  const canExport = reviews.length > 0 && classifications.length > 0

  async function handleGenerateAudit() {
    if (!canExport) return
    setError(null)
    setPhase('sampling')

    try {
      const seed = Date.now()
      const { buildAuditPackage, auditPackageToJson } = await import('@/lib/voc/audit-package')

      // Try AI proposals
      let proposals: AiProposal[] = []
      let validations: ProposalValidationResult[] = []
      let modelId: string | null = null

      setPhase('proposals')
      try {
        // Get sampled reviews to send to AI
        const { buildAuditSample, getSampledReviewIds } = await import('@/lib/voc/audit-sampler')
        const sample = buildAuditSample(reviews, classifications, sampleSize, seed)
        const sampledIds = new Set(getSampledReviewIds(sample))
        const sampledReviews = reviews.filter((r) => sampledIds.has(r.reviewId))

        const res = await fetch('/api/audit/ai-proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviews: sampledReviews }),
          cache: 'no-store',
        })

        if (res.ok) {
          const data = (await res.json()) as { proposals: AiProposal[]; validations: ProposalValidationResult[]; modelId: string }
          proposals = data.proposals
          validations = data.validations
          modelId = data.modelId
          setHasAiProvider(true)
        } else if (res.status === 503) {
          setHasAiProvider(false)
        } else {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
        }
      } catch {
        setHasAiProvider(false)
      }

      setPhase('packaging')
      const result = buildAuditPackage(reviews, classifications, sampleSize, seed, proposals, validations, modelId)
      setAuditPackage(result.package)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during audit generation.')
      setPhase('error')
    }
  }

  function handleDownloadJson() {
    if (!auditPackage) return
    const json = JSON.stringify(auditPackage, null, 2)
    downloadFile(json, 'snabbit-voc-audit-package.json', 'application/json')
  }

  async function handleDownloadCsv(type: 'allReviews' | 'auditSample' | 'aiProposals' | 'manualTemplate') {
    if (!auditPackage) return
    const {
      exportAllReviewsCsv,
      exportAuditSampleCsv,
      exportAiProposalsCsv,
      exportManualVerificationTemplateCsv,
    } = await import('@/lib/voc/audit-package')

    let csv = ''
    let filename = ''
    if (type === 'allReviews') {
      csv = exportAllReviewsCsv(reviews)
      filename = 'snabbit-voc-all-reviews.csv'
    } else if (type === 'auditSample') {
      csv = exportAuditSampleCsv(auditPackage.auditSample, auditPackage.baselinePredictions)
      filename = 'snabbit-voc-audit-sample.csv'
    } else if (type === 'aiProposals') {
      csv = exportAiProposalsCsv(auditPackage.aiProposals)
      filename = 'snabbit-voc-ai-proposals.csv'
    } else if (type === 'manualTemplate') {
      csv = exportManualVerificationTemplateCsv(auditPackage.auditSample)
      filename = 'snabbit-voc-manual-verification-template.csv'
    }
    downloadFile(csv, filename, 'text/csv')
  }

  const isWorking = phase === 'sampling' || phase === 'proposals' || phase === 'packaging'

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Taxonomy audit export</CardTitle>
        <CardDescription className="text-xs">
          Generate a downloadable audit package for external review
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 py-4">
        {!canExport && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Collect reviews and run analysis first to enable the audit export.
          </p>
        )}

        {canExport && phase === 'idle' && (
          <>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Exports all {reviews.length} source reviews, the current classifier predictions, a
              diverse audit sample of {sampleSize} reviews, taxonomy definitions, and optionally
              independent AI-proposed labels into a single downloadable JSON package.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setSampleSize((s) => (s === 40 ? 50 : 40))}
                variant="outline"
                size="sm"
              >
                Sample size: {sampleSize}
              </Button>
              <Button onClick={handleGenerateAudit} size="sm">
                <Package className="size-3" aria-hidden="true" />
                Generate audit package
              </Button>
            </div>
          </>
        )}

        {isWorking && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {phase === 'sampling' && 'Selecting audit sample…'}
              {phase === 'proposals' && 'Generating AI proposals (if configured)…'}
              {phase === 'packaging' && 'Building audit package…'}
            </p>
          </div>
        )}

        {phase === 'error' && error && (
          <Alert variant="destructive">
            <AlertTitle className="text-xs font-semibold">Audit generation failed</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {phase === 'done' && auditPackage && (
          <>
            <div className="flex items-center gap-3 rounded-md border bg-surface/60 px-3 py-2.5">
              <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-1 flex-col gap-0.5 text-xs">
                <span className="font-medium text-foreground">Audit package ready</span>
                <span className="text-muted-foreground">
                  {auditPackage.manifest.reviewCount} reviews · {auditPackage.manifest.sampledCount} sampled ·
                  {' '}{auditPackage.manifest.proposalCount} AI proposals
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'font-normal text-[11px]',
                  auditPackage.manifest.completionStatus === 'complete' && 'text-success',
                  auditPackage.manifest.completionStatus === 'partial' && 'text-warning-foreground',
                  auditPackage.manifest.completionStatus === 'no_ai_provider' && 'text-muted-foreground',
                )}
              >
                {auditPackage.manifest.completionStatus === 'complete' && 'Complete'}
                {auditPackage.manifest.completionStatus === 'partial' && 'Partial'}
                {auditPackage.manifest.completionStatus === 'no_ai_provider' && 'No AI'}
              </Badge>
            </div>

            {hasAiProvider === false && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                No AI provider key is configured. The package includes source data, baseline
                predictions, and the audit sample without AI proposals. All other export features
                remain functional.
              </p>
            )}

            {auditPackage.unresolvedItems.length > 0 && (
              <Alert>
                <AlertTitle className="text-xs font-semibold">
                  {auditPackage.unresolvedItems.length} unresolved item{auditPackage.unresolvedItems.length === 1 ? '' : 's'}
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Some proposals failed validation or were incomplete. See the unresolvedItems
                  section in the JSON export for details.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Button onClick={handleDownloadJson} size="sm" className="w-full">
                <FileJson className="size-3" aria-hidden="true" />
                Download JSON audit package
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleDownloadCsv('allReviews')} variant="outline" size="sm">
                  <FileSpreadsheet className="size-3" aria-hidden="true" />
                  All reviews CSV
                </Button>
                <Button onClick={() => handleDownloadCsv('auditSample')} variant="outline" size="sm">
                  <FileSpreadsheet className="size-3" aria-hidden="true" />
                  Audit sample CSV
                </Button>
                <Button onClick={() => handleDownloadCsv('aiProposals')} variant="outline" size="sm" disabled={auditPackage.aiProposals.length === 0}>
                  <FileSpreadsheet className="size-3" aria-hidden="true" />
                  AI proposals CSV
                </Button>
                <Button onClick={() => handleDownloadCsv('manualTemplate')} variant="outline" size="sm">
                  <FileSpreadsheet className="size-3" aria-hidden="true" />
                  Manual template CSV
                </Button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              The JSON package is self-contained — a reviewer does not need database access or API
              credentials. Human-verified labels are initialized as unverified. AI proposals are
              never promoted to gold-standard labels automatically.
            </p>

            <Button
              onClick={() => { setPhase('idle'); setAuditPackage(null) }}
              variant="ghost"
              size="sm"
            >
              Generate again
            </Button>
          </>
        )}
      </CardContent>
    </Card>
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
