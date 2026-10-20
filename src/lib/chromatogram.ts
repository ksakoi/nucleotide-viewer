/** Shared geometry and colors so the canvas trace and the DOM base row stay aligned. */

/** Horizontal padding (CSS px) before the first sample and after the last. */
export const TRACE_PADDING = 16

/** Standard chromatogram colors. G is black, so it switches to light gray in dark mode. */
export function baseColor(base: string, dark: boolean): string {
  switch (base) {
    case 'A':
      return dark ? '#4ade80' : '#16a34a'
    case 'T':
      return dark ? '#f87171' : '#dc2626'
    case 'C':
      return dark ? '#60a5fa' : '#2563eb'
    case 'G':
      return dark ? '#e5e5e5' : '#171717'
    default:
      return dark ? '#c084fc' : '#9333ea' // N and other IUPAC ambiguity codes
  }
}

/** X position (content coordinates) of a trace sample. */
export function sampleToX(sample: number, zoom: number): number {
  return TRACE_PADDING + sample * zoom
}

export function xToSample(x: number, zoom: number): number {
  return (x - TRACE_PADDING) / zoom
}

export function contentWidth(traceLength: number, zoom: number): number {
  return TRACE_PADDING * 2 + Math.max(0, traceLength - 1) * zoom
}

/** First index i with peaks[i] >= sample (peaks are sorted ascending). */
export function lowerBound(peaks: readonly number[], sample: number): number {
  let lo = 0
  let hi = peaks.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (peaks[mid] < sample) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Index range [start, end) of bases whose peaks fall in [fromSample, toSample]. */
export function baseRange(peaks: readonly number[], fromSample: number, toSample: number) {
  return { start: lowerBound(peaks, fromSample), end: lowerBound(peaks, toSample + 1e-9) }
}

/** Index of the base whose peak is closest to the given sample. */
export function nearestBase(peaks: readonly number[], sample: number): number {
  if (peaks.length === 0) return -1
  const i = lowerBound(peaks, sample)
  if (i === 0) return 0
  if (i === peaks.length) return peaks.length - 1
  return sample - peaks[i - 1] <= peaks[i] - sample ? i - 1 : i
}
