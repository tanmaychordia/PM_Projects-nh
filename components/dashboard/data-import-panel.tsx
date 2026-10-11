'use client'

import { AlertCircle, CheckCircle2, CloudDownload, Database, ExternalLink, Info, Loader2, Package, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAY_STORE_PACKAGE_ID, PLAY_STORE_URL, REVIEW_FETCH } from '@/lib/voc/config'
import type { CollectionWarning } from '@/lib/voc/types'
import { useReviewCollection } from './review-collection-provider'

function isStorageSource(state: { status: string; source?: string }): boolean {
  return state.status === 'success' && state.source === 'storage'
}

function WarningList({ warnings }: { warnings: CollectionWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {warnings.map((w, i) => (
        <span key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-3 shrink-0 text-warning" aria-hidden="true" />
          {w.message}
        </span>
      ))}
    </div>
  )
}

export function DataImportPanel() {
  const { state, fetchReviews } = useReviewCollection()
  const lastFetch = state.status === 'success' ? new Date(state.result.fetchedAt).toLocaleString() : 'Not yet'
  const fromStorage = isStorageSource(state)

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
          <dd className="text-foreground">Newest + helpfulness · target {REVIEW_FETCH.targetUniqueReviews}</dd>
          <dt className="text-muted-foreground">Last fetch</dt>
          <dd className="text-muted-foreground">{lastFetch}</dd>
        </dl>

        <p className="flex gap-2 rounded-md bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {fromStorage ? (
            <>
              <Database className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Reviews shown below were loaded from the database. They persist across page refreshes.
                Fetch again to pull the latest reviews from Google Play.
              </span>
            </>
          ) : (
            <>
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Reviews are collected live from Google Play on the server and saved to the database automatically.
                Previously saved reviews are loaded when you open or refresh this page.
              </span>
            </>
          )}
        </p>

        <Button onClick={fetchReviews} disabled={state.status === 'loading'} className="w-full" size="lg">
          {state.status === 'loading' ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              {fromStorage ? 'Loading from database…' : 'Fetching from Google Play…'}
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
            <Alert className={fromStorage ? 'border-primary/30 bg-primary/5 text-primary' : 'border-success/30 bg-success/5 text-success'}>
              {fromStorage ? <Database aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              <AlertTitle className="text-xs font-semibold">
                {fromStorage
                  ? `${state.result.retainedCount} reviews loaded from database`
                  : state.result.retainedCount > 0
                    ? 'Reviews fetched and saved'
                    : 'Fetch completed — no reviews returned'}
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-1.5 text-xs">
                {fromStorage ? (
                  <span>
                    Loaded from the last collection run on {new Date(state.result.fetchedAt).toLocaleString()}.
                    Fetch again to pull fresh reviews from Google Play.
                  </span>
                ) : (
                  <span>
                    {state.result.fetchedCount} returned by Google Play · {state.result.retainedCount} retained
                    {state.result.duplicateCount > 0 && ` · ${state.result.duplicateCount} duplicates removed`}
                    {state.result.invalidCount > 0 && ` · ${state.result.invalidCount} invalid dropped`}
                    {` · ${(state.result.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
                {!fromStorage && !state.result.targetReached && state.result.retainedCount > 0 && (
                  <span className="text-[11px] text-warning-foreground">
                    Collected {state.result.retainedCount} of {state.result.targetUniqueCount} target.
                  </span>
                )}
                {!fromStorage && !state.result.complete && (
                  <span className="text-[11px] text-warning-foreground">
                    Collection was incomplete — some passes encountered errors.
                  </span>
                )}
                {state.result.warnings.length > 0 && <WarningList warnings={state.result.warnings} />}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
