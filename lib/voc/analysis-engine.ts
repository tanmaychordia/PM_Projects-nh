import type {
  AnalysisResponse,
  CategoryId,
  Confidence,
  EvidenceQuote,
  PainPoint,
  PainPointScoreBreakdown,
  Recommendation,
  Review,
  ReviewClassification,
  Sentiment,
  StarRating,
} from './types'

// ===========================================================================
// Snabbit-specific taxonomy
//
// Each category has:
// - include: keywords that suggest this category
// - contextReq: additional keywords that must co-occur (or a structural rule)
// - exclude: keywords that disqualify the match (e.g. positive words for pain categories)
//
// A review matches a category only if:
// 1. At least one include keyword is present, AND
// 2. If contextReq is non-empty, at least one context keyword co-occurs, AND
// 3. No exclude keyword is present (unless an override rule fires)
//
// This prevents "lost anklet" → data_sync, "slow service" → app_performance, etc.
// ===========================================================================

interface CategoryRule {
  id: CategoryId
  label: string
  summary: string
  include: string[]
  contextReq: string[]
  exclude: string[]
  /** If true, positive sentiment does not disqualify (used for positive_experience). */
  allowPositive: boolean
  /** Keywords used to extract an evidence quote for this category. */
  quoteKeywords: string[]
  recommendation: {
    title: string
    problem: string
    action: string
    rationale: string
    horizon: Recommendation['horizon']
    successMetric: string
  }
}

