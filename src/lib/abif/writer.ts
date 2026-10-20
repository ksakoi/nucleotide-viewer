import { BASES, type Base } from './types'

/**
 * Builds a minimal ABIF (.ab1) file. Used to generate the bundled demo
 * sample and test fixtures; it writes only the tags the viewer reads.
 */

interface Tag {
  name: string
  number: number
  elementType: number
  elementSize: number
  data: Uint8Array
}

const CHAR = 2
const SHORT = 4
const PSTRING = 18

function chars(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0))
}

function shorts(values: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(values.length * 2)
  const view = new DataView(out.buffer)
  for (let i = 0; i < values.length; i++) view.setInt16(i * 2, values[i])
  return out
}

export interface AbifInput {
  sampleName?: string
  sequence: string
  peakLocations: number[]
  qualities?: number[]
  traces: Record<Base, ArrayLike<number>>
  /** Channel order for DATA9..12 (FWO_ tag). */
  baseOrder?: string
}

export function buildAbif(input: AbifInput): ArrayBuffer {
  const order = input.baseOrder ?? 'GATC'
  const tags: Tag[] = [
    { name: 'FWO_', number: 1, elementType: CHAR, elementSize: 1, data: chars(order) },
    { name: 'PBAS', number: 2, elementType: CHAR, elementSize: 1, data: chars(input.sequence) },
    { name: 'PLOC', number: 2, elementType: SHORT, elementSize: 2, data: shorts(input.peakLocations) },
  ]
  for (let i = 0; i < 4; i++) {
    const base = order[i] as Base
    if (!BASES.includes(base)) throw new Error(`invalid base order: ${order}`)
    tags.push({ name: 'DATA', number: 9 + i, elementType: SHORT, elementSize: 2, data: shorts(input.traces[base]) })
  }
  if (input.qualities) {
    tags.push({ name: 'PCON', number: 2, elementType: CHAR, elementSize: 1, data: Uint8Array.from(input.qualities) })
  }
  if (input.sampleName !== undefined) {
    const name = chars(input.sampleName)
    const data = new Uint8Array(name.length + 1)
    data[0] = name.length
    data.set(name, 1)
    tags.push({ name: 'SMPL', number: 1, elementType: PSTRING, elementSize: 1, data })
  }

  const headerSize = 128
  const payloadSize = tags.reduce((sum, t) => sum + (t.data.length > 4 ? t.data.length : 0), 0)
  const dirOffset = headerSize + payloadSize
  const buffer = new ArrayBuffer(dirOffset + tags.length * 28)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  bytes.set(chars('ABIF'), 0)
  view.setInt16(4, 101)
  bytes.set(chars('tdir'), 6)
  view.setInt32(10, 1)
  view.setInt16(14, 1023)
  view.setInt16(16, 28)
  view.setInt32(18, tags.length)
  view.setInt32(22, tags.length * 28)
  view.setInt32(26, dirOffset)

  let dataCursor = headerSize
  tags.forEach((tag, i) => {
    const at = dirOffset + i * 28
    bytes.set(chars(tag.name), at)
    view.setInt32(at + 4, tag.number)
    view.setInt16(at + 8, tag.elementType)
    view.setInt16(at + 10, tag.elementSize)
    view.setInt32(at + 12, tag.data.length / tag.elementSize)
    view.setInt32(at + 16, tag.data.length)
    if (tag.data.length <= 4) {
      bytes.set(tag.data, at + 20)
    } else {
      view.setInt32(at + 20, dataCursor)
      bytes.set(tag.data, dataCursor)
      dataCursor += tag.data.length
    }
  })
  return buffer
}

/** Deterministic pseudo-random generator so the demo sample is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Generates a realistic-looking synthetic chromatogram for demos and tests. */
export function synthesizeChromatogram(length: number, seed = 1): AbifInput {
  const rand = mulberry32(seed)
  const spacing = 12
  const leading = 20
  const traceLength = leading * 2 + length * spacing
  const traces: Record<Base, Int16Array> = {
    A: new Int16Array(traceLength),
    C: new Int16Array(traceLength),
    G: new Int16Array(traceLength),
    T: new Int16Array(traceLength),
  }
  let sequence = ''
  const peakLocations: number[] = []
  const qualities: number[] = []

  for (let i = 0; i < length; i++) {
    const base = BASES[Math.floor(rand() * 4)]
    const center = leading + i * spacing + Math.round((rand() - 0.5) * 3)
    // Signal decays and gets noisier toward the ends, as in real reads.
    const pos = i / length
    const envelope = Math.min(1, pos * 12) * Math.min(1, (1 - pos) * 4)
    const height = (400 + rand() * 900) * (0.25 + 0.75 * envelope)
    const width = 2.6 + pos * 1.6
    const ambiguous = envelope < 0.35 && rand() < 0.15
    sequence += ambiguous ? 'N' : base
    peakLocations.push(center)
    qualities.push(Math.max(2, Math.round(60 * envelope * (0.7 + rand() * 0.3))))

    for (let x = Math.max(0, center - 12); x < Math.min(traceLength, center + 12); x++) {
      const g = Math.exp(-((x - center) ** 2) / (2 * width * width))
      traces[base][x] += Math.round(height * g)
      if (ambiguous) {
        const other = BASES[(BASES.indexOf(base) + 1 + Math.floor(rand() * 3)) % 4]
        traces[other][x] += Math.round(height * 0.8 * g)
      }
    }
  }
  for (const base of BASES) {
    const trace = traces[base]
    for (let x = 0; x < traceLength; x++) trace[x] = Math.min(32767, trace[x] + Math.round(rand() * 25))
  }
  return { sampleName: 'Demo_Synthetic_Read', sequence, peakLocations, qualities, traces }
}
