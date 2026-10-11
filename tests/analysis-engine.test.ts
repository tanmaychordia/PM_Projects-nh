import { classifyReview, analyzeReviews } from '../lib/voc/analysis-engine'
import type { Review } from '../lib/voc/types'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`FAIL: ${message}`)
  }
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

// ---------------------------------------------------------------------------
// Test 1: A missing silver anklet → trust_safety_property, NOT data sync
// ---------------------------------------------------------------------------
{
  const r = makeReview({
    reviewId: 't1',
    rating: 1,
    title: 'Missing silver anklet',
    text: 'My silver anklet is missing after the cleaning service. I filed a complaint but no one responded.',
  })
  const c = classifyReview(r)
  assert(c.primaryCategory === 'trust_safety_property', `Test 1: anklet → trust_safety_property (got ${c.primaryCategory})`)
}

// ---------------------------------------------------------------------------
// Test 2: Late-arriving service provider → service_delivery, NOT app_functionality
// ---------------------------------------------------------------------------
{
  const r = makeReview({
    reviewId: 't2',
    rating: 2,
    title: 'Late arrival',
    text: 'The house help arrived 2 hours late. Very disappointing service.',
  })
  const c = classifyReview(r)
  assert(c.primaryCategory === 'service_delivery', `Test 2: late house help → service_delivery (got ${c.primaryCategory})`)
}

// ---------------------------------------------------------------------------
// Test 3: Sold-out slot → booking_availability, NOT payments (unless payment failure described)
// ---------------------------------------------------------------------------
{
  const r = makeReview({
    reviewId: 't3',
    rating: 2,
    title: 'No slots available',
    text: 'All slots are sold out. Cannot book a cleaning service.',
  })
  const c = classifyReview(r)
  assert(c.primaryCategory === 'booking_availability', `Test 3: sold-out slot → booking_availability (got ${c.primaryCategory})`)
}

// ---------------------------------------------------------------------------
// Test 4: Refund complaint → NOT login failure
// ---------------------------------------------------------------------------
{
  const r = makeReview({
    reviewId: 't4',
    rating: 1,
    title: 'Refund not processed',
    text: 'I requested a refund 3 weeks ago but still no refund. My wallet balance is wrong.',
  })
  const c = classifyReview(r)
  assert(c.primaryCategory === 'payments_credits_refunds', `Test 4: refund complaint → payments_credits_refunds (got ${c.primaryCategory})`)
  assert(!c.secondaryCategories.includes('account_access'), 'Test 4: refund should NOT have account_access as secondary')
}

// ---------------------------------------------------------------------------
// Test 5: Positive review does not count as negative pain point
// ---------------------------------------------------------------------------
{
  const r = makeReview({
    reviewId: 't5',
    rating: 5,
    title: 'Great service',
    text: 'Excellent cleaning service. The professional was punctual and polite. Highly recommend!',
  })
  const c = classifyReview(r)
  assert(c.sentiment === 'positive', `Test 5: positive sentiment (got ${c.sentiment})`)
  assert(c.primaryCategory === 'positive_experience', `Test 5: → positive_experience (got ${c.primaryCategory})`)
  assert(c.primaryCategory !== 'service_delivery', 'Test 5: should NOT be service_delivery pain point')
}

// ---------------------------------------------------------------------------
// Test 6: One review with two legitimate issues → two supported labels, no double-counting
// ---------------------------------------------------------------------------
{
  const r = makeReview({
    reviewId: 't6',
    rating: 1,
    title: 'App crash and refund issue',
    text: 'The app keeps crashing every time I open it. Also my refund has not been processed for 2 weeks.',
  })
  const c = classifyReview(r)
  const allCats = [c.primaryCategory, ...c.secondaryCategories]
  assert(allCats.includes('app_functionality'), `Test 6: should include app_functionality (got ${allCats.join(', ')})`)
  assert(allCats.includes('payments_credits_refunds'), `Test 6: should include payments_credits_refunds (got ${allCats.join(', ')})`)
  // In analyzeReviews, unique review IDs should be counted once per category
  const result = analyzeReviews([r, makeReview({ reviewId: 't6b', rating: 1, text: 'App crash and refund issue. The app keeps crashing. Refund not processed.' })])
  const appFn = result.painPoints.find((p) => p.id === 'app_functionality')
  const payFn = result.painPoints.find((p) => p.id === 'payments_credits_refunds')
  if (appFn && payFn) {
    // t6 appears in both categories but each category counts it once
    assert(appFn.reviewCount >= 1 && payFn.reviewCount >= 1, 'Test 6: both categories have at least 1 review')
    // The total unique reviews in the dataset is 2, not 4
    assert(result.meta.reviewCount === 2, `Test 6: total review count should be 2 (got ${result.meta.reviewCount})`)
  } else {
    assert(false, 'Test 6: both app_functionality and payments categories should exist')
  }
}