const TAXONOMY: CategoryRule[] = [
  {
    id: 'service_delivery',
    label: 'Service delivery & reliability',
    summary: 'Late arrival, no-show, cancellation, incomplete work, poor cleaning quality, or unprofessional conduct.',
    include: ['late', 'delayed', 'delay', 'no show', 'no-show', "didn't come", 'did not come', "didn't arrive", 'did not arrive', 'cancelled', 'canceled', 'incomplete', 'not clean', 'dirty', 'poor service', 'bad service', 'unprofessional', 'rude', 'bad behavior', 'behaviour', 'not satisfied', 'unsatisfied', 'poor quality', 'bad quality', 'worst service', 'terrible service'],
    contextReq: ['late', 'delay', 'no show', 'no-show', "didn't come", 'did not come', "didn't arrive", 'did not arrive', 'cancelled', 'canceled', 'incomplete', 'not clean', 'dirty', 'poor service', 'bad service', 'unprofessional', 'rude', 'bad behavior', 'behaviour', 'not satisfied', 'unsatisfied', 'poor quality', 'bad quality', 'worst service', 'terrible service', 'cleaning', 'worker', 'maid', 'house help', 'househelp', 'staff', 'professional', 'service'],
    exclude: ['crash', 'freeze', 'bug', 'app', 'login', 'otp', 'payment', 'refund', 'wallet', 'charged', 'transaction', 'slot', 'booking', 'update', 'version', 'stolen', 'theft', 'anklet', 'jewellery', 'jewelry', 'belonging', 'missing', 'lost', 'sold out'],
    allowPositive: false,
    quoteKeywords: ['late', 'delayed', 'no show', "didn't come", 'cancelled', 'incomplete', 'not clean', 'dirty', 'unprofessional', 'rude', 'poor service', 'bad service', 'worst service', 'not satisfied', 'poor quality'],
    recommendation: {
      title: 'Improve service professional reliability and quality',
      problem: 'Customers report late arrivals, no-shows, incomplete work, and poor cleaning quality from service professionals.',
      action: 'Implement arrival-time tracking with automatic alerts, a quality checklist after each job, and a no-show penalty policy for professionals.',
      rationale: 'Service delivery is the core product. Unreliable professionals directly cause churn and negative word-of-mouth.',
      horizon: 'now',
      successMetric: 'Reduction in "late" and "no-show" mentions in weekly review samples within 60 days.',
    },
  },
  {
    id: 'booking_availability',
    label: 'Booking & availability',
    summary: 'No slots available, booking failures, incorrect availability, or booking confirmation problems.',
    include: ['slot', 'slots', 'booking', 'book', 'booked', 'availability', 'available', 'sold out', 'no slot', 'cannot book', "can't book", 'booking failed', 'not available', 'schedule'],
    contextReq: ['slot', 'booking', 'book', 'availability', 'available', 'sold out', 'schedule', 'not available'],
    exclude: ['crash', 'freeze', 'login', 'otp', 'password'],
    allowPositive: false,
    quoteKeywords: ['slot', 'booking', 'sold out', 'not available', 'no slot', "can't book", 'booking failed', 'booked'],
    recommendation: {
      title: 'Improve slot availability and booking reliability',
      problem: 'Customers cannot find available service slots or experience booking failures.',
      action: 'Increase professional supply during peak hours, show real-time availability, and implement a waitlist for high-demand slots.',
      rationale: 'Booking friction prevents revenue conversion. Customers who cannot book will switch to competitors.',
      horizon: 'next',
      successMetric: 'Booking success rate and slot availability during peak hours within 90 days.',
    },
  },
  {
    id: 'payments_credits_refunds',
    label: 'Payments, credits & refunds',
    summary: 'Failed transactions, incorrect charges, missing credits, wallet balance problems, or refund delays.',
    include: ['payment', 'paid', 'transaction', 'charge', 'charged', 'refund', 'refunded', 'wallet', 'balance', 'credit', 'upi', 'debit', 'money', 'amount', 'deducted', 'failed transaction', 'double charge', 'overcharged'],
    contextReq: ['payment', 'paid', 'transaction', 'charge', 'charged', 'refund', 'refunded', 'wallet', 'balance', 'credit', 'upi', 'debit', 'money', 'amount', 'deducted', 'failed', 'double', 'overcharged'],
    exclude: ['login', 'otp', 'password', 'account access', 'sign in', 'crash', 'freeze', 'slot', 'booking'],
    allowPositive: false,
    quoteKeywords: ['payment', 'refund', 'charged', 'wallet', 'balance', 'deducted', 'transaction', 'amount', 'credit', 'failed transaction', 'overcharged'],
    recommendation: {
      title: 'Audit payment, refund, and wallet reliability',
      problem: 'Customers report failed transactions, incorrect charges, missing refunds, and wallet balance discrepancies.',
      action: 'Conduct a payment pipeline audit, add automatic refund tracking with customer-visible status, and implement wallet reconciliation alerts.',
      rationale: 'Money issues destroy trust faster than any other complaint. Unresolved refund requests lead to chargebacks and app store escalation.',
      horizon: 'now',
      successMetric: 'Refund processing time and payment failure rate within 60 days.',
    },
  },
  {
    id: 'customer_support',
    label: 'Customer support & complaint resolution',
    summary: 'Unreachable support, unresolved complaints, delayed responses, or poor escalation.',
    include: ['support', 'customer service', 'help', 'no response', 'no reply', 'contact', 'helpline', 'care', 'grievance', 'complaint', 'complain', 'unresolved', 'escalation', 'escalate', 'called support', 'email support', 'raise complaint'],
    contextReq: ['support', 'customer service', 'no response', 'no reply', 'complaint', 'complain', 'unresolved', 'escalation', 'escalate', 'grievance', 'helpline', 'contact'],
    exclude: ['crash', 'freeze', 'login', 'otp', 'slot', 'booking'],
    allowPositive: false,
    quoteKeywords: ['support', 'no response', 'no reply', 'complaint', 'unresolved', 'escalation', 'customer service', 'grievance', 'helpline'],
    recommendation: {
      title: 'Strengthen support responsiveness and resolution',
      problem: 'Customers cannot reach support or get their complaints resolved in a timely manner.',
      action: 'Implement a support SLA with visible ticket status, add in-app chat, and create an escalation path for unresolved complaints after 48 hours.',
      rationale: 'Poor support amplifies every other complaint. Unresolved issues drive negative reviews and reduce lifetime value.',
      horizon: 'next',
      successMetric: 'Average first-response time and complaint resolution rate within 90 days.',
    },
  },
  {
    id: 'trust_safety_property',
    label: 'Trust, safety & property',
    summary: 'Missing belongings, alleged theft, unsafe conduct, OTP privacy concerns, or incident handling.',
    include: ['stolen', 'theft', 'stole', 'missing', 'lost', 'disappeared', 'belonging', 'item', 'jewellery', 'jewelry', 'anklet', 'chain', 'ring', 'gold', 'silver', 'money stolen', 'unsafe', 'safety', 'security', 'trust', 'otp shared', 'otp given', 'privacy'],
    contextReq: ['stolen', 'theft', 'stole', 'missing', 'lost', 'disappeared', 'belonging', 'item', 'jewellery', 'jewelry', 'anklet', 'chain', 'ring', 'gold', 'silver', 'unsafe', 'safety', 'security', 'trust', 'otp shared', 'otp given', 'privacy'],
    exclude: ['crash', 'freeze', 'bug', 'login', 'password', 'slot', 'booking', 'sync', 'data sync', 'order missing'],
    allowPositive: false,
    quoteKeywords: ['stolen', 'theft', 'missing', 'lost', 'belonging', 'anklet', 'chain', 'jewellery', 'jewelry', 'unsafe', 'safety', 'privacy', 'otp shared', 'trust'],
    recommendation: {
      title: 'Strengthen property safety and incident response',
      problem: 'Customers report missing belongings, alleged theft, and safety concerns during service visits.',
      action: 'Implement professional background checks, a dispute/incident reporting flow with investigation SLA, and OTP privacy controls.',
      rationale: 'Trust is existential for a home services platform. A single unresolved theft claim can deter thousands of potential customers.',
      horizon: 'now',
      successMetric: 'Incident resolution time and complaint-to-verification rate within 60 days.',
    },
  },
  {
    id: 'app_functionality',
    label: 'App functionality & performance',
    summary: 'Crashes, freezes, slow loading, navigation failures, or broken app features.',
    include: ['crash', 'crashes', 'crashed', 'freeze', 'freezes', 'frozen', 'hang', 'hangs', 'hanging', 'unresponsive', 'force close', 'force stop', 'not responding', 'slow', 'lag', 'laggy', 'loading', 'load time', 'takes forever', 'bug', 'buggy', 'glitch', 'broken', 'not working', "doesn't work", 'does not work', 'error', 'app', 'interface', 'ui', 'navigation', 'navigate', 'design', 'confusing', 'hard to use'],
    contextReq: ['crash', 'freeze', 'hang', 'unresponsive', 'force close', 'not responding', 'slow', 'lag', 'loading', 'bug', 'glitch', 'broken', 'not working', "doesn't work", 'error', 'app', 'interface', 'ui', 'navigation', 'confusing', 'hard to use'],
    exclude: ['late', 'delayed', 'no show', 'no-show', "didn't come", 'cancelled', 'incomplete', 'not clean', 'dirty', 'unprofessional', 'rude', 'maid', 'house help', 'househelp', 'cleaning', 'worker', 'professional', 'stolen', 'theft', 'anklet', 'jewellery'],
    allowPositive: false,
    quoteKeywords: ['crash', 'freeze', 'hang', 'slow', 'lag', 'bug', 'glitch', 'broken', 'not working', "doesn't work", 'error', 'loading', 'confusing', 'hard to use'],
    recommendation: {
      title: 'Fix app crashes, performance, and usability issues',
      problem: 'Customers experience app crashes, slow loading, and broken features.',
      action: 'Profile crash reports, reduce cold-start time, and fix top reported bugs by feature area.',
      rationale: 'App issues prevent customers from booking and paying, compounding service delivery problems.',
      horizon: 'next',
      successMetric: 'Crash-free session rate and cold-start time within 90 days.',
    },
  },
  {
    id: 'account_access',
    label: 'Account access & authentication',
    summary: 'Login failures, OTP delivery problems, or inability to access an account.',
    include: ['login', 'log in', 'sign in', 'signin', 'logout', 'log out', 'sign out', 'password', 'otp', 'verification code', 'authentication', 'auth', 'credential', 'cannot login', "can't login", "can't log in", 'login failed', 'otp not received', 'otp not coming'],
    contextReq: ['login', 'log in', 'sign in', 'signin', 'logout', 'log out', 'sign out', 'password', 'otp', 'verification code', 'authentication', 'auth', 'credential', 'login failed', 'otp not received', 'otp not coming'],
    exclude: ['payment', 'refund', 'wallet', 'charge', 'transaction', 'slot', 'booking', 'stolen', 'theft', 'anklet'],
    allowPositive: false,
    quoteKeywords: ['login', 'log in', 'sign in', 'otp', 'password', 'authentication', 'login failed', 'otp not received', 'cannot login'],
    recommendation: {
      title: 'Fix login and OTP delivery reliability',
      problem: 'Customers cannot sign in or receive OTP codes to access their accounts.',
      action: 'Audit OTP delivery with all telecom providers, add fallback authentication methods, and monitor login failure rates.',
      rationale: 'Customers who cannot log in cannot book, pay, or receive service — every downstream metric suffers.',
      horizon: 'now',
      successMetric: 'Login success rate and OTP delivery time within 60 days.',
    },
  },
  {
    id: 'updates_compatibility',
    label: 'Updates & compatibility',
    summary: 'Regressions after updates, version incompatibility, or features broken by a release.',
    include: ['update', 'updated', 'updating', 'new version', 'latest version', 'previous version', 'old version', 'after update', 'regression', 'downgrade', 'update broke', 'broken after update'],
    contextReq: ['update', 'updated', 'new version', 'latest version', 'previous version', 'old version', 'after update', 'regression', 'update broke'],
    exclude: ['login', 'otp', 'payment', 'refund', 'slot', 'booking', 'stolen', 'theft'],
    allowPositive: false,
    quoteKeywords: ['update', 'new version', 'latest version', 'previous version', 'after update', 'regression', 'update broke'],
    recommendation: {
      title: 'Add regression testing for update cycles',
      problem: 'Recent app updates have introduced regressions or broken previously working features.',
      action: 'Implement pre-release regression tests, staged rollout with sentiment monitoring, and a rollback plan.',
      rationale: 'Update regressions erode user trust and generate concentrated negative review bursts.',
      horizon: 'later',
      successMetric: 'Post-update negative review rate within 14 days of each release.',
    },
  },
  {
    id: 'positive_experience',
    label: 'Positive experiences',
    summary: 'Explicit praise for service quality, punctuality, helpful professionals, support, or app usability.',
    include: ['good', 'great', 'excellent', 'amazing', 'wonderful', 'best', 'love', 'loved', 'perfect', 'awesome', 'fantastic', 'happy', 'satisfied', 'recommend', 'highly recommend', 'helpful', 'professional', 'punctual', 'on time', 'clean', 'friendly', 'polite', 'well done', 'good service', 'good app', 'easy to use', 'user friendly', 'user-friendly', 'smooth', 'seamless', '5 star', 'five star'],
    contextReq: [],
    exclude: ['bad', 'worst', 'terrible', 'horrible', 'poor', 'not good', 'not satisfied', 'complaint', 'issue', 'problem', 'failed', 'broken', 'crash'],
    allowPositive: true,
    quoteKeywords: ['good', 'great', 'excellent', 'amazing', 'wonderful', 'best', 'love', 'perfect', 'awesome', 'satisfied', 'recommend', 'helpful', 'punctual', 'on time', 'clean', 'friendly', 'polite', 'smooth', 'seamless'],
    recommendation: {
      title: 'Amplify what customers love',
      problem: 'Customers praise specific aspects of the service and app.',
      action: 'Identify the most-praised features and professionals, replicate those patterns, and highlight them in marketing.',
      rationale: 'Reinforcing strengths is as important as fixing weaknesses — it protects what drives retention.',
      horizon: 'later',
      successMetric: 'Share of positive reviews mentioning specific strengths within 90 days.',
    },
  },
  {
    id: 'other_unclear',
    label: 'Other / unclear',
    summary: 'Feedback that cannot be reliably assigned to a more specific category.',
    include: [],
    contextReq: [],
    exclude: [],
    allowPositive: true,
    quoteKeywords: [],
    recommendation: {
      title: 'Review unclassified feedback manually',
      problem: 'Some reviews could not be confidently assigned to a specific category.',
      action: 'Manually review these reviews to identify emerging issues or gaps in the classification taxonomy.',
      rationale: 'Unclassified reviews may reveal new pain points that the rule-based system does not yet cover.',
      horizon: 'later',
      successMetric: 'Reduction in unclassified review rate over time.',
    },
  },
]

