import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AnalysisPipeline } from './analysis-pipeline'

const painPointColumns = [
  { label: 'Rank', className: 'w-14' },
  { label: 'Theme / pain point', className: '' },
  { label: 'Reviews', className: 'w-24 text-right' },
  { label: 'Share of negative', className: 'w-36 text-right' },
  { label: 'Confidence', className: 'w-28' },
  { label: 'Evidence', className: 'w-28 text-right' },
]

export function AnalysisWorkspace() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">Analysis workspace</CardTitle>
        <CardDescription className="text-xs">
          Ranked pain points, each linked to the source reviews that support it
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            No analysis run
          </Badge>
        </CardAction>
      </CardHeader>

      <AnalysisPipeline />

      <CardContent className="px-0">
        <Table>
          <caption className="sr-only">Ranked pain points</caption>
          <TableHeader>
            <TableRow className="bg-surface hover:bg-surface">
              {painPointColumns.map((col) => (
                <TableHead
                  key={col.label}
                  className={`h-9 px-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${col.className}`}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={painPointColumns.length} className="p-0">
                <EmptyState />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full border bg-surface">
        <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-sm font-medium text-foreground">No pain points yet</p>
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground whitespace-normal">
          Ranked pain points and recommendations will appear here after reviews are collected and
          analyzed. Every finding will cite review IDs and verbatim quotes so it can be checked
          against the source.
        </p>
      </div>
    </div>
  )
}
