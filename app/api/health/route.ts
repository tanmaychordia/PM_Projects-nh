import { APP_NAME, APP_VERSION, integrations } from '@/lib/voc/config'
import type { HealthResponse } from '@/lib/voc/types'

export const dynamic = 'force-dynamic'

export function GET() {
  const body: HealthResponse = {
    status: 'ok',
    service: APP_NAME,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    runtime: `node ${process.version}`,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    checks: {
      api: 'ok',
      reviewSource: integrations.reviewSource.status,
      analysisEngine: integrations.analysisEngine.status,
    },
  }

  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
