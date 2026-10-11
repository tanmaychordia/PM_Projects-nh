import type {
  AnalysisResponse,
  Confidence,
  EvidenceQuote,
  PainPoint,
  PainPointScoreBreakdown,
  Recommendation,
  Review,
  StarRating,
} from './types'

// ---------------------------------------------------------------------------
// Theme definitions — transparent, human-readable keyword rules.
//
// Each theme has a label, a list of keyword patterns, and a recommendation
// template. A review matches a theme if any keyword appears as a word-level
// substring in its title or text. Matching is case-insensitive.
//
// Themes are NOT invented at runtime — they are a fixed catalog derived from
// common mobile app complaint categories. A theme only appears in the output
// if at least MIN_REVIEWS_FOR_THEME reviews match it.
// ---------------------------------------------------------------------------

interface ThemeDefinition {
  id: string
  label: string
  summary: string
  keywords: string[]
  recommendationTitle: string
  recommendationRationale: string
  horizon: Recommendation['horizon']
}

const MIN_REVIEWS_FOR_THEME = 2
const MAX_EVIDENCE_QUOTES = 4
const MAX_THEMES = 8
const MAX_RECOMMENDATIONS = 8
const QUOTE_MAX_LENGTH = 180

const THEME_CATALOG: ThemeDefinition[] = [
  {
    id: 'crashes_stability',
    label: 'Crashes & stability',
    summary: 'App closes unexpectedly, freezes, or becomes unresponsive.',
    keywords: ['crash', 'crashes', 'crashed', 'freeze', 'freezes', 'frozen', 'hang', 'hangs', 'hanging', 'unresponsive', 'force close', 'force stop', 'not responding', 'ANR'],
    recommendationTitle: 'Prioritize crash and freeze fixes',
    recommendationRationale: 'Crashes and freezes are the most visible quality issues. Focus on reproducing the top crash signals and shipping stability patches.',
    horizon: 'now',
  },
  {
    id: 'login_account',
    label: 'Login & account access',
    summary: 'Users cannot sign in, reset passwords, or access their accounts.',
    keywords: ['login', 'log in', 'sign in', 'signin', 'logout', 'log out', 'sign out', 'password', 'otp', 'verification code', 'account', 'authentication', 'auth', 'credential'],
    recommendationTitle: 'Fix login and account recovery flows',
    recommendationRationale: 'Blocking users from accessing their account has immediate revenue and retention impact. Audit the login flow end-to-end.',
    horizon: 'now',
  },
  {
    id: 'payment_transactions',
    label: 'Payment & transaction failures',
    summary: 'Payments fail, amounts are charged incorrectly, or refunds are missing.',
    keywords: ['payment', 'pay', 'paid', 'transaction', 'charge', 'charged', 'refund', 'refunded', 'upi', 'wallet', 'debit', 'credit card', 'net banking', 'amount', 'money deducted'],
    recommendationTitle: 'Investigate payment and refund pipeline',
    recommendationRationale: 'Failed or incorrect transactions erode trust quickly. Prioritize a payment reliability audit and a clear refund path.',
    horizon: 'now',
  },
  {
    id: 'performance_speed',
    label: 'Performance & speed',
    summary: 'App is slow to load, navigate, or complete actions.',
    keywords: ['slow', 'lag', 'laggy', 'loading', 'load time', 'takes forever', 'takes too long', 'speed', 'performance', 'sluggish', 'delay', 'delayed', 'stutter'],
    recommendationTitle: 'Reduce load times and interaction latency',
    recommendationRationale: 'Perceived speed directly affects retention. Profile cold-start, screen transitions, and network call patterns.',
    horizon: 'next',
  },
  {
    id: 'bugs_errors',
    label: 'Bugs & unexpected behavior',
    summary: 'Features do not work as expected or show error messages.',
    keywords: ['bug', 'bugs', 'buggy', 'error', 'errors', 'glitch', 'glitches', 'broken', 'not working', "doesn't work", 'does not work', 'wrong', 'incorrect', 'issue', 'issues', 'problem', 'problem'],
    recommendationTitle: 'Triage and fix reported bugs',
    recommendationRationale: 'Group reported bugs by feature area and address those with the highest review frequency first.',
    horizon: 'next',
  },
  {
    id: 'ui_ux',
    label: 'UI & usability',
    summary: 'Interface is confusing, hard to navigate, or visually unpleasant.',
    keywords: ['ui', 'interface', 'design', 'layout', 'confusing', 'hard to use', 'difficult to use', 'navigation', 'navigate', 'user friendly', 'user-friendly', 'cluttered', 'complicated', 'complex'],
    recommendationTitle: 'Simplify navigation and key user flows',
    recommendationRationale: 'Run usability tests on the flows that receive the most complaints. Reduce steps and clarify labels.',
    horizon: 'next',
  },
  {
    id: 'notifications',
    label: 'Notification issues',
    summary: 'Notifications are missing, delayed, or excessive.',
    keywords: ['notification', 'notifications', 'alert', 'alerts', 'push notification', 'not getting notified', 'spam', 'too many notifications'],
    recommendationTitle: 'Audit notification delivery and frequency',
    recommendationRationale: 'Missing or excessive notifications both hurt engagement. Verify delivery pipelines and allow granular controls.',
    horizon: 'later',
  },
  {
    id: 'updates_version',
    label: 'Update & version problems',
    summary: 'Recent updates introduced regressions or broke previously working features.',
    keywords: ['update', 'updated', 'updating', 'new version', 'latest version', 'previous version', 'old version', 'after update', 'regression', 'downgrade'],
    recommendationTitle: 'Add regression tests for update cycles',
    recommendationRationale: 'Monitor post-update review sentiment and add regression coverage for features that broke after a release.',
    horizon: 'later',
  },
  {
    id: 'customer_support',
    label: 'Customer support quality',
    summary: 'Support is unreachable, slow, or unhelpful.',
    keywords: ['support', 'customer service', 'help', 'no response', 'no reply', 'contact', 'helpline', 'care', 'grievance'],
    recommendationTitle: 'Improve support responsiveness and channels',
    recommendationRationale: 'Negative support experiences amplify other complaints. Ensure response SLAs and accessible channels.',
    horizon: 'later',
  },
  {
    id: 'data_sync',
    label: 'Data loss & sync issues',
    summary: 'Data disappears, does not sync, or orders are missing.',
    keywords: ['data loss', 'lost my', 'missing', 'disappeared', 'sync', 'not syncing', 'not updated', 'old data', 'order missing', 'history missing', 'vanish', 'vanished'],
    recommendationTitle: 'Verify data persistence and sync reliability',
    recommendationRationale: 'Data loss is a trust-critical issue. Audit sync logic, add reconciliation checks, and surface clear error states.',
    horizon: 'now',
  },
]

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const RECENCY_BUCKETS_DAYS = [30, 90, 180] as const
const RECENCY_POINTS = [40, 25, 10, 0] as const

