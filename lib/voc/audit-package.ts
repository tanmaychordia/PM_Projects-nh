import { buildAuditSample, getSampledReviewIds, hashReviewText } from './audit-sampler'
import { buildTaxonomyExport, isValidChildId, isValidParentId, getParentIdForChild, TAXONOMY_VERSION } from './taxonomy-export'
import type {
  AiProposal,
  AuditManifest,
  AuditPackage,
  AuditSample,
  ProposalValidationResult,
  Review,
  ReviewClassification,
  UnresolvedItem,
} from './types'

export function buildAuditPackage(
  reviews: Review[],
  classifications: ReviewClassification[],
  targetSize: number,
  seed: number,
  proposals: AiProposal[] = [],
  proposalValidations: ProposalValidationResult[] = [],
  modelId: string | null = null,
): { package: AuditPackage; sample: AuditSample } {
  const taxonomy = buildTaxonomyExport()
  const sample = buildAuditSample(reviews, classifications, targetSize, seed)
  const sampledIds = getSampledReviewIds(sample)

  // Build allReviews (all source reviews, not just sample)
  const allReviews = reviews.map((r) => ({
    reviewId: r.reviewId,
    rating: r.rating,
    title: r.title,
    text: r.text,
    postedAt: r.postedAt,
    appVersion: r.appVersion,
    source: r.source,
    collectedVia: r.collectedVia,
  }))

  // Build unresolved items
  const unresolvedItems: UnresolvedItem[] = []
  for (const reviewId of sampledIds) {
    const proposal = proposals.find((p) => p.reviewId === reviewId)
    const validation = proposalValidations.find((v) => v.reviewId === reviewId)
    if (!proposal && modelId) {
      unresolvedItems.push({ reviewId, type: 'proposal_failed', detail: 'No proposal was generated for this review.' })
    } else if (proposal && validation && !validation.valid) {
      unresolvedItems.push({ reviewId, type: 'validation_failed', detail: validation.errors.join('; ') })
    }
  }

  const completionStatus: AuditManifest['completionStatus'] =
    modelId === null ? 'no_ai_provider' : unresolvedItems.length === 0 ? 'complete' : 'partial'

  const manifest: AuditManifest = {
    schemaVersion: 1,
    exportTimestamp: new Date().toISOString(),
    reviewCount: reviews.length,
    sampledCount: sampledIds.length,
    taxonomyVersion: TAXONOMY_VERSION,
    samplingMethod: sample.method,
    samplingSeed: seed,
    modelId,
    promptVersion: 'audit-v1',
    completionStatus,
    proposalCount: proposals.length,
    validationErrorCount: proposalValidations.filter((v) => !v.valid).length,
    unresolvedCount: unresolvedItems.length,
  }

  const humanVerifiedLabels = sampledIds.map((reviewId) => ({ reviewId, status: 'unverified' as const }))

  const pkg: AuditPackage = {
    manifest,
    taxonomy,
    allReviews,
    baselinePredictions: classifications,
    auditSample: sample,
    aiProposals: proposals,
    validationResults: proposalValidations,
    unresolvedItems,
    humanVerifiedLabels,
  }

  return { package: pkg, sample }
}

export function auditPackageToJson(pkg: AuditPackage): string {
  return JSON.stringify(pkg, null, 2)
}

