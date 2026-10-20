export type Base = 'A' | 'C' | 'G' | 'T'

export const BASES: readonly Base[] = ['A', 'C', 'G', 'T']

/** Result of parsing an .ab1 (ABIF) chromatogram file. */
export interface Ab1Data {
  /** Sample name stored in the file (SMPL tag), if any. */
  sampleName: string | null
  /** Called base sequence (PBAS). May contain IUPAC codes such as N. */
  sequence: string
  /** Phred quality value per base (PCON). Empty when the file has none. */
  qualities: number[]
  /** Trace sample index of each called base's peak (PLOC). Same length as sequence. */
  peakLocations: number[]
  /** Analyzed signal intensity per channel, all of length traceLength. */
  traces: Record<Base, Int16Array>
  /** Number of samples in each trace channel. */
  traceLength: number
  /** Largest signal value across all channels, for vertical scaling. */
  maxSignal: number
}