// ===========================================================================
// Classification utilities
// ===========================================================================

const MIN_REVIEWS_FOR_THEME = 2
const MAX_EVIDENCE_QUOTES = 4
const MAX_THEMES = 9
const QUOTE_MAX_LENGTH = 180

const RECENCY_BUCKETS_DAYS = [30, 90, 180] as const
const RECENCY_POINTS = [20, 12, 6, 0] as const

function combineReviewText(review: Review): string {
  return [review.title, review.text].filter(Boolean).join(' ')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(`(?:^|\\W)${escapeRegex(keyword.toLowerCase())}(?:\\W|$)`, 'i')
  return pattern.test(text.toLowerCase())
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => hasKeyword(text, k))
}

function isNegative(rating: StarRating): boolean {
  return rating <= 2
}

// ---------------------------------------------------------------------------
// Sentiment detection
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'best', 'love', 'loved', 'perfect', 'awesome', 'fantastic', 'happy', 'satisfied', 'recommend', 'helpful', 'punctual', 'on time', 'clean', 'friendly', 'polite', 'smooth', 'seamless', 'easy to use', 'user friendly', 'user-friendly', 'well done', 'thank']
const NEGATIVE_WORDS = ['bad', 'worst', 'terrible', 'horrible', 'poor', 'not good', 'not satisfied', 'unsatisfied', 'disappointed', 'disappointing', 'useless', 'waste', 'fraud', 'scam', 'cheat', 'pathetic', 'awful', 'frustrated', 'frustrating', 'angry', 'annoying', 'complaint', 'issue', 'problem', 'failed', 'broken', 'crash', 'stolen', 'rude', 'unprofessional', 'dirty', 'late', 'cancelled', 'no show', 'no response', 'no reply']

