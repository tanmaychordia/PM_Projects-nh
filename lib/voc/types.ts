import type { IntegrationStatus } from './config'

export interface Review {
  reviewId: string
  rating: 1 | 2 | 3 | 4 | 5
  text: string
  postedAt: string
  appVersion: string | null
  thumbsUpCount: number
}

export interface EvidenceQuote {
  reviewId: string
  quote: string
  verified: boolean
}

export type Confidence = 'high' | 'medium' | 'low'

export interface PainPoint {
  id: string
  rank: number
  theme: string
  summary: string
  reviewCount: number
  shareOfNegative: number
  confidence: Confidence
  evidence: EvidenceQuote[]
}

export interface Recommendation {
  id: string
  painPointId: string
  title: string
  rationale: string
  horizon: 'now' | 'next' | 'later'
  supportingReviewIds: string[]
}

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

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
  }
}

export interface FetchReviewsSuccess {
  packageId: string
  fetchedCount: number
  fetchedAt: string
}
