import type { Ab1Data } from '../abif/types'

export type FormatId = 'ab1' | 'fasta' | 'genbank' | 'snapgene'

/** Formats a loaded document can be exported to. */
export type ExportFormatId = Exclude<FormatId, 'ab1'>

export type Strand = 1 | -1 | 0

/** Half-open, 0-based interval [start, end) on the sequence. */
export interface Segment {
  start: number
  end: number
}

export interface SequenceFeature {
  name: string
  type: string
  /** In biological reading order (a feature crossing the origin of a circular sequence has two). */
  segments: Segment[]
  strand: Strand
  /** Qualifier name -> values, in file order. Flag qualifiers (e.g. /pseudo) have an empty value. */
  qualifiers: Record<string, string[]>
}

/** Format-independent representation of a loaded sequence file. */
export interface SequenceDocument {
  name: string
  description: string
  sequence: string
  topology: 'linear' | 'circular'
  features: SequenceFeature[]
  /** Phred quality per base, empty when the source has none. */
  qualities: number[]
  /** Trace data when loaded from an .ab1 file. */
  chromatogram: Ab1Data | null
  sourceFormat: FormatId
}

export function emptyDocument(partial: Partial<SequenceDocument> & Pick<SequenceDocument, 'sequence' | 'sourceFormat'>): SequenceDocument {
  return {
    name: 'sequence',
    description: '',
    topology: 'linear',
    features: [],
    qualities: [],
    chromatogram: null,
    ...partial,
  }
}