function combineReviewText(review: Review): string {
  return [review.title, review.text].filter(Boolean).join(' ')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(`(?:^|\\W)${escapeRegex(keyword.toLowerCase())}(?:\\W|$)`, 'i')
  return pattern.test(text.toLowerCase())
}

function findMatchingThemeIds(review: Review): string[] {
  const text = combineReviewText(review)
  if (!text.trim()) return []
  const matched: string[] = []
  for (const theme of THEME_CATALOG) {
    for (const keyword of theme.keywords) {
      if (matchesKeyword(text, keyword)) {
        matched.push(theme.id)
        break
      }
    }
  }
  return matched
}

function isNegative(rating: StarRating): boolean {
  return rating <= 2
}

function extractQuote(review: Review, themeKeywords: string[]): EvidenceQuote | null {
  const sources: string[] = []
  if (review.title) sources.push(review.title)
  if (review.text) sources.push(review.text)

  for (const source of sources) {
    const lowerSource = source.toLowerCase()
    for (const keyword of themeKeywords) {
      const lowerKeyword = keyword.toLowerCase()
      const idx = lowerSource.indexOf(lowerKeyword)
      if (idx === -1) continue

      const keywordEnd = idx + keyword.length
      let start = idx
      let end = keywordEnd

      while (start > 0 && source[start - 1] !== '.' && source[start - 1] !== '!' && source[start - 1] !== '?' && start > idx - 80) {
        start--
      }
      while (end < source.length && source[end] !== '.' && source[end] !== '!' && source[end] !== '?' && end < keywordEnd + 80) {
        end++
      }

      let quote = source.slice(start, end).trim()
      if (quote.length > QUOTE_MAX_LENGTH) {
        if (start === 0) {
          quote = quote.slice(0, QUOTE_MAX_LENGTH - 1).trimEnd() + '…'
        } else {
          quote = '…' + quote.slice(-(QUOTE_MAX_LENGTH - 1)).trimStart()
        }
      }

      const verified = source.includes(quote.replace(/^[…]+|[…]+$/g, '')) || source.includes(quote)

      return {
        reviewId: review.reviewId,
        quote,
        verified,
      }
    }
  }
  return null
}

