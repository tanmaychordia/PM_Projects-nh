'use client'

import useSWR from 'swr'
import type { HealthResponse } from '@/lib/voc/types'

async function fetchHealth(url: string): Promise<HealthResponse> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`)
  }
  return res.json()
}

export function useHealth() {
  return useSWR<HealthResponse>('/api/health', fetchHealth, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  })
}
