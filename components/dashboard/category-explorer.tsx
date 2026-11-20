'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { buildTaxonomyExport, getParentIdForChild } from '@/lib/voc/taxonomy-export'
import type { CategoryId, ParentCategoryId } from '@/lib/voc/types'
import { useAnalysis } from './analysis-provider'

export function CategoryExplorer() {
  const { state, selectedCategoryId, selectCategory } = useAnalysis()
  const [activeParentId, setActiveParentId] = useState<ParentCategoryId>(
    'app_digital_experience',
  )

  const taxonomy = useMemo(() => buildTaxonomyExport(), [])
  const classifications = state.status === 'success' ? state.result.classifications : []

  const activeParent = taxonomy.parents.find((p) => p.id === activeParentId) ?? taxonomy.parents[0]
  const childCategories = useMemo(
    () => taxonomy.children.filter((c) => c.parent === activeParent.id),
    [taxonomy.children, activeParent.id],
  )

  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>()
    for (const c of classifications) {
      const ids = new Set([c.primaryCategory, ...c.secondaryCategories])
      for (const id of ids) {
        map.set(id, (map.get(id) ?? 0) + 1)
      }
    }
    return map
  }, [classifications])

  const handleParentSelect = (parentId: ParentCategoryId) => {
    if (parentId === activeParentId) return
    setActiveParentId(parentId)
    if (selectedCategoryId && getParentIdForChild(selectedCategoryId) !== parentId) {
      selectCategory(null)
    }
  }

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label="Parent categories"
        className="flex gap-1 overflow-x-auto border-b px-4 py-2"
      >
        {taxonomy.parents.map((parent) => {
          const isActive = parent.id === activeParentId
          return (
            <button
              key={parent.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => handleParentSelect(parent.id)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {parent.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{activeParent.description}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Child categories">
          {childCategories.map((child) => {
            const isSelected = child.id === selectedCategoryId
            const count = counts.get(child.id) ?? 0
            return (
              <button
                key={child.id}
                type="button"
                aria-pressed={isSelected}
                title={child.description}
                onClick={() => selectCategory(isSelected ? null : child.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-left text-xs transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                    : 'border-border bg-surface text-foreground hover:border-primary/40',
                )}
              >
                <span className="font-medium">{child.label}</span>
                <span
                  className={cn(
                    'rounded-4xl px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