function recencyPoints(postedAt: string, now: number): number {
  const daysAgo = (now - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)
  for (let i = 0; i < RECENCY_BUCKETS_DAYS.length; i++) {
    if (daysAgo <= RECENCY_BUCKETS_DAYS[i]) return RECENCY_POINTS[i]
  }
  return RECENCY_POINTS[RECENCY_POINTS.length - 1]
}

function confidenceFromScore(score: number, reviewCount: number): Confidence {
  if (score >= 55 && reviewCount >= 4) return 'high'
  if (score >= 30 && reviewCount >= 3) return 'medium'
  return 'low'
}

function buildScoreBreakdown(
  frequencyPoints: number,
  negativityPoints: number,
  recencyPts: number,
  evidencePoints: number,
  reviewCount: number,
  negativeCount: number,
): PainPointScoreBreakdown {
  const total = Math.min(100, Math.round(frequencyPoints + negativityPoints + recencyPts + evidencePoints))
  return {
    frequencyPoints: Math.round(frequencyPoints),
    negativityPoints: Math.round(negativityPoints),
    recencyPoints: Math.round(recencyPts),
    evidencePoints: Math.round(evidencePoints),
    total,
    rationale: `Score = frequency (${reviewCount} reviews, ${frequencyPoints.toFixed(0)} pts) + negativity (${negativeCount} negative ratings, ${negativityPoints.toFixed(0)} pts) + recency (${recencyPts.toFixed(0)} pts) + evidence quality (${evidencePoints.toFixed(0)} pts). Capped at 100.`,
  }
}

