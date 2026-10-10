import type { FetchReviewsSuccess } from './types'

export const EXPORT_SCHEMA_VERSION = 1

export function buildReviewExport(result: FetchReviewsSuccess) {
  const { reviews, ...collection } = result
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    collection,
    reviews,
  }
}

export function downloadReviewExport(result: FetchReviewsSuccess) {
  const payload = buildReviewExport(result)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = result.fetchedAt.replace(/[:.]/g, '-')
  const link = document.createElement('a')
  link.href = url
  link.download = `${result.packageId}-reviews-${result.storefront.country}-${result.storefront.language}-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
