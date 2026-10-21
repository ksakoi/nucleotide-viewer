import { FormatError } from './errors'
import { emptyDocument, type Segment, type SequenceDocument, type SequenceFeature, type Strand } from './types'

/**
 * SnapGene .dna files are a series of packets: type (1 byte), length
 * (uint32 big-endian), payload. The ones used here:
 *   0x09  cookie: "SnapGene" + uint16 file type + uint16 export/import versions
 *   0x00  DNA: 1 flag byte (bit 0 = circular, bit 1 = double-stranded) + ASCII sequence
 *   0x0A  features (XML)
 *   0x06  notes (XML)
 * Other packets (restriction sites, primers, display settings) are ignored.
 */

const COOKIE = 0x09
const DNA = 0x00
const NOTES = 0x06
const FEATURES = 0x0a

const latin1 = new TextDecoder('latin1')
const utf8 = new TextDecoder('utf-8')

export function isSnapGene(bytes: Uint8Array): boolean {
  return bytes.length >= 13 && bytes[0] === COOKIE && latin1.decode(bytes.subarray(5, 13)) === 'SnapGene'
}

/** SnapGene stores rich text values as HTML fragments; keep the plain text. */
function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new FormatError('invalidSnapGene', 'bad XML')
  return doc
}

function parseSegment(range: string, length: number, circular: boolean): Segment[] {
  const match = /^(\d+)-(\d+)$/.exec(range.trim())
  if (!match) return []
  const start = Number(match[1]) - 1
  const end = Number(match[2])
  if (end > start) return [{ start, end }]
  if (!circular) return []
  return [
    { start, end: length },
    { start: 0, end },
  ]
}

function parseFeatures(xml: string, length: number, circular: boolean): SequenceFeature[] {
  const features: SequenceFeature[] = []
  for (const el of Array.from(parseXml(xml).getElementsByTagName('Feature'))) {
    const directionality = el.getAttribute('directionality')
    const strand: Strand = directionality === '1' ? 1 : directionality === '2' ? -1 : 0
    let segments = Array.from(el.getElementsByTagName('Segment'))
      .filter((s) => s.getAttribute('type') !== 'gap')
      .flatMap((s) => parseSegment(s.getAttribute('range') ?? '', length, circular))
    if (segments.length === 0) continue
    if (strand === -1) segments = segments.reverse()

    const qualifiers: Record<string, string[]> = {}
    for (const q of Array.from(el.getElementsByTagName('Q'))) {
      const key = q.getAttribute('name')
      if (!key) continue
      for (const v of Array.from(q.getElementsByTagName('V'))) {
        const value = v.getAttribute('text') ?? v.getAttribute('int') ?? v.getAttribute('predef')
        if (value !== null) (qualifiers[key] ??= []).push(plainText(value))
      }
    }
    const type = el.getAttribute('type') || 'misc_feature'
    features.push({ name: el.getAttribute('name') || type, type, segments, strand, qualifiers })
  }
  return features
}

function parseNotes(xml: string): { description: string; label: string | null } {
  const doc = parseXml(xml)
  const text = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent ?? ''
  return {
    description: plainText(text('Description')),
    label: text('UseCustomMapLabel') === '1' ? plainText(text('CustomMapLabel')) || null : null,
  }
}

