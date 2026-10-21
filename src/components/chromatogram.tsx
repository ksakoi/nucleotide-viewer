import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  baseColor,
  baseRange,
  contentWidth,
  nearestBase,
  sampleToX,
  xToSample,
} from '@/lib/chromatogram'
import { BASES, type Ab1Data, type Base } from '@/lib/abif/types'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme'
import { useViewerStore } from '@/store/viewer'

const CANVAS_HEIGHT = 260
const RULER_HEIGHT = 22
const QUALITY_HEIGHT = 26
const TRACE_TOP = RULER_HEIGHT + QUALITY_HEIGHT + 6
const TRACE_BOTTOM = CANVAS_HEIGHT - 4
const BASE_ROW_HEIGHT = 30

/**
 * Signal level mapped to the full trace height at gain 1. Uses a high
 * percentile of called peak heights so a single dye blob doesn't flatten
 * the rest of the read.
 */
function referenceSignal(data: Ab1Data): number {
  const heights: number[] = []
  data.peakLocations.forEach((loc, i) => {
    const base = data.sequence[i] as Base
    const trace = BASES.includes(base) ? data.traces[base] : null
    heights.push(trace ? trace[loc] : Math.max(...BASES.map((b) => data.traces[b][loc])))
  })
  heights.sort((a, b) => a - b)
  const p98 = heights[Math.floor(heights.length * 0.98)] ?? 0
  return Math.max(1, p98 * 1.1 || data.maxSignal)
}

/** Average distance between called peaks, in trace samples. */
function averagePeakSpacing(peaks: readonly number[]): number {
  if (peaks.length < 2) return 12
  return (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1)
}

