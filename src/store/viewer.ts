import { create } from 'zustand'

import { FormatError, readSequenceFile, type SequenceDocument } from '@/lib/formats'
import { t } from '@/lib/i18n'

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 10
export const MIN_GAIN = 0.25
export const MAX_GAIN = 8

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ViewerState {
  status: Status
  error: string | null
  /** Informational message about the loaded file (e.g. only the first record is shown). */
  notice: string | null
  fileName: string | null
  doc: SequenceDocument | null
  /** Horizontal zoom: CSS pixels per trace sample. */
  zoom: number
  /** Vertical amplification of the trace signal. */
  gain: number
  /** Index of the selected base in doc.sequence, or null. */
  selectedIndex: number | null
  /** Index of the selected feature in doc.features, or null. */
  selectedFeature: number | null
  /** Show the complementary strand under the sequence. */
  showComplement: boolean

  loadFile: (file: File) => Promise<void>
  loadBuffer: (fileName: string, buffer: ArrayBuffer) => void
  setZoom: (zoom: number) => void
  setGain: (gain: number) => void
  setSelectedIndex: (index: number | null) => void
  selectFeature: (index: number | null) => void
  toggleComplement: () => void
  reset: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const initialView = { zoom: 2, gain: 1, selectedIndex: null, selectedFeature: null }

export const useViewerStore = create<ViewerState>()((set, get) => ({
  status: 'idle',
  error: null,
  notice: null,
  fileName: null,
  doc: null,
  showComplement: true,
  ...initialView,

  loadFile: async (file) => {
    set({ status: 'loading', error: null })
    try {
      // File API only: the file never leaves the browser.
      const buffer = await file.arrayBuffer()
      get().loadBuffer(file.name, buffer)
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },

  loadBuffer: (fileName, buffer) => {
    try {
      const { doc, recordCount } = readSequenceFile(fileName, buffer)
      console.info('[nucleotide-viewer] parsed', fileName, doc)
      set({
        status: 'ready',
        error: null,
        notice: recordCount > 1 ? t.multipleRecords(recordCount) : null,
        fileName,
        doc,
        // Sequence files are double-stranded constructs; a Sanger read is a single strand.
        showComplement: doc.chromatogram === null,
        ...initialView,
      })
    } catch (err) {
      const message =
        err instanceof FormatError
          ? t.formatErrors[err.code]
          : err instanceof Error
            ? err.message
            : String(err)
      set({ status: 'error', error: `${fileName}: ${message}` })
    }
  },

  setZoom: (zoom) => set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }),
  setGain: (gain) => set({ gain: clamp(gain, MIN_GAIN, MAX_GAIN) }),
  setSelectedIndex: (index) => {
    const length = get().doc?.sequence.length ?? 0
    set({ selectedIndex: index === null || length === 0 ? null : clamp(index, 0, length - 1) })
  },
  selectFeature: (index) => {
    const feature = index === null ? undefined : get().doc?.features[index]
    set({ selectedFeature: feature ? index : null })
    // Segments are in biological order; jump to the leftmost one as displayed.
    if (feature) get().setSelectedIndex(feature.segments[feature.strand === -1 ? feature.segments.length - 1 : 0].start)
  },
  toggleComplement: () => set({ showComplement: !get().showComplement }),
  reset: () =>
    set({ status: 'idle', error: null, notice: null, fileName: null, doc: null, ...initialView }),
}))
