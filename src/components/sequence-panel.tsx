import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Rows2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { baseColor } from '@/lib/chromatogram'
import { featureColor, isDisplayedFeature } from '@/lib/feature-colors'
import type { SequenceDocument } from '@/lib/formats'
import { t } from '@/lib/i18n'
import { complementBase } from '@/lib/sequence'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme'
import { useViewerStore } from '@/store/viewer'

const BASES_PER_LINE = 60
const GROUP = 10
/** Must match a strand row's rendered height (h-6). */
const ROW_HEIGHT = 24
/** Space between double-stranded blocks. */
const BLOCK_GAP = 10
/** Extra lines rendered above and below the visible area. */
const OVERSCAN = 8

type Tints = (string | undefined)[]

/**
 * Background per base from the features covering it (the first listed
 * feature wins); the selected feature is drawn on top with a stronger tint.
 * With both strands shown, reverse-strand features are painted on the
 * bottom strand and strandless ones on both.
 */
function featureTints(
  doc: SequenceDocument,
  selectedFeature: number | null,
  doubleStrand: boolean,
): { top: Tints; bottom: Tints } {
  const top: Tints = new Array(doc.sequence.length)
  const bottom: Tints = doubleStrand ? new Array(doc.sequence.length) : []
  const paint = (index: number, selected: boolean) => {
    const feature = doc.features[index]
    const base = featureColor(feature)
    // Selected: stronger tint plus a solid underline, keeping the letters readable.
    const color = selected ? `linear-gradient(to top, ${base} 0 2px, ${base}47 2px)` : `${base}26`
    const targets = !doubleStrand ? [top] : feature.strand === 1 ? [top] : feature.strand === -1 ? [bottom] : [top, bottom]
    for (const tints of targets) {
      for (const { start, end } of feature.segments) {
        for (let i = start; i < end; i++) if (selected || tints[i] === undefined) tints[i] = color
      }
    }
  }
  doc.features.forEach((feature, i) => {
    if (isDisplayedFeature(feature)) paint(i, false)
  })
  if (selectedFeature !== null) paint(selectedFeature, true)
  return { top, bottom }
}

/** Full sequence as text (optionally with its complementary strand), rendering only the visible lines. */
export function SequencePanel() {
  const doc = useViewerStore((s) => s.doc)
  const selectedIndex = useViewerStore((s) => s.selectedIndex)
  const selectedFeature = useViewerStore((s) => s.selectedFeature)
  const setSelectedIndex = useViewerStore((s) => s.setSelectedIndex)
  const showComplement = useViewerStore((s) => s.showComplement)
  const toggleComplement = useViewerStore((s) => s.toggleComplement)
  const dark = useThemeStore((s) => s.theme === 'dark')
  const containerRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(288)
  const [copied, setCopied] = useState(false)

  const tints = useMemo(
    () => (doc ? featureTints(doc, selectedFeature, showComplement) : { top: [], bottom: [] }),
    [doc, selectedFeature, showComplement],
  )
  const lineCount = doc ? Math.ceil(doc.sequence.length / BASES_PER_LINE) : 0
  const blockHeight = showComplement ? 2 * ROW_HEIGHT + BLOCK_GAP : ROW_HEIGHT

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

  // Keep the same line at the top when switching between one and two strands.
  const prevBlockHeight = useRef(blockHeight)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || prevBlockHeight.current === blockHeight) return
    el.scrollTop = (el.scrollTop / prevBlockHeight.current) * blockHeight
    prevBlockHeight.current = blockHeight
  }, [blockHeight])

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
    const top = Math.floor(selectedIndex / BASES_PER_LINE) * blockHeight
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - 2 * blockHeight) {
      el.scrollTop = top - el.clientHeight / 2
    }
  }, [selectedIndex, doc, blockHeight])

  if (!doc) return null

  const first = Math.max(0, Math.floor(scrollTop / blockHeight) - OVERSCAN)
  const last = Math.min(lineCount, Math.ceil((scrollTop + viewHeight) / blockHeight) + OVERSCAN)

  const strandRow = (line: number, strand: 'top' | 'bottom') => {
    const start = line * BASES_PER_LINE
    const lineEnd = Math.min(start + BASES_PER_LINE, doc.sequence.length)
    const rowTints = strand === 'top' ? tints.top : tints.bottom
    const groups = []
    for (let g = start; g < lineEnd; g += GROUP) {
      const chars = []
      for (let i = g; i < Math.min(g + GROUP, lineEnd); i++) {
        const base = strand === 'top' ? doc.sequence[i] : complementBase(doc.sequence[i])
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
            style={{ color: baseColor(base, dark), background: i === selectedIndex ? undefined : rowTints[i] }}
          >
            {base}
          </span>,
        )
      }
      groups.push(
        <span key={g} className="mr-[1ch]">
          {chars}
        </span>,
      )
    }
    // 5'/3' end labels only make sense when both strands are shown.
    const [left, right] = strand === 'top' ? ["5'", "3'"] : ["3'", "5'"]
    return (
      <div key={strand} className="flex h-6 whitespace-nowrap">
        <span className="text-muted-foreground mr-3 inline-block w-[7ch] shrink-0 text-right select-none">
          {strand === 'top' ? start + 1 : ''}
        </span>
        {showComplement && <span className="text-muted-foreground/70 mr-2 w-[2ch] shrink-0 text-xs leading-6 select-none">{left}</span>}
        <span>{groups}</span>
        {showComplement && <span className="text-muted-foreground/70 text-xs leading-6 select-none">{right}</span>}
      </div>
    )
  }

  const lines = []
  for (let line = first; line < last; line++) {
    lines.push(
      <div key={line} style={{ height: blockHeight }}>
        {strandRow(line, 'top')}
        {showComplement && strandRow(line, 'bottom')}
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
        <div className="flex items-center gap-1">
          <Button
            variant={showComplement ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={showComplement}
            title={t.doubleStrandHint}
            onClick={toggleComplement}
          >
            <Rows2 />
            {t.doubleStrand}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? t.copied : t.copySequence}
          </Button>
        </div>
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
        <div className="relative my-3" style={{ height: lineCount * blockHeight }}>
          <div className="absolute inset-x-0" style={{ top: first * blockHeight }}>
            {lines}
          </div>
        </div>
      </div>
    </div>
  )
}
