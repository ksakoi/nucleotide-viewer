import { parseAb1 } from '../abif/parser'
import { FormatError } from './errors'
import { parseFasta, writeFasta } from './fasta'
import { parseGenbank, writeGenbank } from './genbank'
import { isSnapGene, parseSnapGene, writeSnapGene } from './snapgene'
import { emptyDocument, type ExportFormatId, type FormatId, type SequenceDocument } from './types'

export { FormatError } from './errors'
export type { ExportFormatId, FormatId, SequenceDocument, SequenceFeature } from './types'

/** File extensions offered in the file picker. */
export const ACCEPTED_EXTENSIONS = [
  '.ab1', '.abi',
  '.fasta', '.fa', '.fas', '.fna', '.ffn', '.fsa',
  '.gb', '.gbk', '.genbank', '.gbff',
  '.dna',
].join(',')

export const FORMAT_LABELS: Record<FormatId, string> = {
  ab1: 'AB1',
  fasta: 'FASTA',
  genbank: 'GenBank',
  snapgene: 'SnapGene',
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '') || fileName
}

/** Detects the format from the file contents, falling back to the extension. */
export function detectFormat(buffer: ArrayBuffer, fileName: string): FormatId | null {
  const bytes = new Uint8Array(buffer)
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const head = new TextDecoder('latin1').decode(bytes.subarray(hasBom ? 3 : 0, 512))
  if (head.startsWith('ABIF')) return 'ab1'
  if (isSnapGene(bytes)) return 'snapgene'
  const text = head.trimStart()
  if (text.startsWith('LOCUS')) return 'genbank'
  if (text.startsWith('>') || text.startsWith(';')) return 'fasta'
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (['.fasta', '.fa', '.fas', '.fna', '.ffn', '.fsa', '.txt', '.seq'].includes(ext)) return 'fasta'
  return null
}

export interface LoadedFile {
  doc: SequenceDocument
  /** Number of records in the file; only the first one is shown. */
  recordCount: number
}

export function readSequenceFile(fileName: string, buffer: ArrayBuffer): LoadedFile {
  const fallbackName = baseName(fileName)
  const text = () => new TextDecoder('utf-8').decode(buffer)
  switch (detectFormat(buffer, fileName)) {
    case 'ab1': {
      const data = parseAb1(buffer)
      return {
        doc: emptyDocument({
          name: data.sampleName ?? fallbackName,
          sequence: data.sequence,
          qualities: data.qualities,
          chromatogram: data,
          sourceFormat: 'ab1',
        }),
        recordCount: 1,
      }
    }
    case 'snapgene':
      return { doc: parseSnapGene(buffer, fallbackName), recordCount: 1 }
    case 'genbank': {
      const docs = parseGenbank(text(), fallbackName)
      return { doc: docs[0], recordCount: docs.length }
    }
    case 'fasta': {
      const docs = parseFasta(text(), fallbackName)
      return { doc: docs[0], recordCount: docs.length }
    }
    default:
      throw new FormatError('unknownFormat')
  }
}

export const EXPORT_FORMATS: { id: ExportFormatId; extension: string; mime: string }[] = [
  { id: 'fasta', extension: '.fasta', mime: 'text/x-fasta' },
  { id: 'genbank', extension: '.gb', mime: 'text/x-genbank' },
  { id: 'snapgene', extension: '.dna', mime: 'application/octet-stream' },
]

export function exportDocument(doc: SequenceDocument, format: ExportFormatId): BlobPart {
  switch (format) {
    case 'fasta':
      return writeFasta(doc)
    case 'genbank':
      return writeGenbank(doc)
    case 'snapgene':
      return writeSnapGene(doc)
  }
}
