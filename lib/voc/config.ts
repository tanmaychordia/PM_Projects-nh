export const APP_NAME = 'Snabbit VoC Copilot'
export const APP_VERSION = '0.1.0'

export const PLAY_STORE_PACKAGE_ID = 'com.snabbit.customer'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`

export type IntegrationStatus = 'connected' | 'not_configured' | 'error'

export const integrations = {
  reviewSource: {
    name: 'Google Play review collection',
    status: 'not_configured' as IntegrationStatus,
  },
  analysisEngine: {
    name: 'Theme & pain-point analysis',
    status: 'not_configured' as IntegrationStatus,
  },
}
