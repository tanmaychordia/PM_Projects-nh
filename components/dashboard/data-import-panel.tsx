'use client'

import { AlertCircle, CheckCircle2, CloudDownload, ExternalLink, Info, Loader2, Package } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAY_STORE_PACKAGE_ID, PLAY_STORE_URL, REVIEW_FETCH } from '@/lib/voc/config'
import { useReviewCollection } from './review-collection-provider'

export function DataImportPanel() {
  const { state, fetchReviews } = useReviewCollection()
  const lastFetch = state.status === 'success' ? new Date(state.result.fetchedAt).toLocaleString() : 'Not in this session'

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
          <dt className="text-muted-foreground">Storefront</dt>
          <dd className="font-mono uppercase text-foreground">
            {REVIEW_FETCH.country} · {REVIEW_FETCH.language}
          </dd>
          <dt className="text-muted-foreground">Order · limit</dt>
          <dd className="text-foreground">Newest first · max {REVIEW_FETCH.maxReviews}</dd>
          <dt className="text-muted-foreground">Last fetch</dt>
          <dd className="text-muted-foreground">{lastFetch}</dd>
        </dl>

        <p className="flex gap-2 rounded-md bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Reviews are collected live from Google Play on the server. Results are held in this browser session only
            and are not stored in a database yet.
          </span>
        </p>

        <Button onClick={fetchReviews} disabled={state.status === 'loading'} className="w-full" size="lg">
          {state.status === 'loading' ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Fetching from Google Play…
            </>
          ) : (
            <>
              <CloudDownload aria-hidden="true" />
              {state.status === 'success' ? 'Fetch again' : 'Fetch reviews'}
            </>
          )}
        </Button>

        <div aria-live="polite">
          {state.status === 'error' && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="text-xs font-semibold">Fetch failed</AlertTitle>
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
              <AlertTitle className="text-xs font-semibold">
                {state.result.retainedCount > 0 ? 'Reviews fetched' : 'Fetch completed — no reviews returned'}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {state.result.fetchedCount} returned by Google Play · {state.result.retainedCount} retained
                {state.result.duplicateCount > 0 && ` · ${state.result.duplicateCount} duplicates removed`}
                {state.result.invalidCount > 0 && ` · ${state.result.invalidCount} invalid dropped`}
                {` · ${(state.result.durationMs / 1000).toFixed(1)}s`}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
