import { FormatError } from './errors'
import { emptyDocument, type Segment, type SequenceDocument, type SequenceFeature, type Strand } from './types'

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

interface StrandedSegment extends Segment {
  strand: 1 | -1
}

/** Splits on commas that are not nested inside parentheses. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

function unwrap(text: string, fn: string): string | null {
  return text.startsWith(`${fn}(`) && text.endsWith(')') ? text.slice(fn.length + 1, -1) : null
}

function parseLocationExpr(text: string, length: number): StrandedSegment[] {
  const complement = unwrap(text, 'complement')
  if (complement !== null) {
    return parseLocationExpr(complement, length)
      .reverse()
      .map((s) => ({ ...s, strand: (s.strand === 1 ? -1 : 1) as 1 | -1 }))
  }
  const joined = unwrap(text, 'join') ?? unwrap(text, 'order')
  if (joined !== null) return splitTopLevel(joined).flatMap((part) => parseLocationExpr(part, length))

  // References to other entries (e.g. "J00194.1:100..202") can't be shown here.
  if (text.includes(':')) return []
  const plain = text.replace(/[<>]/g, '')
  if (plain.includes('^')) return [] // site between two bases
  const match = /^(\d+)(?:\.\.?(\d+))?$/.exec(plain)
  if (!match) return []
  const start = Number(match[1]) - 1
  const end = match[2] === undefined ? start + 1 : Number(match[2])
  if (end > start) return [{ start, end, strand: 1 }]
  // start > end: a span across the origin of a circular sequence.
  return [
    { start, end: length, strand: 1 },
    { start: 0, end, strand: 1 },
  ]
}

/** Parses a GenBank feature location such as "complement(join(1..20,30..40))". */
export function parseLocation(text: string, length: number): { segments: Segment[]; strand: Strand } {
  const parts = parseLocationExpr(text.replace(/\s+/g, ''), length)
  const strand: Strand = parts.length > 0 && parts.every((p) => p.strand === -1) ? -1 : 1
  return { segments: parts.map(({ start, end }) => ({ start, end })), strand }
}

