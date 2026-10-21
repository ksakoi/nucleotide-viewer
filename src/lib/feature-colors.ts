import type { SequenceFeature } from '@/lib/formats'

// Mid-dark tones so white labels on feature bars stay readable.
const PALETTE = ['#d97706', '#059669', '#2563eb', '#db2777', '#7c3aed', '#dc2626', '#0d9488', '#65a30d']

/** Stable color per feature type so e.g. all CDS share a color. */
export function featureColor(feature: Pick<SequenceFeature, 'type'>): string {
  let hash = 0
  for (const c of feature.type) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** Features drawn on the sequence; "source" spans the whole record and would hide everything else. */
export function isDisplayedFeature(feature: Pick<SequenceFeature, 'type'>): boolean {
  return feature.type !== 'source'
}

/** 1-based, inclusive location text such as "120..450" or "3900..12". */
export function featureLocationText(feature: SequenceFeature): string {
  const segments = feature.strand === -1 ? [...feature.segments].reverse() : feature.segments
  return segments.map((s) => (s.end - s.start === 1 ? `${s.end}` : `${s.start + 1}..${s.end}`)).join(', ')
}
