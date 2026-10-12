import type { CollectionSort, IntegrationStatus } from './config'

export type { CollectionSort }

export type StarRating = 1 | 2 | 3 | 4 | 5

export interface DeveloperResponse {
  text: string
  respondedAt: string | null
}

/**
 * A single Google Play review, normalized from the collector's output.
 * Fields Google Play did not provide are `null` — never inferred or filled in.
 */
export interface Review {
  reviewId: string
  source: 'google_play'
  rating: StarRating
  title: string | null
  text: string | null
  postedAt: string
  appVersion: string | null
  thumbsUpCount: number | null
  developerResponse: DeveloperResponse | null
  /** The collection pass that first returned this review. */
  collectedVia: CollectionSort
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type CategoryId =
  | 'service_delivery'
  | 'booking_availability'
  | 'payments_credits_refunds'
  | 'customer_support'
  | 'trust_safety_property'
  | 'app_functionality'
  | 'account_access'
  | 'updates_compatibility'
  | 'positive_experience'
  | 'other_unclear'

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface EvidenceQuote {
  reviewId: string
  quote: string
  /** True only if `quote` is an exact substring of the original review title or text AND `reviewId` exists in the dataset. */
  verified: boolean
  /** True if the quote textually supports the assigned category (keyword-in-context check). False if relevance cannot be established. */
  relevant: boolean
  /** "verified" means exact string match only; "relevant" means the quote contextually supports the theme. */
  verificationNote: string
}

export type Confidence = 'high' | 'medium' | 'low'

// ---------------------------------------------------------------------------
// Pain points & recommendations
// ---------------------------------------------------------------------------

export interface PainPointScoreBreakdown {
  /** Max 40 pts. = (uniqueReviewIdsInTheme / totalReviewsWithText) * 40, capped at 40. */
  frequencyPoints: number
  /** Max 30 pts. = (negativeReviewsInTheme / uniqueReviewsInTheme) * 30. Denominator is unique reviews in theme, not total negatives. */
  negativityPoints: number
  /** Max 20 pts. Average recency bucket across theme reviews: ≤30d=20, ≤90d=12, ≤180d=6, >180d=0. */
  recencyPoints: number
  /** Max 10 pts. = (relevantVerifiedQuotes / min(uniqueReviews, 4)) * 10. Only relevance-verified quotes count. */
  evidencePoints: number
  total: number
  /** Human-readable explanation of every component and its denominator. */
  rationale: string
}

export interface PainPoint {
  id: CategoryId
  rank: number
  theme: string
  summary: string
  reviewCount: number
  /** Overlapping share: uniqueReviewsInTheme / totalNegativeReviews. NOT mutually exclusive. */
  shareOfNegative: number
  confidence: Confidence
  /** Explicitly labeled heuristic — not statistically calibrated. */
  confidenceBasis: string
  evidence: EvidenceQuote[]
  /** Composite heuristic score (0–100). */
  score: number
  scoreBreakdown: PainPointScoreBreakdown
  /** Count of reviews where the classifier had low certainty about the primary category. */
  uncertainCount: number
}

export interface Recommendation {
  id: string
  painPointId: CategoryId
  title: string
  /** The specific customer problem, grounded in evidence. */
  problem: string
  /** A concrete proposed action. */
  action: string
  /** Why it matters to the customer or business. */
  rationale: string
  horizon: 'now' | 'next' | 'later'
  supportingReviewIds: string[]
  /** Heuristic confidence or priority rationale. */
  priorityRationale: string
  /** A suggested metric that could be measured after implementation. */
  successMetric: string
  /** "supported" if evidence is strong, "needs_validation" if weak or ambiguous. */
  status: 'supported' | 'needs_validation'
}

// ---------------------------------------------------------------------------
// Analysis response
// ---------------------------------------------------------------------------

export interface ReviewClassification {
  reviewId: string
  primaryCategory: CategoryId
  secondaryCategories: CategoryId[]
  sentiment: Sentiment
  /** Whether the review describes an app/product issue, a service-delivery issue, or both. */
  domain: 'app' | 'service' | 'both' | 'unclear'
  actionable: boolean
  /** Classifier certainty about the primary category: high if strong contextual match, low if fallback. */
  certainty: 'high' | 'low'
  reason: string
}

export interface AnalysisResponse {
  method: 'rule_based_v2'
  methodLabel: string
  methodDescription: string
  limitations: string[]
  taxonomy: { id: CategoryId; label: string; description: string }[]
  painPoints: PainPoint[]
  recommendations: Recommendation[]
  classifications: ReviewClassification[]
  meta: {
    reviewCount: number
    reviewsClassified: number
    reviewsExcluded: number
    reviewsUnclear: number
    negativeReviewCount: number
    /** Denominator for shareOfNegative: count of reviews with rating ≤ 2 AND usable text. */
    negativeDenominator: number
    themesFound: number
    themesSkipped: number
    overlappingLabels: boolean
    analyzedAt: string
    durationMs: number
    scoringMethodology: string
  }
}

export type AnalysisErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_BODY'
  | 'NO_REVIEWS'
  | 'NO_TEXT_REVIEWS'
  | 'INTERNAL_ERROR'

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: AnalysisResponse }
  | { status: 'error'; code: string; message: string }

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface HumanLabel {
  reviewId: string
  /** Human-assigned primary category. */
  primaryCategory: CategoryId
  /** Optional human-assigned secondary categories. */
  secondaryCategories: CategoryId[]
  sentiment: Sentiment
  actionable: boolean
  /** True if a human verified that the evidence quote is relevant to the assigned category. */
  evidenceRelevant?: boolean
  /** Optional note from the human labeller. */
  note?: string
}

