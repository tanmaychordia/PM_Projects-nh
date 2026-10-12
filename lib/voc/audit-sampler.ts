import type { AuditSample, AuditSampleItem, Review, ReviewClassification, SelectionReason } from './types'

const BOUNDARY_KEYWORDS = ['slot', 'booking', 'refund', 'wallet', 'login', 'otp', 'late', 'stolen', 'missing', 'crash', 'support', 'complaint']

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function buildAuditSample(
  reviews: Review[],
  classifications: ReviewClassification[],
  targetSize: number,
  seed: number = Date.now(),
): AuditSample {
  const reviewMap = new Map(reviews.map((r) => [r.reviewId, r]))
  const classMap = new Map(classifications.map((c) => [c.reviewId, c]))
  const reasonMap = new Map<string, Set<SelectionReason>>()

  function addReason(reviewId: string, reason: SelectionReason) {
    if (!reasonMap.has(reviewId)) reasonMap.set(reviewId, new Set())
    reasonMap.get(reviewId)!.add(reason)
  }

  // 1. Multi-category reviews
  for (const c of classifications) {
    if (c.secondaryCategories.length > 0) {
      addReason(c.reviewId, 'multi_category')
    }
  }

  // 2. Low confidence / unclear
  for (const c of classifications) {
    if (c.certainty === 'low') addReason(c.reviewId, 'low_confidence')
    if (c.primaryCategory === 'other_unclear') addReason(c.reviewId, 'unclear')
  }

  // 3. Boundary-exposing: reviews containing keywords from multiple domains
  for (const review of reviews) {
    const text = [review.title, review.text].filter(Boolean).join(' ').toLowerCase()
    const matchCount = BOUNDARY_KEYWORDS.filter((k) => text.includes(k))
    if (matchCount.length >= 3) {
      if (reviewMap.has(review.reviewId)) addReason(review.reviewId, 'boundary_exposing')
    }
  }

  // 4. Evidence relevance failed — we don't have per-review evidence here,
  // but reviews with low certainty are likely to have weak evidence
  for (const c of classifications) {
    if (c.certainty === 'low' && c.primaryCategory !== 'other_unclear') {
      addReason(c.reviewId, 'evidence_relevance_failed')
    }
  }

  // Collect all candidate review IDs
  const candidates = new Set<string>()
  for (const reviewId of reasonMap.keys()) {
    if (reviewMap.has(reviewId)) candidates.add(reviewId)
  }

  // 5. Random fill from remaining reviews
  const remaining = reviews
    .filter((r) => !candidates.has(r.reviewId) && (r.title?.trim() || r.text?.trim()))
    .map((r) => r.reviewId)

  const shuffledRemaining = seededShuffle(remaining, seed)

  // Build prioritized list: enriched first, then random fill
  const enrichedIds = Array.from(candidates)
  const selectedIds: string[] = [...enrichedIds]

  for (const id of shuffledRemaining) {
    if (selectedIds.length >= targetSize) break
    if (!selectedIds.includes(id)) {
      selectedIds.push(id)
      addReason(id, 'random')
    }
  }

  // Trim to target size (keep enriched ones first)
  const trimmed = selectedIds.slice(0, targetSize)

  const items: AuditSampleItem[] = trimmed.map((reviewId) => ({
    reviewId,
    selectionReasons: Array.from(reasonMap.get(reviewId) ?? []),
  }))

  // Composition by primary category
  const composition: Record<string, number> = {}
  for (const item of items) {
    const c = classMap.get(item.reviewId)
    const cat = c?.primaryCategory ?? 'other_unclear'
    composition[cat] = (composition[cat] ?? 0) + 1
  }

  return {
    reviewIds: items,
    seed,
    method: 'stratified_enriched_with_random_fill',
    targetSize,
    composition,
    isRepresentative: false,
  }
}

export function getSampledReviewIds(sample: AuditSample): string[] {
  return sample.reviewIds.map((s) => s.reviewId)
}

export function hashReviewText(review: Review): string {
  const text = [review.title ?? '', review.text ?? ''].join('\n')
  return hashString(text).toString(36)
}
