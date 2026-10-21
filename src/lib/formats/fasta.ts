import { FormatError } from './errors'
import { emptyDocument, type SequenceDocument } from './types'

const LINE_WIDTH = 60
/** IUPAC nucleotide codes plus gap/stop characters. */
const SEQUENCE_CHARS = /^[ACGTURYSWKMBDHVN.*-]*$/i

/** Parses FASTA text. A file without any ">" header is accepted as a single bare sequence. */
export function parseFasta(text: string, fallbackName: string): SequenceDocument[] {
  const docs: SequenceDocument[] = []
  let header: string | null = null
  let chunks: string[] = []

  const flush = () => {
    if (header === null && chunks.length === 0) return
    const sequence = chunks.join('').toUpperCase()
    if (!SEQUENCE_CHARS.test(sequence)) throw new FormatError('invalidFasta')
    const [name, ...rest] = (header ?? '').trim().split(/\s+/)
    docs.push(
      emptyDocument({
        name: name || fallbackName,
        description: rest.join(' '),
        sequence,
        sourceFormat: 'fasta',
      }),
    )
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('>')) {
      flush()
      header = line.slice(1)
      chunks = []
    } else if (line && !line.startsWith(';')) {
      chunks.push(line.replace(/[\s\d]/g, ''))
    }
  }
  flush()

  const withSequence = docs.filter((d) => d.sequence.length > 0)
  if (withSequence.length === 0) throw new FormatError('emptySequence')
  return withSequence
}

export function writeFasta(doc: SequenceDocument): string {
  const header = [doc.name.replace(/\s+/g, '_'), doc.description].filter(Boolean).join(' ')
  const lines = [`>${header}`]
  for (let i = 0; i < doc.sequence.length; i += LINE_WIDTH) {
    lines.push(doc.sequence.slice(i, i + LINE_WIDTH))
  }
  return lines.join('\n') + '\n'
}
