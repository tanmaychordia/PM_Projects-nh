import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const horizons = [
  { label: 'Now', detail: 'High impact, high confidence' },
  { label: 'Next', detail: 'Validate scope' },
  { label: 'Later', detail: 'Monitor signal' },
]

export function RoadmapPanel() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Roadmap recommendations</CardTitle>
        <CardDescription className="text-xs">
          Actions derived from ranked pain points, with supporting review counts
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 py-4">
        {horizons.map((horizon) => (
          <section
            key={horizon.label}
            aria-label={`${horizon.label} recommendations`}
            className="flex min-h-40 flex-col rounded-md border border-dashed bg-surface/60"
          >
            <header className="flex flex-col gap-0.5 border-b border-dashed px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{horizon.label}</span>
              <span className="text-[11px] text-muted-foreground">{horizon.detail}</span>
            </header>
            <p className="flex flex-1 items-center justify-center px-3 text-center text-[11px] text-muted-foreground/80">
              No recommendations
            </p>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
