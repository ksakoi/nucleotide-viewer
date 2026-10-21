import { describe, expect, it } from 'vitest'

import { FormatError } from './errors'
import { parseFasta, writeFasta } from './fasta'
import { emptyDocument } from './types'

describe('FASTA', () => {
  it('parses multiple records with descriptions', () => {
    const docs = parseFasta('>seq1 first record\nACGT\nacgn\n\n>seq2\nTTTT\n', 'file')
    expect(docs).toHaveLength(2)
    expect(docs[0]).toMatchObject({ name: 'seq1', description: 'first record', sequence: 'ACGTACGN' })
    expect(docs[1]).toMatchObject({ name: 'seq2', sequence: 'TTTT', sourceFormat: 'fasta' })
  })

  it('accepts a bare sequence without a header', () => {
    expect(parseFasta('ACGT ACGT\n10 ACG\n', 'my_file')[0]).toMatchObject({ name: 'my_file', sequence: 'ACGTACGTACG' })
  })

  it('rejects text that is not a nucleotide sequence', () => {
    expect(() => parseFasta('>x\nHello, world!\n', 'f')).toThrow(FormatError)
    expect(() => parseFasta('>only a header\n', 'f')).toThrow(expect.objectContaining({ code: 'emptySequence' }))
  })

  it('writes 60 bases per line and round-trips', () => {
    const doc = emptyDocument({ name: 'my seq', description: 'test', sequence: 'ACGT'.repeat(40), sourceFormat: 'genbank' })
    const text = writeFasta(doc)
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('>my_seq test')
    expect(lines.slice(1).map((l) => l.length)).toEqual([60, 60, 40])
    expect(parseFasta(text, 'x')[0]).toMatchObject({ name: 'my_seq', description: 'test', sequence: doc.sequence })
  })
})
