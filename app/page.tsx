import { AnalysisWorkspace } from '@/components/dashboard/analysis-workspace'
import { AppHeader } from '@/components/dashboard/app-header'
import { DataImportPanel } from '@/components/dashboard/data-import-panel'
import { EvidencePanel } from '@/components/dashboard/evidence-panel'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { RoadmapPanel } from '@/components/dashboard/roadmap-panel'
import { SystemStatusPanel } from '@/components/dashboard/system-status-panel'

export default function Page() {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-6">
        <OverviewCards />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="flex flex-col gap-6 lg:col-span-4 xl:col-span-3" aria-label="Data and system">
            <DataImportPanel />
            <SystemStatusPanel />
          </aside>

          <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-9">
            <AnalysisWorkspace />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <EvidencePanel />
              <RoadmapPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
