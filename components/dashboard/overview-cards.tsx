import { BadgeCheck, Layers, MessageSquareText, ScanSearch, type LucideIcon } from 'lucide-react'

interface Metric {
  label: string
  description: string
  icon: LucideIcon
}

const metrics: Metric[] = [
  {
    label: 'Total reviews',
    description: 'Collected from Google Play',
    icon: MessageSquareText,
  },
  {
    label: 'Analyzed reviews',
    description: 'Processed for themes and sentiment',
    icon: ScanSearch,
  },
  {
    label: 'Themes identified',
    description: 'Distinct, evidence-backed clusters',
    icon: Layers,
  },
  {
    label: 'Quote verification rate',
    description: 'Quotes matched verbatim to source reviews',
    icon: BadgeCheck,
  },
]

export function OverviewCards() {
  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">
        Overview
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex flex-col gap-3 bg-card p-4">
            <div className="flex items-center justify-between">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </dt>
              <metric.icon className="size-4 text-muted-foreground/70" aria-hidden="true" />
            </div>
            <dd className="flex flex-col gap-1">
              <span className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground/50">
                <span aria-hidden="true">{'—'}</span>
                <span className="sr-only">No data yet</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {metric.description}
                <span className="text-muted-foreground/70">{' · Awaiting data'}</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
