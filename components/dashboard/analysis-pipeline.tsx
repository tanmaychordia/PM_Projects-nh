const steps = [
  { label: 'Collect reviews', detail: 'Google Play' },
  { label: 'Cluster themes', detail: 'Group by pain point' },
  { label: 'Verify quotes', detail: 'Match to source text' },
  { label: 'Recommend', detail: 'Prioritized roadmap' },
]

export function AnalysisPipeline() {
  return (
    <ol className="grid grid-cols-4 border-b" aria-label="Analysis pipeline">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="flex items-center gap-2.5 border-r px-4 py-3 last:border-r-0"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-foreground">{step.label}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {step.detail} · Pending
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
