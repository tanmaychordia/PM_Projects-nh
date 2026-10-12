import { buildAuditPackage, validateProposal, exportAllReviewsCsv, exportAuditSampleCsv, exportAiProposalsCsv, exportManualVerificationTemplateCsv } from '../lib/voc/audit-package'
import { buildAuditSample, getSampledReviewIds } from '../lib/voc/audit-sampler'
import { buildTaxonomyExport, TAXONOMY_VERSION } from '../lib/voc/taxonomy-export'
import { classifyReview } from '../lib/voc/analysis-engine'
import type { AiProposal, Review } from '../lib/voc/types'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) { passed++ } else { failed++; console.error(`FAIL: ${message}`) }
}

function makeReview(partial: Partial<Review>): Review {
  return {
    reviewId: partial.reviewId ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    source: 'google_play',
    rating: partial.rating ?? 1,
    title: partial.title ?? null,
    text: partial.text ?? null,
    postedAt: partial.postedAt ?? new Date().toISOString(),
    appVersion: partial.appVersion ?? null,
    thumbsUpCount: partial.thumbsUpCount ?? null,
    developerResponse: partial.developerResponse ?? null,
    collectedVia: partial.collectedVia ?? 'newest',
  }
}

// Test 1: All reviews are exported without silent truncation
{
  const reviews = Array.from({ length: 50 }, (_, i) =>
    makeReview({ reviewId: `r${i}`, rating: 1, text: `Review ${i} crash late refund` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 12345)
  assert(pkg.allReviews.length === 50, `Test 1: all 50 reviews exported (got ${pkg.allReviews.length})`)
  for (let i = 0; i < 50; i++) {
    assert(pkg.allReviews[i].reviewId === `r${i}`, `Test 1: review ${i} ID preserved`)
    assert(pkg.allReviews[i].text === `Review ${i} crash late refund`, `Test 1: review ${i} text preserved`)
  }
}

// Test 2: Stable IDs and exact source text are preserved
{
  const reviews = [
    makeReview({ reviewId: 'stable-1', rating: 2, title: 'My anklet is missing', text: 'The cleaning staff stole my silver anklet and the app crashes too.' }),
    makeReview({ reviewId: 'stable-2', rating: 5, title: 'Great', text: 'Excellent service and good app.' }),
  ]
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 999)
  const r1 = pkg.allReviews.find((r) => r.reviewId === 'stable-1')
  const r2 = pkg.allReviews.find((r) => r.reviewId === 'stable-2')
  assert(r1?.title === 'My anklet is missing', 'Test 2: title preserved exactly')
  assert(r1?.text === 'The cleaning staff stole my silver anklet and the app crashes too.', 'Test 2: text preserved exactly')
  assert(r2?.rating === 5, 'Test 2: rating preserved')
}

// Test 3: Audit sampling is reproducible and deduplicated
{
  const reviews = Array.from({ length: 100 }, (_, i) =>
    makeReview({ reviewId: `s${i}`, rating: 1, text: `Review ${i} crash late refund booking slot` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  const sample1 = buildAuditSample(reviews, classifications, 40, 42)
  const sample2 = buildAuditSample(reviews, classifications, 40, 42)
  const ids1 = getSampledReviewIds(sample1)
  const ids2 = getSampledReviewIds(sample2)
  assert(ids1.length === ids2.length, 'Test 3: same seed → same count')
  assert(ids1.every((id, i) => id === ids2[i]), 'Test 3: same seed → same order')
  const unique = new Set(ids1)
  assert(unique.size === ids1.length, 'Test 3: no duplicates in sample')
  assert(ids1.length <= 40, `Test 3: sample ≤ 40 (got ${ids1.length})`)
}

// Test 4: Every sampled review has a recorded selection reason
{
  const reviews = Array.from({ length: 60 }, (_, i) =>
    makeReview({ reviewId: `sr${i}`, rating: 1, text: `Review ${i} crash late refund` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 77)
  for (const item of pkg.auditSample.reviewIds) {
    assert(item.selectionReasons.length > 0, `Test 4: review ${item.reviewId} has selection reasons`)
  }
}

// Test 5: All taxonomy definitions and versions are included
{
  const reviews = [makeReview({ reviewId: 't5', rating: 1, text: 'App crashes' })]
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 1)
  assert(pkg.taxonomy.version === TAXONOMY_VERSION, 'Test 5: taxonomy version included')
  assert(pkg.taxonomy.parents.length === 5, `Test 5: 5 parent categories (got ${pkg.taxonomy.parents.length})`)
  assert(pkg.taxonomy.children.length === 10, `Test 5: 10 child categories (got ${pkg.taxonomy.children.length})`)
  assert(pkg.taxonomy.mappingFromExistingLabels.length === 10, 'Test 5: mapping from existing labels included')
  for (const child of pkg.taxonomy.children) {
    assert(child.inclusionCriteria.length > 0, `Test 5: child ${child.id} has inclusion criteria`)
    assert(child.exclusionCriteria.length > 0, `Test 5: child ${child.id} has exclusion criteria`)
    assert(child.parent.length > 0, `Test 5: child ${child.id} has parent`)
  }
}

// Test 6: Invalid labels and fabricated evidence excerpts are rejected
{
  const review = makeReview({ reviewId: 't6', rating: 1, text: 'The app keeps crashing every time I open it.' })
  const badProposal: AiProposal = {
    reviewId: 't6',
    sourceTextHash: '',
    parentLabels: ['fake_parent' as never],
    childLabels: ['fake_child' as never],
    primaryIssue: null,
    sentiment: 'negative',
    evidenceExcerpts: [{ label: 'fake_child' as never, excerpt: 'This text does not exist in the review.' }],
    rationale: 'test',
    uncertain: false,
    uncertainReason: null,
    hasMultipleIssues: false,
    taxonomyVersion: TAXONOMY_VERSION,
    modelId: 'test',
    promptVersion: 'audit-v1',
    generatedAt: new Date().toISOString(),
  }
  const result = validateProposal(badProposal, review)
  assert(!result.valid, 'Test 6: invalid proposal should fail validation')
  assert(result.rejectedLabels.includes('fake_child'), 'Test 6: fake child label rejected')
  assert(result.rejectedExcerpts.length > 0, 'Test 6: fabricated excerpt rejected')
}

// Test 7: Failed or incomplete model responses are recorded
{
  const reviews = Array.from({ length: 5 }, (_, i) =>
    makeReview({ reviewId: `f${i}`, rating: 1, text: `Review ${i} crash` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  // Simulate a failed proposal for one review
  const failedProposal: AiProposal = {
    reviewId: 'f0',
    sourceTextHash: '',
    parentLabels: [],
    childLabels: [],
    primaryIssue: null,
    sentiment: 'unclear',
    evidenceExcerpts: [],
    rationale: 'Proposal failed.',
    uncertain: true,
    uncertainReason: 'Provider error',
    hasMultipleIssues: false,
    taxonomyVersion: TAXONOMY_VERSION,
    modelId: 'test-model',
    promptVersion: 'audit-v1',
    generatedAt: new Date().toISOString(),
  }
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 42, [failedProposal], [], 'test-model')
  assert(pkg.manifest.completionStatus === 'partial', `Test 7: partial status (got ${pkg.manifest.completionStatus})`)
  assert(pkg.unresolvedItems.length > 0, 'Test 7: unresolved items recorded')
}

// Test 8: Existing predictions are never overwritten
{
  const reviews = [
    makeReview({ reviewId: 't8', rating: 1, text: 'The app crashes and my refund is missing.' }),
  ]
  const classifications = reviews.map((r) => classifyReview(r))
  const originalPrimary = classifications[0].primaryCategory
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 1)
  const baseline = pkg.baselinePredictions.find((p) => p.reviewId === 't8')
  assert(baseline?.primaryCategory === originalPrimary, 'Test 8: baseline prediction not overwritten')
}

// Test 9: Unverified proposals never become gold labels
{
  const reviews = Array.from({ length: 5 }, (_, i) =>
    makeReview({ reviewId: `g${i}`, rating: 1, text: `Review ${i} crash` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  const proposals: AiProposal[] = reviews.map((r) => ({
    reviewId: r.reviewId,
    sourceTextHash: '',
    parentLabels: ['app_digital_experience'],
    childLabels: ['app_functionality'],
    primaryIssue: 'crash',
    sentiment: 'negative' as const,
    evidenceExcerpts: [],
    rationale: 'mentions crash',
    uncertain: false,
    uncertainReason: null,
    hasMultipleIssues: false,
    taxonomyVersion: TAXONOMY_VERSION,
    modelId: 'test',
    promptVersion: 'audit-v1',
    generatedAt: new Date().toISOString(),
  }))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 42, proposals, [], 'test')
  for (const label of pkg.humanVerifiedLabels) {
    assert(label.status === 'unverified', `Test 9: review ${label.reviewId} is unverified`)
  }
}

// Test 10: Exported JSON can be parsed and joined back to source reviews
{
  const reviews = Array.from({ length: 20 }, (_, i) =>
    makeReview({ reviewId: `j${i}`, rating: 1, text: `Review ${i} crash late` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 42)
  const json = JSON.stringify(pkg)
  const parsed = JSON.parse(json) as typeof pkg
  // Join back: every allReviews entry should have a matching source review
  const reviewMap = new Map(reviews.map((r) => [r.reviewId, r]))
  for (const exportedReview of parsed.allReviews) {
    const source = reviewMap.get(exportedReview.reviewId)
    assert(source !== undefined, `Test 10: review ${exportedReview.reviewId} joins back to source`)
    assert(exportedReview.text === source!.text, `Test 10: text matches for ${exportedReview.reviewId}`)
  }
  // Verify manifest is consistent
  assert(parsed.manifest.reviewCount === 20, `Test 10: manifest reviewCount (got ${parsed.manifest.reviewCount})`)
  assert(parsed.allReviews.length === 20, 'Test 10: allReviews length matches')
}

// Test 11: CSV exports are well-formed
{
  const reviews = [
    makeReview({ reviewId: 'csv1', rating: 1, title: 'Crash', text: 'App crashes' }),
    makeReview({ reviewId: 'csv2', rating: 5, title: 'Good', text: 'Great service' }),
  ]
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg, sample } = buildAuditPackage(reviews, classifications, 40, 42)

  const allCsv = exportAllReviewsCsv(reviews)
  assert(allCsv.includes('csv1') && allCsv.includes('csv2'), 'Test 11: all reviews CSV has both IDs')

  const sampleCsv = exportAuditSampleCsv(sample, classifications)
  assert(sampleCsv.includes('reviewId'), 'Test 11: audit sample CSV has header')

  const proposalCsv = exportAiProposalsCsv(pkg.aiProposals)
  assert(proposalCsv.includes('reviewId'), 'Test 11: AI proposals CSV has header')

  const templateCsv = exportManualVerificationTemplateCsv(sample)
  assert(templateCsv.includes('unverified'), 'Test 11: manual template has unverified status')
}

// Test 12: Existing classifier behaviour unchanged (sample from original tests)
{
  const r = makeReview({ reviewId: 't12', rating: 1, title: 'Missing silver anklet', text: 'My silver anklet is missing after the cleaning service.' })
  const c = classifyReview(r)
  assert(c.primaryCategory === 'trust_safety_property', `Test 12: anklet → trust_safety_property (got ${c.primaryCategory})`)
}

// Test 13: No AI provider → completion status is no_ai_provider
{
  const reviews = [makeReview({ reviewId: 't13', rating: 1, text: 'App crashes' })]
  const classifications = reviews.map((r) => classifyReview(r))
  const { package: pkg } = buildAuditPackage(reviews, classifications, 40, 42, [], [], null)
  assert(pkg.manifest.completionStatus === 'no_ai_provider', `Test 13: no AI provider status (got ${pkg.manifest.completionStatus})`)
  assert(pkg.aiProposals.length === 0, 'Test 13: no proposals when no provider')
}

// Test 14: Audit sample composition is disclosed and marked non-representative
{
  const reviews = Array.from({ length: 50 }, (_, i) =>
    makeReview({ reviewId: `c${i}`, rating: 1, text: `Review ${i} crash late refund` }),
  )
  const classifications = reviews.map((r) => classifyReview(r))
  const sample = buildAuditSample(reviews, classifications, 40, 42)
  assert(sample.isRepresentative === false, 'Test 14: sample marked non-representative')
  assert(Object.keys(sample.composition).length > 0, 'Test 14: composition disclosed')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