function detectSentiment(review: Review): Sentiment {
  const text = combineReviewText(review)
  if (!text.trim()) return 'neutral'

  const positiveCount = POSITIVE_WORDS.filter((w) => hasKeyword(text, w)).length
  const negativeCount = NEGATIVE_WORDS.filter((w) => hasKeyword(text, w)).length

  // Rating is a strong signal
  if (review.rating >= 4 && negativeCount === 0) return 'positive'
  if (review.rating <= 2 && positiveCount === 0) return 'negative'

  if (positiveCount > 0 && negativeCount > 0) return 'mixed'
  if (positiveCount > 0 && negativeCount === 0) return 'positive'
  if (negativeCount > 0 && positiveCount === 0) return 'negative'
  if (review.rating >= 4) return 'positive'
  if (review.rating <= 2) return 'negative'
  return 'neutral'
}

// ---------------------------------------------------------------------------
// Domain detection
// ---------------------------------------------------------------------------

function detectDomain(text: string): 'app' | 'service' | 'both' | 'unclear' {
  const appWords = ['app', 'crash', 'freeze', 'bug', 'login', 'otp', 'loading', 'slow', 'lag', 'ui', 'interface', 'navigation', 'update', 'version', 'error', 'broken', 'not working', "doesn't work"]
  const serviceWords = ['service', 'cleaning', 'maid', 'house help', 'househelp', 'worker', 'professional', 'staff', 'late', 'arrived', 'arrival', 'no show', 'cancelled', 'incomplete', 'dirty', 'unprofessional', 'rude', 'stolen', 'theft', 'belonging', 'anklet']

  const hasApp = hasAny(text, appWords)
  const hasService = hasAny(text, serviceWords)

  if (hasApp && hasService) return 'both'
  if (hasApp) return 'app'
  if (hasService) return 'service'
  return 'unclear'
}