export function analyzeReviews(reviews: Review[]): AnalysisResponse {
  const startedAt = Date.now()
  const now = Date.now()

  const reviewsWithText = reviews.filter((r) => (r.title?.trim() || r.text?.trim()) && r.rating)

  const negativeReviews = reviews.filter((r) => isNegative(r.rating))
  const negativeCount = negativeReviews.length

  // Map each theme to the reviews that matched it
  const themeMatches = new Map<string, Set<string>>()
  const themeReviewMap = new Map<string, Review[]>()

  for (const review of reviewsWithText) {
    const matchedThemeIds = findMatchingThemeIds(review)
    for (const themeId of matchedThemeIds) {
      if (!themeMatches.has(themeId)) {
        themeMatches.set(themeId, new Set())
        themeReviewMap.set(themeId, [])
      }
      themeMatches.get(themeId)!.add(review.reviewId)
      themeReviewMap.get(themeId)!.push(review)
    }
  }

  // Filter themes with insufficient evidence
  const qualifiedThemeIds: string[] = []
  let themesSkipped = 0

  for (const theme of THEME_CATALOG) {
    const reviewIds = themeMatches.get(theme.id)
    if (!reviewIds || reviewIds.size < MIN_REVIEWS_FOR_THEME) {
      if (reviewIds && reviewIds.size > 0) themesSkipped++
      continue
    }
    qualifiedThemeIds.push(theme.id)
  }

  // Build pain points with scores
  const painPoints: PainPoint[] = qualifiedThemeIds.map((themeId) => {
    const theme = THEME_CATALOG.find((t) => t.id === themeId)!
    const themeReviews = themeReviewMap.get(themeId)!
    const uniqueReviewIds = Array.from(themeMatches.get(themeId)!)
    const reviewCount = uniqueReviewIds.length

    const themeNegatives = themeReviews.filter((r) => isNegative(r.rating))
    const negativeCountInTheme = themeNegatives.length

    // Frequency points: up to 40, scaled by review count relative to total
    const frequencyPoints = Math.min(40, (reviewCount / Math.max(reviewsWithText.length, 1)) * 100 * 0.4)

    // Negativity points: up to 30, scaled by share of negative reviews in theme
    const negativityRatio = reviewCount > 0 ? negativeCountInTheme / reviewCount : 0
    const negativityPoints = negativityRatio * 30

    // Recency points: average recency across theme reviews, up to 40
    const avgRecency = themeReviews.reduce((sum, r) => sum + recencyPoints(r.postedAt, now), 0) / reviewCount

    // Evidence quality: up to 10, based on how many quotes we could verify
    const evidenceQuotes: EvidenceQuote[] = []
    for (const review of themeReviews) {
      if (evidenceQuotes.length >= MAX_EVIDENCE_QUOTES) break
      const eq = extractQuote(review, theme.keywords)
      if (eq && eq.verified) {
        evidenceQuotes.push(eq)
      }
    }
    const verifiedCount = evidenceQuotes.length
    const evidencePoints = (verifiedCount / Math.min(reviewCount, MAX_EVIDENCE_QUOTES)) * 10

    const breakdown = buildScoreBreakdown(
      frequencyPoints,
      negativityPoints,
      avgRecency,
      evidencePoints,
      reviewCount,
      negativeCountInTheme,
    )

    const shareOfNegative = negativeCount > 0 ? reviewCount / negativeCount : 0

    return {
      id: theme.id,
      rank: 0, // assigned after sorting
      theme: theme.label,
      summary: theme.summary,
      reviewCount,
      shareOfNegative,
      confidence: confidenceFromScore(breakdown.total, reviewCount),
      evidence: evidenceQuotes,
      score: breakdown.total,
      scoreBreakdown: breakdown,
    }
  })

  // Sort by score descending, assign ranks
  painPoints.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  painPoints.forEach((pp, i) => {
    pp.rank = i + 1
  })

  // Limit themes
  const topPainPoints = painPoints.slice(0, MAX_THEMES)

  // Build recommendations from top pain points
  const recommendations: Recommendation[] = topPainPoints
    .filter((pp) => pp.confidence !== 'low' || pp.reviewCount >= 3)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((pp) => {
      const theme = THEME_CATALOG.find((t) => t.id === pp.id)!
      return {
        id: `rec-${pp.id}`,
        painPointId: pp.id,
        title: theme.recommendationTitle,
        rationale: `${theme.recommendationRationale} Supported by ${pp.reviewCount} reviews with ${pp.evidence.length} verified quotes.`,
        horizon: theme.horizon,
        supportingReviewIds: Array.from(themeMatches.get(pp.id) ?? []),
      }
    })

  const limitations: string[] = [
    'This is a rule-based baseline, not AI-generated analysis. Themes are matched by keyword patterns and may miss complaints expressed in unfamiliar language.',
    `Themes require at least ${MIN_REVIEWS_FOR_THEME} matching reviews to appear. Real issues with fewer mentions are not shown.`,
    'Recommendations are derived from fixed templates, not contextual reasoning about the product roadmap.',
  ]
  if (topPainPoints.length === 0) {
    limitations.push('No themes met the evidence threshold. This may mean the reviews are too few, too short, or express issues outside the keyword catalog.')
  }
  if (reviewsWithText.length < reviews.length) {
    limitations.push(`${reviews.length - reviewsWithText.length} reviews had no usable text and were excluded from theme matching.`)
  }

  return {
    method: 'rule_based_v1',
    methodLabel: 'Rule-based analysis v1',
    methodDescription:
      'Pain points are identified by matching review text against a fixed catalog of complaint keywords. Themes are grouped, scored, and ranked transparently — no AI model is involved.',
    limitations,
    painPoints: topPainPoints,
    recommendations,
    meta: {
      reviewCount: reviews.length,
      negativeReviewCount: negativeCount,
      themesFound: topPainPoints.length,
      themesSkipped,
      analyzedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
    },
  }
}
