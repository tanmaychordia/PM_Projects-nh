'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useHealth } from '@/hooks/use-health'
import type { IntegrationStatus } from '@/lib/voc/config'
import { cn } from '@/lib/utils'

const statusLabel: Record<IntegrationStatus | 'ok', string> = {
  ok: 'Operational',
  connected: 'Connected',
  not_configured: 'Not configured',
  error: 'Error',
}

export function SystemStatusPanel() {
  const { data, error, isLoading, isValidating, mutate } = useHealth()

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">System status</CardTitle>
        <CardDescription className="text-xs">
          Live from <code className="font-mono">GET /api/health</code>
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => mutate()}
            disabled={isValidating}
            aria-label="Re-run health check"
          >
            <RefreshCw className={cn(isValidating && 'animate-spin')} aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="py-4" aria-live="polite">
        {isLoading && (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}

        {error && !isLoading && (
          <p className="text-xs text-destructive">
            Health check failed: {error instanceof Error ? error.message : 'unknown error'}
          </p>
        )}

        {data && !error && (
          <dl className="flex flex-col divide-y text-xs">
            <StatusRow label="API server" status="ok" />
            <StatusRow label="Review collection" status={data.checks.reviewSource} />
            <StatusRow label="Analysis engine" status={data.checks.analysisEngine} />
            <div className="flex items-center justify-between pt-2.5 text-muted-foreground">
              <dt>Last checked</dt>
              <dd className="font-mono">{new Date(data.timestamp).toLocaleTimeString()}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function StatusRow({ label, status }: { label: string; status: IntegrationStatus | 'ok' }) {
  const healthy = status === 'ok' || status === 'connected'
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="inline-flex items-center gap-1.5 font-medium">
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 rounded-full',
            healthy && 'bg-success',
            status === 'not_configured' && 'bg-warning',
            status === 'error' && 'bg-destructive',
          )}
        />
        {statusLabel[status]}
      </dd>
    </div>
  )
}