// ---------------------------------------------------------------------------
// Context-aware category matching
// ---------------------------------------------------------------------------

interface CategoryMatch {
  categoryId: CategoryId
  certainty: 'high' | 'low'
  reason: string
}

function matchCategories(review: Review): CategoryMatch[] {
  const text = combineReviewText(review)
  if (!text.trim()) return []

  const sentiment = detectSentiment(review)
  const matches: CategoryMatch[] = []

  for (const rule of TAXONOMY) {
    if (rule.include.length === 0) continue // skip other_unclear

    // Check exclude keywords first (quick reject)
    if (!rule.allowPositive && sentiment === 'positive' && hasAny(text, rule.exclude)) {
      continue
    }

    // A positive review should not match pain categories
    if (!rule.allowPositive && sentiment === 'positive' && review.rating >= 4) {
      // Still allow if the review is genuinely mixed
      if (sentiment === 'positive') continue
    }

    // Must have at least one include keyword
    const includeKeywords = rule.include.filter((k) => hasKeyword(text, k))
    if (includeKeywords.length === 0) continue

    // If contextReq is non-empty, must also have at least one context keyword
    if (rule.contextReq.length > 0) {
      const contextKeywords = rule.contextReq.filter((k) => hasKeyword(text, k))
      if (contextKeywords.length === 0) continue
    }

    // Check exclude keywords (for non-positive categories)
    if (!rule.allowPositive) {
      const excluded = rule.exclude.filter((k) => hasKeyword(text, k))
      // If excluded keywords dominate, skip
      if (excluded.length > includeKeywords.length) continue
    }

    // For positive_experience, require positive sentiment
    if (rule.id === 'positive_experience' && sentiment !== 'positive' && sentiment !== 'mixed') {
      continue
    }
    if (rule.id === 'positive_experience' && review.rating <= 2) {
      continue
    }

    // Certainty: high if multiple include keywords or context match is strong
    const certainty: 'high' | 'low' = includeKeywords.length >= 2 ? 'high' : 'low'

    matches.push({
      categoryId: rule.id,
      certainty,
      reason: `Matched keywords: ${includeKeywords.slice(0, 3).join(', ')}. Sentiment: ${sentiment}.`,
    })
  }

  // If no specific category matched, assign to other_unclear
  if (matches.length === 0) {
    matches.push({
      categoryId: 'other_unclear',
      certainty: 'low',
      reason: 'No specific category matched with sufficient confidence.',
    })
  }

  return matches
}

// ---------------------------------------------------------------------------
// Primary category selection
// ---------------------------------------------------------------------------

function selectPrimary(matches: CategoryMatch[], review: Review): CategoryMatch {
  if (matches.length === 1) return matches[0]

  // Prefer high-certainty matches
  const high = matches.filter((m) => m.certainty === 'high')
  if (high.length === 1) return high[0]
  if (high.length > 1) {
    // Among high-certainty, prefer the one whose domain matches the review
    const text = combineReviewText(review)
    const domain = detectDomain(text)
    const domainPref: Record<CategoryId, 'app' | 'service' | 'both' | 'unclear'> = {
      service_delivery: 'service',
      booking_availability: 'app',
      payments_credits_refunds: 'app',
      customer_support: 'service',
      trust_safety_property: 'service',
      app_functionality: 'app',
      account_access: 'app',
      updates_compatibility: 'app',
      positive_experience: 'unclear',
      other_unclear: 'unclear',
    }
    const domainMatch = high.find((m) => domainPref[m.categoryId] === domain || domainPref[m.categoryId] === 'both')
    return domainMatch ?? high[0]
  }

  // All low certainty — prefer non-other_unclear
  const nonOther = matches.find((m) => m.categoryId !== 'other_unclear')
  return nonOther ?? matches[0]
}

// ---------------------------------------------------------------------------
// Evidence extraction with dual verification
// ---------------------------------------------------------------------------

