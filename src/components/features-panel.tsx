import { ArrowLeft, ArrowRight, Minus } from 'lucide-react'

import { featureColor, featureLocationText } from '@/lib/feature-colors'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useViewerStore } from '@/store/viewer'

/** Table of annotated features; clicking one highlights it in the sequence. */
export function FeaturesPanel() {
  const doc = useViewerStore((s) => s.doc)
  const selectedFeature = useViewerStore((s) => s.selectedFeature)
  const selectFeature = useViewerStore((s) => s.selectFeature)
  if (!doc || doc.features.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">
        {t.features} <span className="text-muted-foreground font-normal">({doc.features.length})</span>
      </h2>
      <div className="max-h-64 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 z-10 text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">{t.featureName}</th>
              <th className="px-3 py-2 font-medium">{t.featureType}</th>
              <th className="px-3 py-2 font-medium">{t.featureLocation}</th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {doc.features.map((feature, i) => {
              const StrandIcon = feature.strand === 1 ? ArrowRight : feature.strand === -1 ? ArrowLeft : Minus
              return (
                <tr
                  key={i}
                  onClick={() => selectFeature(selectedFeature === i ? null : i)}
                  className={cn(
                    'hover:bg-accent/60 cursor-pointer border-t',
                    selectedFeature === i && 'bg-accent',
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: featureColor(feature) }} />
                      <span className="truncate">{feature.name}</span>
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-1.5">{feature.type}</td>
                  <td
                    className="text-muted-foreground max-w-80 truncate px-3 py-1.5 font-mono text-xs"
                    title={featureLocationText(feature)}
                  >
                    {featureLocationText(feature)}
                  </td>
                  <td className="text-muted-foreground px-3 py-1.5">
                    <StrandIcon className="size-3.5" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
