import { Analytics } from '@vercel/analytics/next'
import { AnalysisProvider } from '@/components/dashboard/analysis-provider'
import { AnalysisWorkspace } from '@/components/dashboard/analysis-workspace'
import { AppHeader } from '@/components/dashboard/app-header'
import { AuditPanel } from '@/components/dashboard/audit-panel'
import { DataImportPanel } from '@/components/dashboard/data-import-panel'
import { EvaluationPanel } from '@/components/dashboard/evaluation-panel'
import { EvidencePanel } from '@/components/dashboard/evidence-panel'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { ReviewCollectionProvider } from '@/components/dashboard/review-collection-provider'
import { ReviewsPanel } from '@/components/dashboard/reviews-panel'
import { RoadmapPanel } from '@/components/dashboard/roadmap-panel'
import { SystemStatusPanel } from '@/components/dashboard/system-status-panel'

export default function Page() {
  return (
    <ReviewCollectionProvider>
      <AnalysisProvider>
        <div className="min-h-dvh">
          <AppHeader />
          <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-10">
            <OverviewCards />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <aside className="flex flex-col gap-6 lg:col-span-4 xl:col-span-3" aria-label="Data and system">
                <DataImportPanel />
                <SystemStatusPanel />
                <EvaluationPanel />
                <AuditPanel />
              </aside>

              <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-9">
                <ReviewsPanel />
                <AnalysisWorkspace />
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <EvidencePanel />
                  <RoadmapPanel />
                </div>
              </div>
            </div>
          </main>
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </AnalysisProvider>
    </ReviewCollectionProvider>
  )
}
