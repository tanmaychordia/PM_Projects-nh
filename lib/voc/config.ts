export const APP_NAME = 'Snabbit VoC Copilot'
export const APP_VERSION = '0.4.0'

export const PLAY_STORE_PACKAGE_ID = 'com.snabbit.customer'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`

export const SCRAPER = { name: '@mradex77/google-play-scraper', version: '1.4.0' } as const

export type CollectionSort = 'newest' | 'helpfulness'

export interface CollectionPassPlan {
  sort: CollectionSort
  /** The pass stops once the run's cumulative unique count reaches this number. */
  cumulativeUniqueBudget: number
  maxPages: number
}

export const REVIEW_FETCH = {
  country: 'in',
  language: 'en',
  targetUniqueReviews: 500,
  /** Google Play returns at most ~150 reviews per paginated request. */
  pageSize: 150,
  passes: [
    { sort: 'newest', cumulativeUniqueBudget: 350, maxPages: 4 },
    { sort: 'helpfulness', cumulativeUniqueBudget: 500, maxPages: 4 },
  ] satisfies CollectionPassPlan[],
  pauseBetweenRequestsMs: 750,
  perRequestTimeoutMs: 10_000,
  upstreamRetries: 1,
  totalDeadlineMs: 40_000,
  cooldownSeconds: 30,
  /** Reviews with no text or at most this many words are flagged as low-information. */
  lowInformationMaxWords: 3,
} as const

export const SAMPLING_NOTE =
  'Reviews were collected newest-first, then by Google Play helpfulness ranking. This is not a random or representative sample of all customers: it over-represents recent reviewers and reviews other users voted helpful.'

export type IntegrationStatus = 'connected' | 'not_configured' | 'error'

export const integrations = {
  reviewSource: {
    name: 'Google Play review collection',
    status: 'connected' as IntegrationStatus,
  },
  analysisEngine: {
    name: 'Theme & pain-point analysis',
    status: 'connected' as IntegrationStatus,
  },
}