export function exportAllReviewsCsv(reviews: Review[]): string {
  const headers = ['reviewId', 'rating', 'title', 'text', 'postedAt', 'appVersion', 'source', 'collectedVia']
  const rows = reviews.map((r) => [
    r.reviewId,
    String(r.rating),
    r.title ?? '',
    (r.text ?? '').replace(/"/g, '""').replace(/\n/g, ' '),
    r.postedAt,
    r.appVersion ?? '',
    r.source,
    r.collectedVia,
  ])
  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

export function exportAuditSampleCsv(
  sample: AuditSample,
  classifications: ReviewClassification[],
): string {
  const headers = ['reviewId', 'selectionReasons', 'baselinePrimaryCategory', 'baselineSecondaryCategories', 'baselineSentiment', 'baselineCertainty', 'baselineDomain']
  const classMap = new Map(classifications.map((c) => [c.reviewId, c]))
  const rows = sample.reviewIds.map((item) => {
    const c = classMap.get(item.reviewId)
    return [
      item.reviewId,
      item.selectionReasons.join(';'),
      c?.primaryCategory ?? '',
      c?.secondaryCategories.join(';') ?? '',
      c?.sentiment ?? '',
      c?.certainty ?? '',
      c?.domain ?? '',
    ]
  })
  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

export function exportAiProposalsCsv(proposals: AiProposal[]): string {
  const headers = ['reviewId', 'sourceTextHash', 'parentLabels', 'childLabels', 'primaryIssue', 'sentiment', 'evidenceExcerpts', 'rationale', 'uncertain', 'uncertainReason', 'hasMultipleIssues', 'taxonomyVersion', 'modelId', 'promptVersion']
  const rows = proposals.map((p) => [
    p.reviewId,
    p.sourceTextHash,
    p.parentLabels.join(';'),
    p.childLabels.join(';'),
    p.primaryIssue ?? '',
    p.sentiment,
    p.evidenceExcerpts.map((e) => `${e.label}:${e.excerpt.replace(/"/g, '""').replace(/\n/g, ' ')}`).join(' | '),
    p.rationale.replace(/"/g, '""').replace(/\n/g, ' '),
    String(p.uncertain),
    p.uncertainReason ?? '',
    String(p.hasMultipleIssues),
    p.taxonomyVersion,
    p.modelId,
    p.promptVersion,
  ])
  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

export function exportManualVerificationTemplateCsv(sample: AuditSample): string {
  const headers = ['reviewId', 'verifiedPrimaryCategory', 'verifiedSecondaryCategories', 'verifiedSentiment', 'evidenceRelevant', 'adjudicationStatus', 'reviewerNotes']
  const rows = sample.reviewIds.map((item) => [
    item.reviewId,
    '',
    '',
    '',
    '',
    'unverified',
    '',
  ])
  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

export function validateProposal(
  proposal: AiProposal,
  review: Review,
): ProposalValidationResult {
  const errors: string[] = []
  const rejectedLabels: string[] = []
  const rejectedExcerpts: string[] = []

  // Validate labels against taxonomy
  for (const label of proposal.childLabels) {
    if (!isValidChildId(label)) {
      rejectedLabels.push(label)
      errors.push(`Unknown child label: ${label}`)
    }
  }
  for (const label of proposal.parentLabels) {
    if (!isValidParentId(label)) {
      rejectedLabels.push(label)
      errors.push(`Unknown parent label: ${label}`)
    }
  }

  // Check child-parent consistency
  for (const childLabel of proposal.childLabels) {
    if (isValidChildId(childLabel)) {
      const expectedParent = getParentIdForChild(childLabel)
      if (!proposal.parentLabels.includes(expectedParent)) {
        errors.push(`Child label ${childLabel} expects parent ${expectedParent} but it is not in parentLabels`)
      }
    }
  }

  // Validate evidence excerpts are exact substrings
  const sources = [review.title, review.text].filter(Boolean) as string[]
  for (const evidence of proposal.evidenceExcerpts) {
    const found = sources.some((src) => src.includes(evidence.excerpt))
    if (!found) {
      rejectedExcerpts.push(evidence.excerpt.slice(0, 50))
      errors.push(`Evidence excerpt for ${evidence.label} not found in review text`)
    }
  }

  // Check reviewId matches
  if (proposal.reviewId !== review.reviewId) {
    errors.push(`Proposal reviewId (${proposal.reviewId}) does not match review (${review.reviewId})`)
  }

  // Check source text hash
  const text = [review.title ?? '', review.text ?? ''].join('\n')
  const expectedHash = hashStringSimple(text)
  if (proposal.sourceTextHash !== expectedHash) {
    errors.push(`Source text hash mismatch: expected ${expectedHash}, got ${proposal.sourceTextHash}`)
  }

  return {
    reviewId: proposal.reviewId,
    valid: errors.length === 0,
    errors,
    rejectedLabels,
    rejectedExcerpts,
  }
}

function hashStringSimple(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}
