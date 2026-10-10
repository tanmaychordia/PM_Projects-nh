export const APP_NAME = 'Snabbit VoC Copilot'
export const APP_VERSION = '0.2.0'

export const PLAY_STORE_PACKAGE_ID = 'com.snabbit.customer'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`

export const REVIEW_FETCH = {
  country: 'in',
  language: 'en',
  sort: 'newest',
  maxReviews: 20,
  perRequestTimeoutMs: 10_000,
  totalTimeoutMs: 20_000,
  upstreamRetries: 1,
  cooldownSeconds: 15,
} as const

export type IntegrationStatus = 'connected' | 'not_configured' | 'error'

export const integrations = {
  reviewSource: {
    name: 'Google Play review collection',
    status: 'connected' as IntegrationStatus,
  },
  analysisEngine: {
    name: 'Theme & pain-point analysis',
    status: 'not_configured' as IntegrationStatus,
  },
}