export function formatLocation(segments: Segment[], strand: Strand): string {
  const ordered = strand === -1 ? [...segments].reverse() : segments
  const ranges = ordered.map((s) => (s.end - s.start === 1 ? `${s.end}` : `${s.start + 1}..${s.end}`))
  const inner = ranges.length === 1 ? ranges[0] : `join(${ranges.join(',')})`
  return strand === -1 ? `complement(${inner})` : inner
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const NAME_QUALIFIERS = ['label', 'gene', 'product', 'locus_tag', 'standard_name', 'note']

function featureName(type: string, qualifiers: Record<string, string[]>): string {
  for (const key of NAME_QUALIFIERS) {
    const value = qualifiers[key]?.[0]
    if (value) return value.length > 60 ? `${value.slice(0, 57)}...` : value
  }
  return type
}

interface RawFeature {
  type: string
  location: string[]
  qualifiers: { key: string; raw: string[] }[]
}

function finishQualifierValue(key: string, raw: string[]): string {
  // Long values wrap over lines; sequences such as /translation wrap without spaces.
  let value = raw.join(key === 'translation' ? '' : ' ').trim()
  if (value.startsWith('"')) value = value.slice(1, value.endsWith('"') && value.length > 1 ? -1 : undefined)
  return value.replace(/""/g, '"')
}

function parseRecord(lines: string[], fallbackName: string): SequenceDocument {
  const locus = lines[0]
  const name = locus.slice(5).trim().split(/\s+/)[0] || fallbackName
  const topology = /\bcircular\b/i.test(locus) ? 'circular' : 'linear'

  let description = ''
  const rawFeatures: RawFeature[] = []
  const sequenceChunks: string[] = []
  let section = ''

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('//')) break
    if (line && line[0] !== ' ') {
      section = line.slice(0, 12).trim().split(/\s+/)[0]
      if (section === 'DEFINITION') description = line.slice(12).trim()
      continue
    }
    if (section === 'DEFINITION') {
      description += ' ' + line.trim()
    } else if (section === 'FEATURES') {
      const featureStart = /^ {5}(\S+)\s+(.*)$/.exec(line)
      if (featureStart && line[5] !== ' ') {
        rawFeatures.push({ type: featureStart[1], location: [featureStart[2]], qualifiers: [] })
        continue
      }
      const current = rawFeatures[rawFeatures.length - 1]
      const body = line.trim()
      if (!current || !body) continue
      const qualifierStart = /^\/([^=\s]+)(?:=(.*))?$/.exec(body)
      const open = current.qualifiers[current.qualifiers.length - 1]
      const inQuotes = open && (open.raw.join('').match(/"/g)?.length ?? 0) % 2 === 1
      if (qualifierStart && !inQuotes) {
        current.qualifiers.push({ key: qualifierStart[1], raw: [qualifierStart[2] ?? ''] })
      } else if (open) {
        open.raw.push(body)
      } else {
        current.location.push(body)
      }
    } else if (section === 'ORIGIN') {
      sequenceChunks.push(line.replace(/[^A-Za-z]/g, ''))
    }
  }

  const sequence = sequenceChunks.join('').toUpperCase()
  if (!sequence) throw new FormatError('emptySequence')

  const features: SequenceFeature[] = []
  for (const raw of rawFeatures) {
    const { segments, strand } = parseLocation(raw.location.join(''), sequence.length)
    if (segments.length === 0) continue
    const qualifiers: Record<string, string[]> = {}
    for (const q of raw.qualifiers) {
      ;(qualifiers[q.key] ??= []).push(finishQualifierValue(q.key, q.raw))
    }
    features.push({ name: featureName(raw.type, qualifiers), type: raw.type, segments, strand, qualifiers })
  }

  return emptyDocument({
    name,
    description: description.replace(/\.$/, ''),
    sequence,
    topology,
    features,
    sourceFormat: 'genbank',
  })
}

/** Parses all records in a GenBank flat file. */
export function parseGenbank(text: string, fallbackName: string): SequenceDocument[] {
  const lines = text.split(/\r?\n/)
  const docs: SequenceDocument[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('LOCUS')) continue
    let end = i + 1
    while (end < lines.length && !lines[end].startsWith('//') && !lines[end].startsWith('LOCUS')) end++
    docs.push(parseRecord(lines.slice(i, end + 1), fallbackName))
    i = end
  }
  if (docs.length === 0) throw new FormatError('invalidGenbank')
  return docs
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function genbankDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`
}

/** Wraps text into lines of at most `width` characters, preferring to break at spaces. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  let rest = text
  while (rest.length > width) {
    let cut = rest.lastIndexOf(' ', width)
    if (cut <= 0) cut = width
    lines.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  lines.push(rest)
  return lines
}

function writeKeyword(keyword: string, value: string): string[] {
  return wrap(value || '.', 67).map((line, i) => (i === 0 ? keyword.padEnd(12) : ' '.repeat(12)) + line)
}

function qualifierText(key: string, value: string): string {
  if (value === '') return `/${key}`
  if (/^\d+$/.test(value)) return `/${key}=${value}`
  return `/${key}="${value.replace(/"/g, '""')}"`
}

export function writeGenbank(doc: SequenceDocument, date = new Date()): string {
  const name = (doc.name.replace(/\s+/g, '_') || 'sequence').slice(0, 16)
  const length = doc.sequence.length
  const out: string[] = [
    `LOCUS       ${name.padEnd(16)} ${String(length).padStart(11)} bp    DNA     ${doc.topology.padEnd(8)} UNA ${genbankDate(date)}`,
    ...writeKeyword('DEFINITION', doc.description ? `${doc.description}.` : '.'),
    'ACCESSION   .',
    'VERSION     .',
    'KEYWORDS    .',
    'SOURCE      .',
    '  ORGANISM  .',
    'FEATURES             Location/Qualifiers',
    `     source          1..${length}`,
    `                     /mol_type="other DNA"`,
  ]

  for (const feature of doc.features) {
    if (feature.type === 'source') continue
    out.push(...wrap(formatLocation(feature.segments, feature.strand), 58).map((line, i) =>
      i === 0 ? `     ${feature.type.padEnd(16)}${line}` : ' '.repeat(21) + line,
    ))
    const entries = Object.entries(feature.qualifiers).flatMap(([key, values]) => values.map((v) => [key, v] as const))
    if (!entries.some(([, v]) => v === feature.name)) entries.unshift(['label', feature.name])
    for (const [key, value] of entries) {
      for (const line of wrap(qualifierText(key, value), 58)) out.push(' '.repeat(21) + line)
    }
  }

  out.push('ORIGIN')
  const seq = doc.sequence.toLowerCase()
  for (let i = 0; i < length; i += 60) {
    const groups: string[] = []
    for (let j = i; j < Math.min(i + 60, length); j += 10) groups.push(seq.slice(j, j + 10))
    out.push(`${String(i + 1).padStart(9)} ${groups.join(' ')}`)
  }
  out.push('//')
  return out.join('\n') + '\n'
}
