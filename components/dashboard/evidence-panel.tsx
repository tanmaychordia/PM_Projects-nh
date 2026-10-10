import { Quote } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const fields = ['Review ID', 'Verbatim quote', 'Rating', 'Verified']

export function EvidencePanel() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Evidence</CardTitle>
        <CardDescription className="text-xs">
          Verbatim quotes, each traceable to a Google Play review ID
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col px-0">
        <div className="grid grid-cols-[7rem_1fr_3.5rem_4.5rem] gap-3 border-b bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {fields.map((field) => (
            <span key={field}>{field}</span>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Quote className="size-4 text-muted-foreground/60" aria-hidden="true" />
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Select a pain point to inspect its supporting quotes. Quotes are only shown when they
            match the original review text exactly.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
