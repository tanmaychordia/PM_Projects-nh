import { cn } from '@/lib/utils'

const steps = [
  { label: 'Collect reviews', detail: 'Google Play' },
  { label: 'Cluster themes', detail: 'Group by pain point' },
  { label: 'Verify quotes', detail: 'Match to source text' },
  { label: 'Recommend', detail: 'Prioritized roadmap' },
] as const

type StepStatus = 'pending' | 'active' | 'done'

export function AnalysisPipeline({
  stepStatuses,
}: {
  stepStatuses?: readonly StepStatus[]
}) {
  const statuses: StepStatus[] = (stepStatuses ?? steps.map(() => 'pending')) as StepStatus[]

  return (
    <ol className="grid grid-cols-4 border-b" aria-label="Analysis pipeline">
      {steps.map((step, index) => {
        const status = statuses[index] ?? 'pending'
        return (
          <li
            key={step.label}
            className="flex items-center gap-2.5 border-r px-4 py-3 last:border-r-0"
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
                status === 'done' && 'border-success bg-success/10 text-success',
                status === 'active' && 'border-primary bg-primary/10 text-primary',
                status === 'pending' && 'text-muted-foreground',
              )}
            >
              {status === 'done' ? '✓' : index + 1}
            </span>
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  'truncate text-xs font-medium',
                  status === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {step.detail} · {status === 'done' ? 'Done' : status === 'active' ? 'Running…' : 'Pending'}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
