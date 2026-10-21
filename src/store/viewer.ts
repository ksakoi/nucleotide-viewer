import { create } from 'zustand'

import { Ab1ParseError, parseAb1 } from '@/lib/abif/parser'
import type { Ab1Data } from '@/lib/abif/types'
import { t } from '@/lib/i18n'

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 10
export const MIN_GAIN = 0.25
export const MAX_GAIN = 8

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ViewerState {
  status: Status
  error: string | null
  fileName: string | null
  data: Ab1Data | null
  /** Horizontal zoom: CSS pixels per trace sample. */
  zoom: number
  /** Vertical amplification of the trace signal. */
  gain: number
  /** Index of the selected base in data.sequence, or null. */
  selectedIndex: number | null

  loadFile: (file: File) => Promise<void>
  loadBuffer: (fileName: string, buffer: ArrayBuffer) => void
  setZoom: (zoom: number) => void
  setGain: (gain: number) => void
  setSelectedIndex: (index: number | null) => void
  reset: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const initialView = { zoom: 2, gain: 1, selectedIndex: null }

export const useViewerStore = create<ViewerState>()((set, get) => ({
  status: 'idle',
  error: null,
  fileName: null,
  data: null,
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
      const data = parseAb1(buffer)
      console.info('[nucleotide-viewer] parsed', fileName, {
        sampleName: data.sampleName,
        length: data.sequence.length,
        sequence: data.sequence,
        peakLocations: data.peakLocations,
        traces: data.traces,
      })
      set({ status: 'ready', error: null, fileName, data, ...initialView })
    } catch (err) {
      const message =
        err instanceof Ab1ParseError
          ? t.parseErrors[err.code]
          : err instanceof Error
            ? err.message
            : String(err)
      set({ status: 'error', error: `${fileName}: ${message}` })
    }
  },

  setZoom: (zoom) => set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }),
  setGain: (gain) => set({ gain: clamp(gain, MIN_GAIN, MAX_GAIN) }),
  setSelectedIndex: (index) => {
    const length = get().data?.sequence.length ?? 0
    set({ selectedIndex: index === null || length === 0 ? null : clamp(index, 0, length - 1) })
  },
  reset: () => set({ status: 'idle', error: null, fileName: null, data: null, ...initialView }),
}))