export function Chromatogram({ data }: { data: Ab1Data }) {
  const zoom = useViewerStore((s) => s.zoom)
  const gain = useViewerStore((s) => s.gain)
  const setZoom = useViewerStore((s) => s.setZoom)
  const selectedIndex = useViewerStore((s) => s.selectedIndex)
  const setSelectedIndex = useViewerStore((s) => s.setSelectedIndex)
  const dark = useThemeStore((s) => s.theme === 'dark')

  const scrollerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const frame = useRef(0)
  // Sample kept under the same screen x when zoom changes (cursor for wheel, else center).
  const zoomAnchor = useRef<{ sample: number; offsetX: number } | null>(null)
  const prevZoom = useRef(zoom)

  const reference = useMemo(() => referenceSignal(data), [data])
  const spacing = useMemo(() => averagePeakSpacing(data.peakLocations), [data])
  const width = contentWidth(data.traceLength, zoom)
  const canvasWidth = Math.min(viewportWidth, width)
  const basePx = spacing * zoom

  // Track viewport size.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth))
    observer.observe(el)
    setViewportWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  // Reset scroll position for a new file (the scroll event updates scrollLeft state).
  useLayoutEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0
  }, [data])

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      if (scrollerRef.current) setScrollLeft(scrollerRef.current.scrollLeft)
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Keep the anchored sample in place when zooming.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || prevZoom.current === zoom) return
    const anchor = zoomAnchor.current ?? {
      sample: xToSample(el.scrollLeft + el.clientWidth / 2, prevZoom.current),
      offsetX: el.clientWidth / 2,
    }
    zoomAnchor.current = null
    prevZoom.current = zoom
    el.scrollLeft = sampleToX(anchor.sample, zoom) - anchor.offsetX
    setScrollLeft(el.scrollLeft)
  }, [zoom])

  // Ctrl/⌘ + wheel zooms around the cursor. Needs a non-passive listener.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const { zoom: current } = useViewerStore.getState()
      const offsetX = e.clientX - el.getBoundingClientRect().left
      zoomAnchor.current = { sample: xToSample(el.scrollLeft + offsetX, current), offsetX }
      setZoom(current * Math.exp(-e.deltaY * 0.002))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom])

  // Bring the selected base into view when it is changed from elsewhere.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || selectedIndex === null) return
    const x = sampleToX(data.peakLocations[selectedIndex], useViewerStore.getState().zoom)
    const margin = Math.min(48, el.clientWidth / 4)
    if (x < el.scrollLeft + margin || x > el.scrollLeft + el.clientWidth - margin) {
      el.scrollTo({ left: x - el.clientWidth / 2, behavior: 'smooth' })
    }
  }, [selectedIndex, data])

  // Draw only the visible window of the trace.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasWidth <= 0) return
    const dpr = window.devicePixelRatio || 1
    const pxWidth = Math.round(canvasWidth * dpr)
    const pxHeight = Math.round(CANVAS_HEIGHT * dpr)
    if (canvas.width !== pxWidth) canvas.width = pxWidth
    if (canvas.height !== pxHeight) canvas.height = pxHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT)

    const muted = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'
    const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    const toCanvasX = (sample: number) => sampleToX(sample, zoom) - scrollLeft

    const firstSample = Math.max(0, Math.floor(xToSample(scrollLeft, zoom)) - 1)
    const lastSample = Math.min(data.traceLength - 1, Math.ceil(xToSample(scrollLeft + canvasWidth, zoom)) + 1)
    const { start, end } = baseRange(data.peakLocations, firstSample - spacing, lastSample + spacing)

    // Horizontal extent of base i: halfway to each neighbouring peak.
    const peaks = data.peakLocations
    const cell = (i: number) => {
      const left = i > 0 ? (peaks[i] - peaks[i - 1]) / 2 : spacing / 2
      const right = i < peaks.length - 1 ? (peaks[i + 1] - peaks[i]) / 2 : spacing / 2
      return { x0: toCanvasX(peaks[i] - left), x1: toCanvasX(peaks[i] + right) }
    }

    // Selection band.
    if (selectedIndex !== null && selectedIndex >= start && selectedIndex < end) {
      const { x0, x1 } = cell(selectedIndex)
      ctx.fillStyle = dark ? 'rgba(250,204,21,0.18)' : 'rgba(250,204,21,0.3)'
      ctx.fillRect(x0, RULER_HEIGHT, x1 - x0, CANVAS_HEIGHT - RULER_HEIGHT)
    }

    // Ruler: tick every 10 bases (1-based positions), labels when they fit.
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const labelEvery = basePx * 10 >= 36 ? 10 : basePx * 50 >= 36 ? 50 : 100
    for (let i = start; i < end; i++) {
      const pos = i + 1
      if (pos % 10 !== 0) continue
      const x = toCanvasX(data.peakLocations[i])
      ctx.fillStyle = grid
      ctx.fillRect(Math.round(x), RULER_HEIGHT, 1, CANVAS_HEIGHT - RULER_HEIGHT)
      ctx.fillStyle = muted
      ctx.fillRect(Math.round(x), RULER_HEIGHT - 6, 1, 6)
      if (pos % labelEvery === 0) ctx.fillText(String(pos), x, 3)
    }
    ctx.fillStyle = grid
    ctx.fillRect(0, RULER_HEIGHT - 0.5, canvasWidth, 1)

    // Quality bars (Phred, capped at 60).
    if (data.qualities.length) {
      const gap = basePx > 6 ? 1 : 0
      for (let i = start; i < end; i++) {
        const q = data.qualities[i]
        const h = (Math.min(q, 60) / 60) * (QUALITY_HEIGHT - 4)
        const { x0, x1 } = cell(i)
        ctx.fillStyle =
          q >= 20
            ? dark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.35)'
            : dark ? 'rgba(248,113,113,0.5)' : 'rgba(220,38,38,0.35)'
        ctx.fillRect(x0 + gap, RULER_HEIGHT + QUALITY_HEIGHT - 2 - h, Math.max(1, x1 - x0 - gap * 2), h)
      }
    }

    // Traces. When several samples share a pixel, draw each bucket's maximum to keep peaks.
    const scaleY = ((TRACE_BOTTOM - TRACE_TOP) / reference) * gain
    const step = Math.max(1, Math.floor(1 / zoom))
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, TRACE_TOP - 2, canvasWidth, TRACE_BOTTOM - TRACE_TOP + 4)
    ctx.clip()
    ctx.lineWidth = 1.25
    ctx.lineJoin = 'round'
    for (const base of BASES) {
      const trace = data.traces[base]
      ctx.strokeStyle = baseColor(base, dark)
      ctx.beginPath()
      for (let s = firstSample - (firstSample % step); s <= lastSample; s += step) {
        let v = trace[s]
        for (let k = 1; k < step && s + k < data.traceLength; k++) v = Math.max(v, trace[s + k])
        const x = toCanvasX(s)
        const y = TRACE_BOTTOM - v * scaleY
        if (s === firstSample - (firstSample % step)) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }, [data, zoom, gain, dark, scrollLeft, canvasWidth, selectedIndex, reference, spacing, basePx])

  // Visible bases for the DOM letter row (virtualized).
  const visible = useMemo(() => {
    const from = xToSample(scrollLeft - 50, zoom)
    const to = xToSample(scrollLeft + viewportWidth + 50, zoom)
    return baseRange(data.peakLocations, from, to)
  }, [data, zoom, scrollLeft, viewportWidth])

  const selectAt = (clientX: number) => {
    const el = scrollerRef.current
    if (!el) return
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft
    const index = nearestBase(data.peakLocations, xToSample(x, zoom))
    if (index >= 0) setSelectedIndex(index)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = data.sequence.length - 1
    const current = selectedIndex ?? nearestBase(data.peakLocations, xToSample(scrollLeft, zoom))
    const next =
      e.key === 'ArrowRight' ? current + (selectedIndex === null ? 0 : 1)
      : e.key === 'ArrowLeft' ? current - (selectedIndex === null ? 0 : 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : e.key === 'Escape' ? null
      : undefined
    if (next === undefined) return
    e.preventDefault()
    setSelectedIndex(next)
  }

  const fontSize = Math.max(8, Math.min(15, basePx * 0.85))
  const letters = []
  for (let i = visible.start; i < visible.end; i++) {
    const base = data.sequence[i]
    const q = data.qualities[i]
    letters.push(
      <span
        key={i}
        className={cn(
          'absolute top-1 -translate-x-1/2 rounded-sm px-px font-mono leading-5 font-semibold',
          i === selectedIndex && 'bg-yellow-300/70 ring-1 ring-yellow-500 dark:bg-yellow-400/30',
          q !== undefined && q < 20 && 'opacity-50',
        )}
        style={{ left: sampleToX(data.peakLocations[i], zoom), color: baseColor(base, dark), fontSize }}
        title={`${i + 1}: ${base}${q !== undefined ? ` (Q${q})` : ''}`}
      >
        {base}
      </span>,
    )
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={t.chromatogramLabel}
      className="bg-background relative overflow-x-auto overflow-y-hidden rounded-lg border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="relative" style={{ width }} onMouseDown={(e) => selectAt(e.clientX)}>
        <canvas
          ref={canvasRef}
          className="sticky left-0 block cursor-crosshair"
          style={{ width: canvasWidth, height: CANVAS_HEIGHT }}
        />
        <div
          className="relative cursor-pointer border-t select-none"
          style={{ height: BASE_ROW_HEIGHT }}
        >
          {letters}
        </div>
      </div>
    </div>
  )
}
