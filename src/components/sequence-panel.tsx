import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { baseColor } from '@/lib/chromatogram'
import { featureColor, isDisplayedFeature } from '@/lib/feature-colors'
import type { SequenceDocument } from '@/lib/formats'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme'
import { useViewerStore } from '@/store/viewer'

const BASES_PER_LINE = 60
const GROUP = 10
/** Must match the row's rendered height (h-6). */
const LINE_HEIGHT = 24
/** Extra lines rendered above and below the visible area. */
const OVERSCAN = 8

/**
 * Background per base from the features covering it (the first listed
 * feature wins); the selected feature is drawn on top with a stronger tint.
 */
function featureTints(doc: SequenceDocument, selectedFeature: number | null): (string | undefined)[] {
  const tints: (string | undefined)[] = new Array(doc.sequence.length)
  const paint = (index: number, selected: boolean) => {
    const feature = doc.features[index]
    const base = featureColor(feature)
    // Selected: stronger tint plus a solid underline, keeping the letters readable.
    const color = selected ? `linear-gradient(to top, ${base} 0 2px, ${base}47 2px)` : `${base}26`
    for (const { start, end } of feature.segments) {
      for (let i = start; i < end; i++) if (selected || tints[i] === undefined) tints[i] = color
    }
  }
  doc.features.forEach((feature, i) => {
    if (isDisplayedFeature(feature)) paint(i, false)
  })
  if (selectedFeature !== null) paint(selectedFeature, true)
  return tints
}

/** Full sequence as text, rendering only the visible lines; clicking a base selects it. */
export function SequencePanel() {
  const doc = useViewerStore((s) => s.doc)
  const selectedIndex = useViewerStore((s) => s.selectedIndex)
  const selectedFeature = useViewerStore((s) => s.selectedFeature)
  const setSelectedIndex = useViewerStore((s) => s.setSelectedIndex)
  const dark = useThemeStore((s) => s.theme === 'dark')
  const containerRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(288)
  const [copied, setCopied] = useState(false)

  const tints = useMemo(() => (doc ? featureTints(doc, selectedFeature) : []), [doc, selectedFeature])
  const lineCount = doc ? Math.ceil(doc.sequence.length / BASES_PER_LINE) : 0

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [doc])

  // New file: back to the top (the scroll event updates scrollTop state).
  useLayoutEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0
  }, [doc])

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      if (containerRef.current) setScrollTop(containerRef.current.scrollTop)
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Keep the selected base in view, scrolling only this panel (never the page).
  useEffect(() => {
    const el = containerRef.current
    if (!el || selectedIndex === null) return
    const top = Math.floor(selectedIndex / BASES_PER_LINE) * LINE_HEIGHT
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - 2 * LINE_HEIGHT) {
      el.scrollTop = top - el.clientHeight / 2
    }
  }, [selectedIndex, doc])

  if (!doc) return null

  const first = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
  const last = Math.min(lineCount, Math.ceil((scrollTop + viewHeight) / LINE_HEIGHT) + OVERSCAN)
  const lines = []
  for (let line = first; line < last; line++) {
    const start = line * BASES_PER_LINE
    const groups = []
    for (let g = start; g < Math.min(start + BASES_PER_LINE, doc.sequence.length); g += GROUP) {
      const chars = []
      for (let i = g; i < Math.min(g + GROUP, doc.sequence.length); i++) {
        const q = doc.qualities[i]
        chars.push(
          <span
            key={i}
            data-index={i}
            className={cn(
              'cursor-pointer rounded-sm hover:bg-accent',
              q !== undefined && q < 20 && 'opacity-50',
              i === selectedIndex && 'ring-1 ring-yellow-500 bg-yellow-300/70 dark:bg-yellow-400/30',
            )}
            style={{ color: baseColor(doc.sequence[i], dark), background: i === selectedIndex ? undefined : tints[i] }}
          >
            {doc.sequence[i]}
          </span>,
        )
      }
      groups.push(
        <span key={g} className="mr-[1ch]">
          {chars}
        </span>,
      )
    }
    lines.push(
      <div key={line} className="flex h-6 whitespace-nowrap">
        <span className="text-muted-foreground mr-3 inline-block w-[7ch] shrink-0 text-right select-none">
          {start + 1}
        </span>
        <span>{groups}</span>
      </div>,
    )
  }

  const copy = async () => {
    await navigator.clipboard.writeText(doc.sequence)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t.sequence}</h2>
        <Button variant="ghost" size="sm" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? t.copied : t.copySequence}
        </Button>
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="bg-muted/40 relative max-h-72 overflow-auto rounded-lg border px-3 font-mono text-sm leading-6"
        onClick={(e) => {
          const index = (e.target as HTMLElement).dataset.index
          if (index !== undefined) setSelectedIndex(Number(index))
        }}
      >
        <div className="relative my-3" style={{ height: lineCount * LINE_HEIGHT }}>
          <div className="absolute inset-x-0" style={{ top: first * LINE_HEIGHT }}>
            {lines}
          </div>
        </div>
      </div>
    </div>
  )
}
