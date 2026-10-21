import { FormatError } from '../formats/errors'
import { BASES, type Ab1Data, type Base } from './types'

/**
 * Minimal parser for Applied Biosystems ABIF (.ab1) files.
 *
 * Layout (all values big-endian):
 *   0   "ABIF" magic
 *   4   version (int16)
 *   6   root directory entry (28 bytes) pointing at the tag directory
 * Each directory entry: name(4) number(int32) elementType(int16)
 * elementSize(int16) numElements(int32) dataSize(int32) dataOffset(int32)
 * dataHandle(int32). When dataSize <= 4 the data is stored inline in the
 * dataOffset field itself.
 */

const DIR_ENTRY_SIZE = 28

interface DirEntry {
  name: string
  number: number
  elementType: number
  elementSize: number
  numElements: number
  dataSize: number
  /** Absolute byte offset of the entry's data (already resolved for inline data). */
  offset: number
}

export class Ab1ParseError extends FormatError {
  override name = 'Ab1ParseError'
}

function readTag4(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}

function readDirEntry(view: DataView, offset: number): DirEntry {
  const dataSize = view.getInt32(offset + 16)
  return {
    name: readTag4(view, offset),
    number: view.getInt32(offset + 4),
    elementType: view.getInt16(offset + 8),
    elementSize: view.getInt16(offset + 10),
    numElements: view.getInt32(offset + 12),
    dataSize,
    offset: dataSize <= 4 ? offset + 20 : view.getInt32(offset + 20),
  }
}

function readDirectory(view: DataView): Map<string, DirEntry> {
  if (view.byteLength < 6 + DIR_ENTRY_SIZE || readTag4(view, 0) !== 'ABIF') {
    throw new Ab1ParseError('notAbif')
  }
  const root = readDirEntry(view, 6)
  const entries = new Map<string, DirEntry>()
  for (let i = 0; i < root.numElements; i++) {
    const at = root.offset + i * DIR_ENTRY_SIZE
    if (at + DIR_ENTRY_SIZE > view.byteLength) {
      throw new Ab1ParseError('directoryOutOfRange')
    }
    const entry = readDirEntry(view, at)
    if (entry.offset + entry.dataSize > view.byteLength) continue
    entries.set(`${entry.name}${entry.number}`, entry)
  }
  return entries
}

function readChars(view: DataView, entry: DirEntry): string {
  let out = ''
  for (let i = 0; i < entry.numElements; i++) {
    out += String.fromCharCode(view.getUint8(entry.offset + i))
  }
  return out
}

/** pString: first byte is the length. */
function readPString(view: DataView, entry: DirEntry): string {
  const len = Math.min(view.getUint8(entry.offset), entry.dataSize - 1)
  let out = ''
  for (let i = 0; i < len; i++) out += String.fromCharCode(view.getUint8(entry.offset + 1 + i))
  return out
}

function readInt16Array(view: DataView, entry: DirEntry): Int16Array {
  const out = new Int16Array(entry.numElements)
  for (let i = 0; i < entry.numElements; i++) out[i] = view.getInt16(entry.offset + i * 2)
  return out
}

function readUint8Array(view: DataView, entry: DirEntry): number[] {
  const out: number[] = new Array(entry.numElements)
  for (let i = 0; i < entry.numElements; i++) out[i] = view.getUint8(entry.offset + i)
  return out
}

/** Return the first present entry among the given keys (e.g. prefer basecaller over user-edited). */
function pick(entries: Map<string, DirEntry>, ...keys: string[]): DirEntry | undefined {
  for (const key of keys) {
    const entry = entries.get(key)
    if (entry) return entry
  }
  return undefined
}

export function parseAb1(buffer: ArrayBuffer): Ab1Data {
  const view = new DataView(buffer)
  const entries = readDirectory(view)

  const baseEntry = pick(entries, 'PBAS2', 'PBAS1')
  const peakEntry = pick(entries, 'PLOC2', 'PLOC1')
  const orderEntry = entries.get('FWO_1')
  if (!baseEntry || !peakEntry || !orderEntry) {
    throw new Ab1ParseError('missingBasecalls')
  }

  const sequence = readChars(view, baseEntry).toUpperCase()
  const peakLocations = Array.from(readInt16Array(view, peakEntry))
  if (peakLocations.length !== sequence.length) {
    throw new Ab1ParseError('peakCountMismatch')
  }

  // FWO_ gives the base for analyzed channels DATA9..DATA12 (e.g. "GATC").
  const order = readChars(view, orderEntry).toUpperCase()
  const traces = {} as Record<Base, Int16Array>
  for (let i = 0; i < 4; i++) {
    const base = order[i] as Base
    const dataEntry = entries.get(`DATA${9 + i}`)
    if (!BASES.includes(base) || !dataEntry) {
      throw new Ab1ParseError('missingTraces')
    }
    traces[base] = readInt16Array(view, dataEntry)
  }
  for (const base of BASES) {
    if (!traces[base]) throw new Ab1ParseError('missingTraces', `no channel for ${base}`)
  }

  const traceLength = Math.min(...BASES.map((b) => traces[b].length))
  let maxSignal = 0
  for (const base of BASES) {
    const trace = traces[base]
    for (let i = 0; i < traceLength; i++) if (trace[i] > maxSignal) maxSignal = trace[i]
  }

  const qualityEntry = pick(entries, 'PCON2', 'PCON1')
  const qualities = qualityEntry ? readUint8Array(view, qualityEntry) : []

  const sampleEntry = entries.get('SMPL1')
  const sampleName = sampleEntry ? readPString(view, sampleEntry) || null : null

  return {
    sampleName,
    sequence,
    qualities: qualities.length === sequence.length ? qualities : [],
    peakLocations,
    traces,
    traceLength,
    maxSignal,
  }
}
