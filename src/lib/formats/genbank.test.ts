import { describe, expect, it } from 'vitest'

import { formatLocation, parseGenbank, parseLocation, writeGenbank } from './genbank'
import { emptyDocument, type SequenceDocument } from './types'

const SAMPLE = `LOCUS       pTEST                    100 bp    DNA     circular SYN 01-JAN-2024
DEFINITION  Test plasmid with a
            two-line definition.
ACCESSION   .
FEATURES             Location/Qualifiers
     source          1..100
                     /organism="synthetic DNA construct"
     promoter        <5..20
                     /label=Ptest
     CDS             complement(join(30..40,
                     50..60))
                     /gene="abc"
                     /codon_start=1
                     /note="a ""quoted"" note that wraps over
                     two lines"
                     /translation="MKLV
                     QRST"
                     /pseudo
     misc_feature    95..5
                     /note="crosses the origin"
     misc_feature    J00194.1:100..202
ORIGIN
        1 acgtacgtac gtacgtacgt acgtacgtac gtacgtacgt acgtacgtac gtacgtacgt
       61 acgtacgtac gtacgtacgt acgtacgtac gtacgtacgt
//
`

describe('GenBank locations', () => {
  it('parses ranges, complements and joins into 0-based segments', () => {
    expect(parseLocation('10..20', 100)).toEqual({ segments: [{ start: 9, end: 20 }], strand: 1 })
    expect(parseLocation('7', 100)).toEqual({ segments: [{ start: 6, end: 7 }], strand: 1 })
    expect(parseLocation('complement(join(1..5,10..20))', 100)).toEqual({
      segments: [
        { start: 9, end: 20 },
        { start: 0, end: 5 },
      ],
      strand: -1,
    })
    expect(parseLocation('join(complement(10..20),complement(1..5))', 100).strand).toBe(-1)
    expect(parseLocation('order(1..2,5..6)', 100).segments).toHaveLength(2)
    expect(parseLocation('10^11', 100).segments).toEqual([])
  })

  it('formats segments back to the same location', () => {
    for (const loc of ['10..20', '7', 'complement(join(1..5,10..20))', 'join(95..100,1..5)']) {
      const { segments, strand } = parseLocation(loc, 100)
      expect(formatLocation(segments, strand)).toBe(loc)
    }
  })
})

describe('GenBank records', () => {
  const [doc] = parseGenbank(SAMPLE, 'fallback')

  it('reads header, sequence and topology', () => {
    expect(doc).toMatchObject({
      name: 'pTEST',
      description: 'Test plasmid with a two-line definition',
      topology: 'circular',
      sourceFormat: 'genbank',
    })
    expect(doc.sequence).toHaveLength(100)
    expect(doc.sequence.startsWith('ACGTACGT')).toBe(true)
  })

  it('reads features and qualifiers', () => {
    const [source, promoter, cds, wrap] = doc.features
    expect(doc.features).toHaveLength(4) // the remote-reference feature is skipped
    expect(source.type).toBe('source')
    expect(promoter).toMatchObject({ name: 'Ptest', segments: [{ start: 4, end: 20 }], strand: 1 })
    expect(cds).toMatchObject({ name: 'abc', type: 'CDS', strand: -1 })
    expect(cds.qualifiers).toEqual({
      gene: ['abc'],
      codon_start: ['1'],
      note: ['a "quoted" note that wraps over two lines'],
      translation: ['MKLVQRST'],
      pseudo: [''],
    })
    expect(wrap.segments).toEqual([
      { start: 94, end: 100 },
      { start: 0, end: 5 },
    ])
  })

  it('writes a LOCUS line with standard column positions', () => {
    const locus = writeGenbank(doc, new Date(2024, 0, 2)).split('\n')[0]
    expect(locus).toBe('LOCUS       pTEST                    100 bp    DNA     circular UNA 02-JAN-2024')
    expect(locus.indexOf('circular')).toBe(55)
  })

  it('round-trips through the writer', () => {
    const [again] = parseGenbank(writeGenbank(doc), 'x')
    const strip = (d: SequenceDocument) =>
      d.features.filter((f) => f.type !== 'source').map(({ name, type, segments, strand, qualifiers }) => {
        const { label: _label, ...rest } = qualifiers
        return { name, type, segments, strand, qualifiers: rest }
      })
    expect(again.sequence).toBe(doc.sequence)
    expect(again.topology).toBe('circular')
    expect(strip(again)).toEqual(strip(doc))
  })

  it('wraps long qualifier values at 79 columns', () => {
    const long = emptyDocument({
      name: 'x',
      sequence: 'ACGT'.repeat(30),
      sourceFormat: 'fasta',
      features: [{ name: 'f', type: 'CDS', segments: [{ start: 0, end: 120 }], strand: 1, qualifiers: { translation: ['M'.repeat(200)], note: ['word '.repeat(40).trim()] } }],
    })
    const text = writeGenbank(long)
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeLessThanOrEqual(80)
    const [again] = parseGenbank(text, 'x')
    expect(again.features.find((f) => f.type === 'CDS')?.qualifiers).toMatchObject({
      translation: ['M'.repeat(200)],
      note: ['word '.repeat(40).trim()],
    })
  })

  it('reads every record in a multi-record file', () => {
    expect(parseGenbank(SAMPLE + SAMPLE.replace('pTEST', 'pTWO'), 'x').map((d) => d.name)).toEqual(['pTEST', 'pTWO'])
  })
})
