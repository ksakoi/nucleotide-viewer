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

/** 100 bases per line when a full line fits (desktop widths), otherwise 60. */
const BASES_PER_LINE_WIDE = 100
const BASES_PER_LINE_NARROW = 60

/** Width in px of a full line: number column, strand labels, bases and group gaps (see strandRow). */
function lineWidth(bases: number, numberDigits: number, charWidth: number, doubleStrand: boolean): number {
  const chars = numberDigits + bases + Math.ceil(bases / GROUP) - 1 + (doubleStrand ? 4 : 0)
  const margins = 12 + (doubleStrand ? 16 : 0)
  return chars * charWidth + margins
}
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
  const sectionRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(300)
  const [contentWidth, setContentWidth] = useState(0)
  const [charWidth, setCharWidth] = useState(0)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [copied, setCopied] = useState(false)

  const tints = useMemo(
    () => (doc ? featureTints(doc, selectedFeature, showComplement) : { top: [], bottom: [] }),
    [doc, selectedFeature, showComplement],
  )
  const blockHeight = showComplement ? 2 * ROW_HEIGHT + BLOCK_GAP : ROW_HEIGHT
  // Line-number column sized to the longest position label.
  const numberDigits = doc ? String(doc.sequence.length).length : 1
  const basesPerLine =
    charWidth > 0 && contentWidth >= lineWidth(BASES_PER_LINE_WIDE, numberDigits, charWidth, showComplement)
      ? BASES_PER_LINE_WIDE
      : BASES_PER_LINE_NARROW
  const lineCount = doc ? Math.ceil(doc.sequence.length / basesPerLine) : 0

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      setViewHeight(el.clientHeight)
      const style = getComputedStyle(el)
      setContentWidth(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
      // Monospace glyph width, measured once per font from a 100-character probe.
      if (probeRef.current) setCharWidth(probeRef.current.getBoundingClientRect().width / 100)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [doc])

  // New file: back to the top (the scroll event updates scrollTop state).
  useLayoutEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0
  }, [doc])

  // Keep the same bases at the top when the strand count or line length changes.
  const prevLayout = useRef({ blockHeight, basesPerLine })
  useLayoutEffect(() => {
    const el = containerRef.current
    const prev = prevLayout.current
    if (!el || (prev.blockHeight === blockHeight && prev.basesPerLine === basesPerLine)) return
    const topBase = (el.scrollTop / prev.blockHeight) * prev.basesPerLine
    el.scrollTop = (topBase / basesPerLine) * blockHeight
    prevLayout.current = { blockHeight, basesPerLine }
  }, [blockHeight, basesPerLine])

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      if (containerRef.current) setScrollTop(containerRef.current.scrollTop)
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // The features list sits below this panel: bring the panel on screen when a feature is picked.
  useEffect(() => {
    if (selectedFeature !== null) sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedFeature])

  // Keep the selected base in view, scrolling only this panel (never the page).
  useEffect(() => {
    const el = containerRef.current
    if (!el || selectedIndex === null) return
    const top = Math.floor(selectedIndex / basesPerLine) * blockHeight
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - 2 * blockHeight) {
      el.scrollTop = top - el.clientHeight / 2
    }
  }, [selectedIndex, doc, blockHeight, basesPerLine])

  if (!doc) return null

  const first = Math.max(0, Math.floor(scrollTop / blockHeight) - OVERSCAN)
  const last = Math.min(lineCount, Math.ceil((scrollTop + viewHeight) / blockHeight) + OVERSCAN)

  const strandRow = (line: number, strand: 'top' | 'bottom') => {
    const start = line * basesPerLine
    const lineEnd = Math.min(start + basesPerLine, doc.sequence.length)
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
        <span key={g} className="mr-[1ch] last:mr-0">
          {chars}
        </span>,
      )
    }
    // 5'/3' end labels only make sense when both strands are shown.
    const [left, right] = strand === 'top' ? ["5'", "3'"] : ["3'", "5'"]
    return (
      <div key={strand} className="flex h-6 whitespace-nowrap">
        <span
          className="text-muted-foreground mr-3 inline-block shrink-0 text-right select-none"
          style={{ width: `${numberDigits}ch` }}
        >
          {strand === 'top' ? start + 1 : ''}
        </span>
        {showComplement && <span className="text-muted-foreground/70 mr-2 w-[2ch] shrink-0 text-xs leading-6 select-none">{left}</span>}
        <span>{groups}</span>
        {showComplement && <span className="text-muted-foreground/70 ml-2 text-xs leading-6 select-none">{right}</span>}
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
    <div ref={sectionRef} className="scroll-mt-16 space-y-2">
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
        className="bg-muted/40 relative max-h-[max(12rem,35vh)] overflow-auto rounded-lg border px-3 font-mono text-sm leading-6"
        onClick={(e) => {
          const index = (e.target as HTMLElement).dataset.index
          if (index !== undefined) setSelectedIndex(Number(index))
        }}
      >
        {/* Zero-size clip so the measuring probe never widens the scroll area. */}
        <span aria-hidden className="invisible absolute h-0 w-0 overflow-hidden">
          <span ref={probeRef} className="whitespace-pre">
            {'0'.repeat(100)}
          </span>
        </span>
        <div className="relative my-3" style={{ height: lineCount * blockHeight }}>
          <div className="absolute inset-x-0" style={{ top: first * blockHeight }}>
            {/* As wide as the longest line and centered, so a short last line stays left-aligned with the rest. */}
            <div className="mx-auto w-max">{lines}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
