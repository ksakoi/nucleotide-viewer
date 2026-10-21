import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Rows2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { featureColor, featureLocationText } from '@/lib/feature-colors'
import { layoutFeatureLines } from '@/lib/feature-layout'
import { t } from '@/lib/i18n'
import { complementBase } from '@/lib/sequence'
import { cn } from '@/lib/utils'
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
/** Space below each block (strands + features) when the block has more than one row. */
const BLOCK_GAP = 10
/** Feature bar height and the space between lanes. */
const LANE_HEIGHT = 18
const LANE_GAP = 3
/** Space between the strands and the first feature lane. */
const FEATURE_TOP_GAP = 4
/** Extra lines rendered above and below the visible area. */
const OVERSCAN = 8
/** Arrowhead length in px. */
const ARROW = 7

/** Horizontal position, in ch, of the k-th base of a line (a 1ch gap follows every group of 10). */
const basePos = (k: number) => k + Math.floor(k / GROUP)

function blockHeightFor(lanes: number, doubleStrand: boolean): number {
  const strands = (doubleStrand ? 2 : 1) * ROW_HEIGHT
  const features = lanes > 0 ? FEATURE_TOP_GAP + lanes * (LANE_HEIGHT + LANE_GAP) : 0
  return strands + features + (doubleStrand || lanes > 0 ? BLOCK_GAP : 0)
}

/** Index of the line containing pixel offset y (offsets are cumulative line tops, length lineCount + 1). */
function lineAt(offsets: number[], y: number): number {
  let lo = 0
  let hi = offsets.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    if (offsets[mid] <= y) lo = mid
    else hi = mid - 1
  }
  return Math.max(0, lo)
}

const ARROW_CLIP = {
  right: `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%)`,
  left: `polygon(${ARROW}px 0, 100% 0, 100% 100%, ${ARROW}px 100%, 0 50%)`,
}

/**
 * Full sequence as text (optionally with its complementary strand) and the
 * features drawn as bars under each line, rendering only the visible lines.
 */