export interface BenchmarkDataset {
  schemaVersion: 1
  labels: HumanLabel[]
  /** ISO timestamp of last modification. */
  updatedAt: string
  /** Number of labels that have been manually reviewed. Never fabricated. */
  reviewedCount: number
  /** Target benchmark size. */
  targetSize: number
}

export interface CategoryMetrics {
  categoryId: CategoryId
  label: string
  labelled: number
  predicted: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
  precision: number | null
  recall: number | null
  f1: number | null
}

export interface EvaluationResult {
  perCategory: CategoryMetrics[]
  macroPrecision: number | null
  macroRecall: number | null
  macroF1: number | null
  /** Primary-category accuracy: predicted primary == labelled primary. */
  primaryAccuracy: number | null
  sentimentAccuracy: number | null
  quoteIntegrityPassRate: number | null
  /** Only calculated when relevance labels exist. */
  evidenceRelevancePassRate: number | null
  labelledCount: number
  evaluatedCount: number
  benchmarkComplete: boolean
}

// ---------------------------------------------------------------------------
// Existing types (unchanged)
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok'
  service: string
  version: string
  timestamp: string
  uptimeSeconds: number
  runtime: string
  environment: string
  checks: {
    api: 'ok'
    reviewSource: IntegrationStatus
    analysisEngine: IntegrationStatus
  }
}

export type FetchReviewsErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'CROSS_ORIGIN_REJECTED'
  | 'COOLDOWN_ACTIVE'
  | 'FETCH_IN_PROGRESS'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_BLOCKED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_HTTP_ERROR'
  | 'UPSTREAM_PARSE_ERROR'
  | 'APP_NOT_FOUND'
  | 'INVALID_UPSTREAM_RESPONSE'
  | 'COLLECTOR_CONFIG_ERROR'
  | 'COLLECTION_DEADLINE'
  | 'CLIENT_ABORTED'
  | 'INTERNAL_ERROR'

export interface ApiErrorResponse {
  error: {
    code: FetchReviewsErrorCode | (string & {})
    message: string
    retryAfterSeconds?: number
  }
}

export type PassStopReason =
  | 'target_reached'
  | 'pass_budget_reached'
  | 'max_pages_reached'
  | 'no_more_pages'
  | 'empty_page'
  | 'no_new_reviews'
  | 'repeated_token'
  | 'deadline_reached'
  | 'client_aborted'
  | 'upstream_error'
  | 'skipped'

export interface CollectionPassSummary {
  sort: CollectionSort
  pagesFetched: number
  requestedCount: number
  fetchedCount: number
  invalidCount: number
  duplicateCount: number
  newUniqueCount: number
  stopReason: PassStopReason
  error: { code: string; message: string } | null
}

export interface CollectionWarning {
  code: 'TARGET_NOT_REACHED' | 'PASS_FAILED' | 'PASS_SKIPPED' | 'DEADLINE_REACHED' | 'OVERFLOW_TRIMMED' | 'NO_REVIEWS'
  message: string
}

export interface DatasetQuality {
  ratingDistribution: Record<StarRating, number>
  earliestPostedAt: string | null
  latestPostedAt: string | null
  withTextCount: number
  lowInformationCount: number
  lowInformationRule: string
  withDeveloperResponseCount: number
  bySort: Record<CollectionSort, number>
}

