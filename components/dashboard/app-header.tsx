'use client'

import { AudioLines } from 'lucide-react'
import { useHealth } from '@/hooks/use-health'
import { APP_NAME } from '@/lib/voc/config'
import { cn } from '@/lib/utils'
import { useReviewCollection } from './review-collection-provider'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <AudioLines className="size-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">{APP_NAME}</h1>
            <p className="text-xs text-muted-foreground">
              Evidence-backed product insights from customer reviews
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ApiStatusPill />
          <DataStatusPill />
        </div>
      </div>
    </header>
  )
}

function DataStatusPill() {
  const { state } = useReviewCollection()

  const view = {
    idle: { label: 'No reviews loaded', tone: 'warning' },
    loading: {
      label: state.status === 'loading' && state.progress
        ? 'Fetching from Google Play…'
        : 'Loading reviews…',
      tone: 'neutral',
    },
    success: {
      label: state.status === 'success'
        ? state.source === 'storage'
          ? `${state.result.retainedCount} reviews (stored)`
          : `${state.result.retainedCount} reviews loaded`
        : '',
      tone: 'success',
    },
    error: { label: 'Fetch failed', tone: 'error' },
  }[state.status]

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium',
        view.tone === 'warning' && 'border-warning/40 bg-warning/10 text-warning-foreground',
        view.tone === 'neutral' && 'bg-card text-muted-foreground',
        view.tone === 'success' && 'border-success/30 bg-success/5 text-success',
        view.tone === 'error' && 'border-destructive/30 bg-destructive/5 text-destructive',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          view.tone === 'warning' && 'bg-warning',
          view.tone === 'neutral' && 'animate-pulse bg-muted-foreground/50',
          view.tone === 'success' && 'bg-success',
          view.tone === 'error' && 'bg-destructive',
        )}
      />
      {view.label}
    </div>
  )
}

function ApiStatusPill() {
  const { data, error, isLoading } = useHealth()

  const state = error ? 'down' : isLoading || !data ? 'checking' : 'up'
  const label = { up: 'API healthy', down: 'API unreachable', checking: 'Checking API' }[state]

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          state === 'up' && 'bg-success',
          state === 'down' && 'bg-destructive',
          state === 'checking' && 'animate-pulse bg-muted-foreground/50',
        )}
      />
      {label}
    </div>
  )
}
