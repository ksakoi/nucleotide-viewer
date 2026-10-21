import { isDisplayedFeature } from '@/lib/feature-colors'
import type { SequenceDocument } from '@/lib/formats'

/** Part of a feature that falls on one sequence line (0-based, end exclusive). */
export interface FeaturePart {
  start: number
  end: number
}

/** A feature as drawn on one line: its parts there and where its arrowhead goes, if on this line. */
export interface LineFeature {
  featureIndex: number
  parts: FeaturePart[]
  /** Index into `parts` of the part carrying the arrowhead, or -1. */
  arrowPart: number
  arrow: 'left' | 'right' | null
}

/** For each line, the features on it packed into non-overlapping lanes. */
export type FeatureLines = LineFeature[][][]

/**
 * Splits features into per-line parts and packs each line's features into
 * lanes so that bars on the same lane never overlap. The arrowhead marks
 * the biological end: the right end of the last segment on the forward
 * strand, the left end of the last segment on the reverse strand.
 */
export function layoutFeatureLines(doc: SequenceDocument, basesPerLine: number): FeatureLines {
  const lineCount = Math.ceil(doc.sequence.length / basesPerLine)
  const perLine: Map<number, LineFeature>[] = Array.from({ length: lineCount }, () => new Map())
  const arrowParts = new Map<LineFeature, FeaturePart>()

  doc.features.forEach((feature, featureIndex) => {
    if (!isDisplayedFeature(feature) || feature.segments.length === 0) return
    const last = feature.segments[feature.segments.length - 1]
    for (const segment of feature.segments) {
      const firstLine = Math.floor(segment.start / basesPerLine)
      const lastLine = Math.floor((segment.end - 1) / basesPerLine)
      for (let line = firstLine; line <= lastLine && line < lineCount; line++) {
        const lineStart = line * basesPerLine
        const part = {
          start: Math.max(segment.start, lineStart),
          end: Math.min(segment.end, lineStart + basesPerLine),
        }
        let entry = perLine[line].get(featureIndex)
        if (!entry) {
          entry = { featureIndex, parts: [], arrowPart: -1, arrow: null }
          perLine[line].set(featureIndex, entry)
        }
        entry.parts.push(part)
        if (segment === last) {
          if (feature.strand === 1 && part.end === segment.end) {
            entry.arrow = 'right'
            arrowParts.set(entry, part)
          } else if (feature.strand === -1 && part.start === segment.start) {
            entry.arrow = 'left'
            arrowParts.set(entry, part)
          }
        }
      }
    }
  })

  return perLine.map((entries) => {
    const items = [...entries.values()]
    for (const item of items) {
      item.parts.sort((a, b) => a.start - b.start)
      const arrowPart = arrowParts.get(item)
      item.arrowPart = arrowPart ? item.parts.indexOf(arrowPart) : -1
    }
    items.sort((a, b) => a.parts[0].start - b.parts[0].start || a.featureIndex - b.featureIndex)
    const lanes: LineFeature[][] = []
    const laneEnds: number[] = []
    for (const item of items) {
      const start = item.parts[0].start
      const end = item.parts[item.parts.length - 1].end
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
      if (lane === -1) {
        lane = lanes.length
        lanes.push([])
        laneEnds.push(0)
      }
      lanes[lane].push(item)
      laneEnds[lane] = end
    }
    return lanes
  })
}