export interface CollectionProgress {
  pass: CollectionSort
  passIndex: number
  passCount: number
  page: number
  fetchedCount: number
  retainedCount: number
  targetUniqueCount: number
}

export interface FetchReviewsSuccess {
  packageId: string
  storefront: { country: string; language: string }
  method: {
    source: 'google_play'
    scraper: string
    pagination: 'server_side_token'
    passes: { sort: CollectionSort; order: number }[]
    pageSize: number
  }
  samplingNote: string
  targetUniqueCount: number
  complete: boolean
  targetReached: boolean
  requestCount: number
  requestedCount: number
  fetchedCount: number
  invalidCount: number
  duplicateCount: number
  overflowCount: number
  retainedCount: number
  passes: CollectionPassSummary[]
  quality: DatasetQuality
  warnings: CollectionWarning[]
  fetchedAt: string
  durationMs: number
  reviews: Review[]
}

export type CollectionStreamEvent =
  | { type: 'progress'; progress: CollectionProgress }
  | { type: 'result'; result: FetchReviewsSuccess }
  | { type: 'error'; error: { code: FetchReviewsErrorCode; message: string; retryAfterSeconds?: number } }

// ---------------------------------------------------------------------------
// Audit package types
// ---------------------------------------------------------------------------

export type ParentCategoryId =
  | 'app_digital_experience'
  | 'service_delivery_professional_conduct'
  | 'payments_pricing_refunds'
  | 'customer_support_resolution'
  | 'availability_coverage_scheduling'

export interface TaxonomyChildDefinition {
  id: CategoryId
  label: string
  description: string
  inclusionCriteria: string[]
  exclusionCriteria: string[]
  parent: ParentCategoryId
}

export interface TaxonomyParentDefinition {
  id: ParentCategoryId
  label: string
  description: string
}

export interface TaxonomyExport {
  version: string
  generatedAt: string
  parents: TaxonomyParentDefinition[]
  children: TaxonomyChildDefinition[]
  mappingFromExistingLabels: { existingId: CategoryId; parentId: ParentCategoryId; note: string }[]
}

export type SelectionReason =
  | 'random'
  | 'multi_category'
  | 'low_confidence'
  | 'unclear'
  | 'evidence_relevance_failed'
  | 'boundary_exposing'

export interface AuditSampleItem {
  reviewId: string
  selectionReasons: SelectionReason[]
}

export interface AuditSample {
  reviewIds: AuditSampleItem[]
  seed: number
  method: string
  targetSize: number
  composition: Record<string, number>
  isRepresentative: false
}

export type ProposalSentiment = 'positive' | 'negative' | 'mixed' | 'neutral' | 'unclear'

export interface AiProposal {
  reviewId: string
  sourceTextHash: string
  parentLabels: ParentCategoryId[]
  childLabels: CategoryId[]
  primaryIssue: string | null
  sentiment: ProposalSentiment
  evidenceExcerpts: { label: CategoryId; excerpt: string }[]
  rationale: string
  uncertain: boolean
  uncertainReason: string | null
  hasMultipleIssues: boolean
  taxonomyVersion: string
  modelId: string
  promptVersion: string
  generatedAt: string
}

export interface ProposalValidationResult {
  reviewId: string
  valid: boolean
  errors: string[]
  rejectedLabels: string[]
  rejectedExcerpts: string[]
}

export interface UnresolvedItem {
  reviewId: string
  type: 'proposal_failed' | 'proposal_incomplete' | 'validation_failed' | 'missing_field'
  detail: string
}

export interface AuditManifest {
  schemaVersion: 1
  exportTimestamp: string
  reviewCount: number
  sampledCount: number
  taxonomyVersion: string
  samplingMethod: string
  samplingSeed: number
  modelId: string | null
  promptVersion: string
  completionStatus: 'complete' | 'partial' | 'no_ai_provider'
  proposalCount: number
  validationErrorCount: number
  unresolvedCount: number
}

export interface AuditPackage {
  manifest: AuditManifest
  taxonomy: TaxonomyExport
  allReviews: {
    reviewId: string
    rating: StarRating
    title: string | null
    text: string | null
    postedAt: string
    appVersion: string | null
    source: string
    collectedVia: string
  }[]
  baselinePredictions: ReviewClassification[]
  auditSample: AuditSample
  aiProposals: AiProposal[]
  validationResults: ProposalValidationResult[]
  unresolvedItems: UnresolvedItem[]
  humanVerifiedLabels: { reviewId: string; status: 'unverified' }[]
}

export type AuditErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'NO_REVIEWS'
  | 'NO_ANALYSIS'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'INTERNAL_ERROR'