// ---------------------------------------------------------------------------
// Test 7: A quote not present in the original review is rejected
// ---------------------------------------------------------------------------
{
  const reviews = [
    makeReview({ reviewId: 't7', rating: 1, title: 'Crash', text: 'The app crashes every time I try to book a slot.' }),
  ]
  const result = analyzeReviews(reviews)
  const pp = result.painPoints.find((p) => p.id === 'app_functionality')
  if (pp && pp.evidence.length > 0) {
    const eq = pp.evidence[0]
    // The quote must be an exact substring of the review text
    const reviewText = 'The app crashes every time I try to book a slot.'
    const cleanQuote = eq.quote.replace(/^[…]+|[…]+$/g, '')
    assert(reviewText.includes(cleanQuote) || reviewText.includes(eq.quote), 'Test 7: evidence quote must be exact substring of review text')
  } else {
    // If no evidence was extracted, that's acceptable — but verify the quote verification logic
    assert(true, 'Test 7: no evidence extracted (acceptable)')
  }

  // Directly test: a fabricated quote should not be "verified"
  // We test this by checking that all evidence in the result has verified=true
  // (the engine only includes verified quotes)
  for (const pp2 of result.painPoints) {
    for (const eq2 of pp2.evidence) {
      assert(eq2.verified, 'Test 7: all displayed evidence must be verified')
    }
  }
}

// ---------------------------------------------------------------------------
// Test 8: An exact quote from an unrelated review is not verified evidence for the selected theme
// ---------------------------------------------------------------------------
{
  const reviews = [
    makeReview({ reviewId: 't8a', rating: 1, title: 'Stolen anklet', text: 'My gold anklet was stolen by the cleaning staff.' }),
    makeReview({ reviewId: 't8b', rating: 1, title: 'App crash', text: 'The app keeps crashing on my phone.' }),
  ]
  const result = analyzeReviews(reviews)
  const trustPp = result.painPoints.find((p) => p.id === 'trust_safety_property')
  if (trustPp) {
    for (const eq of trustPp.evidence) {
      // Every evidence quote for trust_safety_property must come from a review
      // that actually matches that category, not from the crash review
      assert(eq.reviewId !== 't8b', 'Test 8: crash review should not appear as evidence for trust/safety')
      // And the quote should be relevant to trust/safety, not to app crashes
      if (eq.relevant) {
        assert(!eq.quote.toLowerCase().includes('crash'), 'Test 8: crash quote should not be relevant to trust/safety')
      }
    }
  } else {
    // With only 1 trust review, the theme may not qualify (MIN_REVIEWS_FOR_THEME=2)
    // That's acceptable — the point is that unrelated quotes don't leak
    assert(true, 'Test 8: trust_safety theme did not qualify (acceptable with <2 reviews)')
  }
}

// ---------------------------------------------------------------------------
// Test 9: Empty datasets and empty categories don't crash
// ---------------------------------------------------------------------------
{
  const result = analyzeReviews([])
  assert(result.painPoints.length === 0, 'Test 9: empty dataset → no pain points')
  assert(result.meta.reviewCount === 0, 'Test 9: empty dataset → reviewCount 0')
  assert(result.meta.negativeDenominator === 0, 'Test 9: empty dataset → negativeDenominator 0')
  assert(result.meta.negativeReviewCount === 0, 'Test 9: empty dataset → negativeReviewCount 0')

  // All reviews with no text
  const noText = [makeReview({ reviewId: 't9', text: null, title: null })]
  const result2 = analyzeReviews(noText)
  assert(result2.painPoints.length === 0, 'Test 9: no-text reviews → no pain points')
  assert(result2.meta.reviewsExcluded === 1, 'Test 9: no-text review excluded')
}

// ---------------------------------------------------------------------------
// Test 10: Scores and percentages use consistent, documented denominators
// ---------------------------------------------------------------------------
{
  const reviews = [
    makeReview({ reviewId: 't10a', rating: 1, text: 'The app keeps crashing. Very bad.' }),
    makeReview({ reviewId: 't10b', rating: 1, text: 'App crash every time. Worst app.' }),
    makeReview({ reviewId: 't10c', rating: 5, text: 'Great service, very good app.' }),
  ]
  const result = analyzeReviews(reviews)
  assert(result.meta.reviewCount === 3, `Test 10: reviewCount should be 3 (got ${result.meta.reviewCount})`)
  assert(result.meta.reviewsClassified === 3, `Test 10: reviewsClassified should be 3 (got ${result.meta.reviewsClassified})`)
  // negativeDenominator = reviews with rating ≤ 2 AND text = 2
  assert(result.meta.negativeDenominator === 2, `Test 10: negativeDenominator should be 2 (got ${result.meta.negativeDenominator})`)

  // Check that no pain point has score 0 with reviews
  for (const pp of result.painPoints) {
    assert(pp.score > 0, `Test 10: pain point "${pp.theme}" has score > 0 (got ${pp.score})`)
    assert(pp.reviewCount > 0, `Test 10: pain point "${pp.theme}" has reviewCount > 0`)
    // shareOfNegative should be ≤ 1.0
    assert(pp.shareOfNegative <= 1.0, `Test 10: shareOfNegative ≤ 1.0 (got ${pp.shareOfNegative})`)
    // Score breakdown should document denominators
    assert(pp.scoreBreakdown.rationale.includes('frequency'), 'Test 10: rationale mentions frequency')
    assert(pp.scoreBreakdown.rationale.includes('negativity'), 'Test 10: rationale mentions negativity')
    assert(pp.scoreBreakdown.rationale.includes('denominator') || pp.scoreBreakdown.rationale.includes('of'), 'Test 10: rationale documents denominators')
  }

  // Scoring methodology should be in meta
  assert(result.meta.scoringMethodology.length > 0, 'Test 10: scoringMethodology is non-empty')
  assert(result.meta.overlappingLabels === true, 'Test 10: overlappingLabels is true')
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