export function parseSnapGene(buffer: ArrayBuffer, fallbackName: string): SequenceDocument {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (!isSnapGene(bytes)) throw new FormatError('invalidSnapGene')

  let sequence: string | null = null
  let circular = false
  let featuresXml: string | null = null
  let notesXml: string | null = null

  for (let offset = 0; offset + 5 <= bytes.length; ) {
    const type = bytes[offset]
    const length = view.getUint32(offset + 1)
    const payload = bytes.subarray(offset + 5, offset + 5 + length)
    if (payload.length !== length) throw new FormatError('invalidSnapGene', 'truncated packet')
    if (type === DNA) {
      circular = (payload[0] & 0x01) === 1
      sequence = latin1.decode(payload.subarray(1)).toUpperCase()
    } else if (type === FEATURES) {
      featuresXml = utf8.decode(payload)
    } else if (type === NOTES) {
      notesXml = utf8.decode(payload)
    }
    offset += 5 + length
  }

  if (!sequence) throw new FormatError('emptySequence')
  const notes = notesXml ? parseNotes(notesXml) : { description: '', label: null }
  return emptyDocument({
    name: notes.label ?? fallbackName,
    description: notes.description,
    sequence,
    topology: circular ? 'circular' : 'linear',
    features: featuresXml ? parseFeatures(featuresXml, sequence.length, circular) : [],
    sourceFormat: 'snapgene',
  })
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Text values are read back as HTML, so markup characters must be escaped once for HTML... */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** ...and once more for the XML document they are stored in. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** SnapGene ranges are 1-based inclusive; a range whose start is after its end wraps the origin. */
function segmentRanges(feature: SequenceFeature, doc: SequenceDocument): string[] {
  const ordered = feature.strand === -1 ? [...feature.segments].reverse() : feature.segments
  const length = doc.sequence.length
  // Merge an origin-spanning pair back into one wrapped range.
  if (
    doc.topology === 'circular' &&
    ordered.length === 2 &&
    ordered[0].end === length &&
    ordered[1].start === 0
  ) {
    return [`${ordered[0].start + 1}-${ordered[1].end}`]
  }
  return [...ordered].sort((a, b) => a.start - b.start).map((s) => `${s.start + 1}-${s.end}`)
}

function featuresXml(doc: SequenceDocument): string {
  const features = doc.features.filter((f) => f.type !== 'source')
  const items = features.map((feature, i) => {
    const directionality = feature.strand === 1 ? ' directionality="1"' : feature.strand === -1 ? ' directionality="2"' : ''
    const segments = segmentRanges(feature, doc)
      .map((range) => `<Segment range="${range}" type="standard"/>`)
      .join('')
    const qualifiers = Object.entries(feature.qualifiers)
      .filter(([key]) => key !== 'label')
      .map(([key, values]) => `<Q name="${escapeXml(key)}">${values.map((v) => `<V text="${escapeXml(escapeHtml(v))}"/>`).join('')}</Q>`)
      .join('')
    return `<Feature recentID="${i}" name="${escapeXml(feature.name)}"${directionality} type="${escapeXml(feature.type)}" allowSegmentOverlaps="0" consecutiveTranslationNumbering="1">${segments}${qualifiers}</Feature>`
  })
  return `<?xml version="1.0"?><Features nextValidID="${features.length}">${items.join('')}</Features>`
}

function notesXml(doc: SequenceDocument, date: Date): string {
  const today = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`
  return [
    '<Notes>',
    `<UUID>${crypto.randomUUID()}</UUID>`,
    '<Type>Synthetic</Type>',
    `<CustomMapLabel>${escapeXml(doc.name)}</CustomMapLabel>`,
    '<UseCustomMapLabel>1</UseCustomMapLabel>',
    `<Description>${escapeXml(`<html><body>${escapeHtml(doc.description)}</body></html>`)}</Description>`,
    `<Created>${today}</Created>`,
    `<LastModified>${today}</LastModified>`,
    '</Notes>',
  ].join('\n')
}

function packet(type: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length)
  out[0] = type
  new DataView(out.buffer).setUint32(1, payload.length)
  out.set(payload, 5)
  return out
}

export function writeSnapGene(doc: SequenceDocument, date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()

  const cookie = new Uint8Array(14)
  cookie.set(encoder.encode('SnapGene'))
  const cookieView = new DataView(cookie.buffer)
  cookieView.setUint16(8, 1) // file type: DNA
  cookieView.setUint16(10, 13) // export version
  cookieView.setUint16(12, 11) // minimum import version

  const dna = new Uint8Array(1 + doc.sequence.length)
  dna[0] = 0x02 | (doc.topology === 'circular' ? 0x01 : 0) // double-stranded (+ circular)
  for (let i = 0; i < doc.sequence.length; i++) dna[i + 1] = doc.sequence.charCodeAt(i) & 0x7f

  const packets = [
    packet(COOKIE, cookie),
    packet(DNA, dna),
    packet(FEATURES, encoder.encode(featuresXml(doc))),
    packet(NOTES, encoder.encode(notesXml(doc, date))),
  ]
  const out = new Uint8Array(packets.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of packets) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