function extractEvidence(review: Review, rule: CategoryRule, allReviewIds: Set<string>): EvidenceQuote | null {
  const sources: string[] = []
  if (review.title) sources.push(review.title)
  if (review.text) sources.push(review.text)

  for (const source of sources) {
    const lowerSource = source.toLowerCase()
    for (const keyword of rule.quoteKeywords) {
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

      // Quote integrity: must be an exact substring of the original source
      const cleanQuote = quote.replace(/^[…]+|[…]+$/g, '')
      const textuallyValid = source.includes(cleanQuote) || source.includes(quote)
      const reviewExists = allReviewIds.has(review.reviewId)

      const verified = textuallyValid && reviewExists

      // Classification relevance: the quote contains a keyword from the category
      const relevant = verified && hasAny(quote, rule.quoteKeywords)

      const verificationNote = relevant
        ? 'Quote is an exact substring and contextually supports the assigned category.'
        : verified
          ? 'Quote is an exact substring of the review text but contextual relevance to this category could not be established by the rule-based system.'
          : 'Quote does not pass exact-string verification.'

      return {
        reviewId: review.reviewId,
        quote,
        verified,
        relevant,
        verificationNote,
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function recencyPoints(postedAt: string, now: number): number {
  const daysAgo = (now - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)
  for (let i = 0; i < RECENCY_BUCKETS_DAYS.length; i++) {
    if (daysAgo <= RECENCY_BUCKETS_DAYS[i]) return RECENCY_POINTS[i]
  }
  return RECENCY_POINTS[RECENCY_POINTS.length - 1]
}

function confidenceFromScore(score: number, reviewCount: number, uncertainCount: number, relevantEvidenceCount: number): { level: Confidence; basis: string } {
  const certaintyRatio = reviewCount > 0 ? (reviewCount - uncertainCount) / reviewCount : 0
  const evidenceRatio = reviewCount > 0 ? relevantEvidenceCount / reviewCount : 0

  if (score >= 50 && reviewCount >= 4 && certaintyRatio >= 0.6 && evidenceRatio >= 0.3) {
    return {
      level: 'high',
      basis: `Heuristic: score ${score} ≥ 50, ${reviewCount} reviews, ${(certaintyRatio * 100).toFixed(0)}% classified with high certainty, ${(evidenceRatio * 100).toFixed(0)}% have relevant evidence. Not statistically calibrated.`,
    }
  }
  if (score >= 25 && reviewCount >= 3) {
    return {
      level: 'medium',
      basis: `Heuristic: score ${score} ≥ 25, ${reviewCount} reviews. Not statistically calibrated.`,
    }
  }
  return {
    level: 'low',
    basis: `Heuristic: score ${score} < 25 or fewer than 3 reviews. Classification certainty is limited. Not statistically calibrated.`,
  }
}

function buildScoreBreakdown(
  frequencyPoints: number,
  negativityPoints: number,
  recencyPts: number,
  evidencePoints: number,
  reviewCount: number,
  negativeCount: number,
  totalWithText: number,
): PainPointScoreBreakdown {
  const total = Math.min(100, Math.round(frequencyPoints + negativityPoints + recencyPts + evidencePoints))
  return {
    frequencyPoints: Math.round(frequencyPoints * 10) / 10,
    negativityPoints: Math.round(negativityPoints * 10) / 10,
    recencyPoints: Math.round(recencyPts * 10) / 10,
    evidencePoints: Math.round(evidencePoints * 10) / 10,
    total,
    rationale: `Score = frequency (${reviewCount} of ${totalWithText} reviews with text × 40, capped) + negativity (${negativeCount} of ${reviewCount} reviews in theme are negative × 30) + recency (average bucket: ≤30d=20, ≤90d=12, ≤180d=6, >180d=0) + evidence (relevance-verified quotes ÷ min(${reviewCount}, 4) × 10). Capped at 100. This is a heuristic ranking, not a statistically calibrated score.`,
  }
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

export function analyzeReviews(reviews: Review[]): AnalysisResponse {
  const startedAt = Date.now()
  const now = Date.now()

  const allReviewIds = new Set(reviews.map((r) => r.reviewId))
  const reviewsWithText = reviews.filter((r) => (r.title?.trim() || r.text?.trim()) && r.rating)

  // Negative denominator: reviews with rating ≤ 2 AND usable text
  const negativeReviews = reviewsWithText.filter((r) => isNegative(r.rating))
  const negativeDenominator = negativeReviews.length

  // Step 1: Classify each review
  const classifications: ReviewClassification[] = []
  const categoryReviewMap = new Map<CategoryId, Set<string>>()
  const categoryClassifications = new Map<CategoryId, ReviewClassification[]>()

  for (const review of reviewsWithText) {
    const text = combineReviewText(review)
    const matches = matchCategories(review)
    const primary = selectPrimary(matches, review)
    const secondary = matches
      .filter((m) => m.categoryId !== primary.categoryId && m.categoryId !== 'other_unclear')
      .map((m) => m.categoryId)

    const sentiment = detectSentiment(review)
    const domain = detectDomain(text)
    const actionable = sentiment === 'negative' || sentiment === 'mixed'
    const classification: ReviewClassification = {
      reviewId: review.reviewId,
      primaryCategory: primary.categoryId,
      secondaryCategories: secondary,
      sentiment,
      domain,
      actionable,
      certainty: primary.certainty,
      reason: primary.reason,
    }
    classifications.push(classification)

    // Track unique review IDs per category (primary + secondary)
    const allCategories = [primary.categoryId, ...secondary]
    for (const catId of allCategories) {
      if (!categoryReviewMap.has(catId)) {
        categoryReviewMap.set(catId, new Set())
        categoryClassifications.set(catId, [])
      }
      categoryReviewMap.get(catId)!.add(review.reviewId)
      categoryClassifications.get(catId)!.push(classification)
    }
  }

  // Step 2: Build pain points for qualified categories
  const qualifiedCategoryIds: CategoryId[] = []
  let themesSkipped = 0

  for (const rule of TAXONOMY) {
    if (rule.id === 'other_unclear') continue
    const reviewIds = categoryReviewMap.get(rule.id)
    if (!reviewIds || reviewIds.size < MIN_REVIEWS_FOR_THEME) {
      if (reviewIds && reviewIds.size > 0) themesSkipped++
      continue
    }
    qualifiedCategoryIds.push(rule.id)
  }

  const painPoints: PainPoint[] = qualifiedCategoryIds.map((catId) => {
    const rule = TAXONOMY.find((t) => t.id === catId)!
    const uniqueReviewIds = Array.from(categoryReviewMap.get(catId)!)
    const reviewCount = uniqueReviewIds.length
    const themeClassifications = categoryClassifications.get(catId) ?? []

    // Get the actual reviews for this category
    const themeReviews = reviewsWithText.filter((r) => uniqueReviewIds.includes(r.reviewId))

    // Negative count: unique reviews in theme with rating ≤ 2
    const negativeCountInTheme = themeReviews.filter((r) => isNegative(r.rating)).length

    // Uncertain count
    const uncertainCount = themeClassifications.filter((c) => c.certainty === 'low').length

    // Frequency points: (uniqueReviewsInTheme / totalReviewsWithText) × 40, capped at 40
    const frequencyPoints = Math.min(40, (reviewCount / Math.max(reviewsWithText.length, 1)) * 40)

    // Negativity points: (negativeReviewsInTheme / uniqueReviewsInTheme) × 30
    const negativityRatio = reviewCount > 0 ? negativeCountInTheme / reviewCount : 0
    const negativityPoints = negativityRatio * 30

    // Recency points: average recency bucket, max 20
    const avgRecency = reviewCount > 0
      ? themeReviews.reduce((sum, r) => sum + recencyPoints(r.postedAt, now), 0) / reviewCount
      : 0

    // Evidence: extract and verify quotes
    const evidenceQuotes: EvidenceQuote[] = []
    for (const review of themeReviews) {
      if (evidenceQuotes.length >= MAX_EVIDENCE_QUOTES) break
      const eq = extractEvidence(review, rule, allReviewIds)
      if (eq && eq.verified) {
        evidenceQuotes.push(eq)
      }
    }
    const relevantEvidenceCount = evidenceQuotes.filter((eq) => eq.relevant).length
    const evidencePoints = (relevantEvidenceCount / Math.min(reviewCount, MAX_EVIDENCE_QUOTES)) * 10

    const breakdown = buildScoreBreakdown(
      frequencyPoints,
      negativityPoints,
      avgRecency,
      evidencePoints,
      reviewCount,
      negativeCountInTheme,
      reviewsWithText.length,
    )

    // shareOfNegative: uniqueReviewsInTheme / negativeDenominator (overlapping)
    const shareOfNegative = negativeDenominator > 0 ? reviewCount / negativeDenominator : 0

    const { level, basis } = confidenceFromScore(
      breakdown.total,
      reviewCount,
      uncertainCount,
      relevantEvidenceCount,
    )

    return {
      id: catId,
      rank: 0,
      theme: rule.label,
      summary: rule.summary,
      reviewCount,
      shareOfNegative,
      confidence: level,
      confidenceBasis: basis,
      evidence: evidenceQuotes,
      score: breakdown.total,
      scoreBreakdown: breakdown,
      uncertainCount,
    }
  })

  // Sort by score descending, assign ranks
  painPoints.sort((a, b) => b.score - a.score)
  painPoints.forEach((pp, i) => {
    pp.rank = i + 1
  })

  const topPainPoints = painPoints.slice(0, MAX_THEMES)

  // Step 3: Build recommendations
  const recommendations: Recommendation[] = topPainPoints
    .filter((pp) => pp.id !== 'other_unclear')
    .map((pp) => {
      const rule = TAXONOMY.find((t) => t.id === pp.id)!
      const status: 'supported' | 'needs_validation' =
        pp.confidence === 'high' && pp.evidence.filter((e) => e.relevant).length >= 2
          ? 'supported'
          : 'needs_validation'

      return {
        id: `rec-${pp.id}`,
        painPointId: pp.id,
        title: rule.recommendation.title,
        problem: rule.recommendation.problem,
        action: rule.recommendation.action,
        rationale: `${rule.recommendation.rationale} Supported by ${pp.reviewCount} unique reviews with ${pp.evidence.filter((e) => e.relevant).length} relevance-verified quotes.`,
        horizon: rule.recommendation.horizon,
        supportingReviewIds: Array.from(categoryReviewMap.get(pp.id) ?? []),
        priorityRationale: `Heuristic priority based on score ${pp.score}/100 (frequency + negativity + recency + evidence). Confidence: ${pp.confidence} (${pp.confidenceBasis}).`,
        successMetric: rule.recommendation.successMetric,
        status,
      }
    })

  // Step 4: Build limitations
  const reviewsUnclear = classifications.filter((c) => c.primaryCategory === 'other_unclear').length
  const limitations: string[] = [
    'This is a rule-based baseline (v2), not AI-generated analysis. Classification uses keyword matching with contextual rules — it does not have semantic understanding of review text.',
    `Themes require at least ${MIN_REVIEWS_FOR_THEME} matching reviews to appear. Real issues with fewer mentions are not shown.`,
    'Reviews can appear in multiple themes (overlapping). Percentages are NOT mutually exclusive shares.',
    'Confidence is a heuristic label based on score, review count, certainty ratio, and evidence ratio. It is NOT statistically calibrated.',
    'Evidence "verified" means the quote is an exact substring of the review. "Relevant" means the quote contextually supports the category. A quote can be verified but not relevant.',
  ]
  if (reviewsUnclear > 0) {
    limitations.push(`${reviewsUnclear} review${reviewsUnclear === 1 ? '' : 's'} could not be confidently assigned to a specific category and are listed as "Other / unclear."`)
  }
  if (reviewsWithText.length < reviews.length) {
    limitations.push(`${reviews.length - reviewsWithText.length} review${reviews.length - reviewsWithText.length === 1 ? '' : 's'} had no usable text and were excluded from classification.`)
  }
  if (topPainPoints.length === 0) {
    limitations.push('No themes met the evidence threshold. This may mean the reviews are too few, too short, or express issues outside the taxonomy.')
  }

  const taxonomyOutput = TAXONOMY.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.summary,
  }))

  const scoringMethodology =
    'Score (0–100) = frequency (max 40) + negativity (max 30) + recency (max 20) + evidence (max 10). ' +
    'Frequency = uniqueReviewsInTheme / totalReviewsWithText × 40. ' +
    'Negativity = negativeReviewsInTheme / uniqueReviewsInTheme × 30. ' +
    'Recency = average bucket: ≤30d=20, ≤90d=12, ≤180d=6, >180d=0. ' +
    'Evidence = relevance-verified quotes / min(uniqueReviews, 4) × 10. ' +
    'This is a heuristic ranking, not a statistically calibrated score.'

  return {
    method: 'rule_based_v2',
    methodLabel: 'Rule-based analysis v2 (Snabbit taxonomy)',
    methodDescription:
      'Reviews are classified using a Snabbit-specific taxonomy with context-aware keyword rules. Each category requires include keywords plus contextual co-occurrence, and positive reviews are excluded from pain categories. No AI model is involved.',
    limitations,
    taxonomy: taxonomyOutput,
    painPoints: topPainPoints,
    recommendations,
    classifications,
    meta: {
      reviewCount: reviews.length,
      reviewsClassified: reviewsWithText.length,
      reviewsExcluded: reviews.length - reviewsWithText.length,
      reviewsUnclear,
      negativeReviewCount: negativeReviews.length,
      negativeDenominator,
      themesFound: topPainPoints.length,
      themesSkipped,
      overlappingLabels: true,
      analyzedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      scoringMethodology,
    },
  }
}

// ---------------------------------------------------------------------------
// Exported for evaluation use
// ---------------------------------------------------------------------------

export function classifyReview(review: Review): ReviewClassification {
  const matches = matchCategories(review)
  const primary = selectPrimary(matches, review)
  const text = combineReviewText(review)
  return {
    reviewId: review.reviewId,
    primaryCategory: primary.categoryId,
    secondaryCategories: matches
      .filter((m) => m.categoryId !== primary.categoryId && m.categoryId !== 'other_unclear')
      .map((m) => m.categoryId),
    sentiment: detectSentiment(review),
    domain: detectDomain(text),
    actionable: detectSentiment(review) === 'negative' || detectSentiment(review) === 'mixed',
    certainty: primary.certainty,
    reason: primary.reason,
  }
}
