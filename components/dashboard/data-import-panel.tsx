'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, CloudDownload, ExternalLink, Loader2, Package } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAY_STORE_PACKAGE_ID, PLAY_STORE_URL } from '@/lib/voc/config'
import type { ApiErrorResponse, FetchReviewsSuccess } from '@/lib/voc/types'

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: FetchReviewsSuccess }
  | { status: 'error'; code: string; message: string; at: string }

export function DataImportPanel() {
  const [state, setState] = useState<FetchState>({ status: 'idle' })

  async function handleFetch() {
    setState({ status: 'loading' })
    const at = new Date().toISOString()
    try {
      const res = await fetch('/api/reviews/fetch', { method: 'POST', cache: 'no-store' })
      const body = await res.json().catch(() => null)

      if (res.ok && body && typeof body.fetchedCount === 'number') {
        setState({ status: 'success', result: body as FetchReviewsSuccess })
        return
      }

      const error = (body as ApiErrorResponse | null)?.error
      setState({
        status: 'error',
        code: error?.code ?? `HTTP_${res.status}`,
        message: error?.message ?? `The server responded with HTTP ${res.status}. No reviews were fetched.`,
        at,
      })
    } catch {
      setState({
        status: 'error',
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection and try again. No reviews were fetched.',
        at,
      })
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Data import</CardTitle>
        <CardDescription className="text-xs">Source: Google Play Store reviews</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 py-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-xs">
          <dt className="text-muted-foreground">Package ID</dt>
          <dd className="flex items-center gap-1.5 font-mono text-foreground">
            <Package className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {PLAY_STORE_PACKAGE_ID}
          </dd>
          <dt className="text-muted-foreground">Store listing</dt>
          <dd>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Open on Google Play
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </dd>
          <dt className="text-muted-foreground">Connection</dt>
          <dd className="inline-flex items-center gap-1.5 font-medium text-warning-foreground">
            <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
            Not connected
          </dd>
          <dt className="text-muted-foreground">Last fetch</dt>
          <dd className="text-muted-foreground">Never</dd>
        </dl>

        <p className="rounded-md bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {
            'Google Play review collection has not been connected yet. Fetching is wired to a real server endpoint, which currently reports that no collector is configured — no reviews will be imported or simulated.'
          }
        </p>

        <Button onClick={handleFetch} disabled={state.status === 'loading'} className="w-full" size="lg">
          {state.status === 'loading' ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Fetching reviews…
            </>
          ) : (
            <>
              <CloudDownload aria-hidden="true" />
              Fetch reviews
            </>
          )}
        </Button>

        <div aria-live="polite">
          {state.status === 'error' && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="text-xs font-semibold">Fetch not completed</AlertTitle>
              <AlertDescription className="flex flex-col gap-1.5 text-xs">
                <span>{state.message}</span>
                <span className="font-mono text-[11px] text-destructive/80">
                  {state.code} · {new Date(state.at).toLocaleTimeString()}
                </span>
              </AlertDescription>
            </Alert>
          )}
          {state.status === 'success' && (
            <Alert className="border-success/30 bg-success/5 text-success">
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle className="text-xs font-semibold">Reviews fetched</AlertTitle>
              <AlertDescription className="text-xs">
                {state.result.fetchedCount.toLocaleString()} reviews collected for {state.result.packageId}.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