export function SequencePanel() {
  const doc = useViewerStore((s) => s.doc)
  const selectedIndex = useViewerStore((s) => s.selectedIndex)
  const selectedFeature = useViewerStore((s) => s.selectedFeature)
  const setSelectedIndex = useViewerStore((s) => s.setSelectedIndex)
  const showComplement = useViewerStore((s) => s.showComplement)
  const toggleComplement = useViewerStore((s) => s.toggleComplement)
  const selectFeature = useViewerStore((s) => s.selectFeature)
  const sectionRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(300)
  const [contentWidth, setContentWidth] = useState(0)
  const [charWidth, setCharWidth] = useState(0)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [copied, setCopied] = useState(false)

  // Line-number column sized to the longest position label.
  const numberDigits = doc ? String(doc.sequence.length).length : 1
  const basesPerLine =
    charWidth > 0 && contentWidth >= lineWidth(BASES_PER_LINE_WIDE, numberDigits, charWidth, showComplement)
      ? BASES_PER_LINE_WIDE
      : BASES_PER_LINE_NARROW
  const lineCount = doc ? Math.ceil(doc.sequence.length / basesPerLine) : 0

  const featureLines = useMemo(() => (doc ? layoutFeatureLines(doc, basesPerLine) : []), [doc, basesPerLine])
  /** Top of each line in px; lines with more feature lanes are taller. */
  const offsets = useMemo(() => {
    const tops = [0]
    for (let line = 0; line < lineCount; line++) {
      tops.push(tops[line] + blockHeightFor(featureLines[line]?.length ?? 0, showComplement))
    }
    return tops
  }, [featureLines, lineCount, showComplement])

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
  const prevLayout = useRef({ offsets, basesPerLine, doc })
  useLayoutEffect(() => {
    const el = containerRef.current
    const prev = prevLayout.current
    prevLayout.current = { offsets, basesPerLine, doc }
    if (!el || prev.offsets === offsets || prev.doc !== doc) return
    const topBase = lineAt(prev.offsets, el.scrollTop) * prev.basesPerLine
    el.scrollTop = offsets[Math.floor(topBase / basesPerLine)] ?? 0
  }, [offsets, basesPerLine, doc])

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
    const line = Math.floor(selectedIndex / basesPerLine)
    const top = offsets[line]
    const bottom = offsets[line + 1] ?? top
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = top - el.clientHeight / 2 + (bottom - top) / 2
    }
  }, [selectedIndex, doc, offsets, basesPerLine])

  if (!doc) return null

  const first = Math.max(0, lineAt(offsets, scrollTop) - OVERSCAN)
  const last = Math.min(lineCount, lineAt(offsets, scrollTop + viewHeight) + 1 + OVERSCAN)

  const strandRow = (line: number, strand: 'top' | 'bottom') => {
    const start = line * basesPerLine
    const lineEnd = Math.min(start + basesPerLine, doc.sequence.length)
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
              'text-foreground cursor-pointer rounded-sm hover:bg-accent',
              q !== undefined && q < 20 && 'opacity-50',
              i === selectedIndex && 'ring-1 ring-yellow-500 bg-yellow-300/70 dark:bg-yellow-400/30',
            )}
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

  /** Empty columns matching the line number (and strand label) so bars line up with the bases. */
  const leadingSpace = (
    <>
      <span className="mr-3 shrink-0" style={{ width: `${numberDigits}ch` }} />
      {/* Same font size as the 5'/3' label, so its ch width matches. */}
      {showComplement && <span className="mr-2 w-[2ch] shrink-0 text-xs" />}
    </>
  )

  const featureLanes = (line: number) => {
    const lineStart = line * basesPerLine
    const lineWidthCh = basePos(Math.min(basesPerLine, doc.sequence.length - lineStart) - 1) + 1
    return featureLines[line].map((lane, laneIndex) => (
      <div
        key={laneIndex}
        className="flex"
        style={{ height: LANE_HEIGHT, marginTop: laneIndex === 0 ? FEATURE_TOP_GAP : LANE_GAP }}
      >
        {leadingSpace}
        <div className="relative shrink-0" style={{ width: `${lineWidthCh}ch` }}>
          {lane.map((item) => {
            const feature = doc.features[item.featureIndex]
            const color = featureColor(feature)
            const dimmed = selectedFeature !== null && selectedFeature !== item.featureIndex
            const x = (base: number) => basePos(base - lineStart)
            const spanStart = x(item.parts[0].start)
            const spanEnd = x(item.parts[item.parts.length - 1].end - 1) + 1
            // Label on the widest part of the feature on this line.
            const labelPart = item.parts.reduce((best, p, i) =>
              p.end - p.start > item.parts[best].end - item.parts[best].start ? i : best, 0)
            const title = `${feature.name} (${feature.type}) ${featureLocationText(feature)}`
            return (
              <div
                key={item.featureIndex}
                className={cn('absolute inset-y-0 transition-opacity', dimmed && 'opacity-35 dark:opacity-50')}
                style={{ left: `${spanStart}ch`, width: `${spanEnd - spanStart}ch` }}
              >
                {/* Thin connector between the parts of a split feature (e.g. exons). */}
                {item.parts.length > 1 && (
                  <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: color }} />
                )}
                {item.parts.map((part, i) => {
                  const left = x(part.start) - spanStart
                  const width = x(part.end - 1) + 1 - x(part.start)
                  const arrow = i === item.arrowPart ? item.arrow : null
                  // Positioned in the sequence's monospace ch units; the label font is set inside.
                  return (
                    <div
                      key={i}
                      className="absolute inset-y-0 overflow-hidden rounded-[3px]"
                      style={{
                        left: `${left}ch`,
                        width: `${width}ch`,
                        background: color,
                        clipPath: arrow ? ARROW_CLIP[arrow] : undefined,
                      }}
                    >
                      <button
                        type="button"
                        title={title}
                        onClick={() => selectFeature(item.featureIndex)}
                        className={cn(
                          'flex size-full cursor-pointer items-center font-sans text-[11px] font-medium text-white',
                          selectedFeature === item.featureIndex && 'font-semibold',
                        )}
                        style={{
                          paddingLeft: arrow === 'left' ? ARROW + 2 : 4,
                          paddingRight: arrow === 'right' ? ARROW + 2 : 4,
                        }}
                      >
                        {i === labelPart && <span className="truncate leading-none">{feature.name}</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    ))
  }

  const lines = []
  for (let line = first; line < last; line++) {
    lines.push(
      <div key={line} style={{ height: offsets[line + 1] - offsets[line] }}>
        {strandRow(line, 'top')}
        {showComplement && strandRow(line, 'bottom')}
        {featureLanes(line)}
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
        <div className="relative my-3" style={{ height: offsets[lineCount] }}>
          <div className="absolute inset-x-0" style={{ top: offsets[first] }}>
            {/* As wide as the longest line and centered, so a short last line stays left-aligned with the rest. */}
            <div className="mx-auto w-max">{lines}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
