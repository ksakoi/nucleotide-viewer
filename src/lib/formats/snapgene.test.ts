// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { isSnapGene, parseSnapGene, writeSnapGene } from './snapgene'
import { emptyDocument } from './types'

const doc = emptyDocument({
  name: 'pDemo',
  description: 'Demo & <test> plasmid',
  sequence: 'ACGTTGCA'.repeat(25),
  topology: 'circular',
  sourceFormat: 'genbank',
  features: [
    { name: 'AmpR', type: 'CDS', segments: [{ start: 10, end: 70 }], strand: 1, qualifiers: { gene: ['bla'], note: ['say "hi" & 5 < 6'] } },
    { name: 'rev', type: 'promoter', segments: [{ start: 100, end: 120 }, { start: 80, end: 90 }], strand: -1, qualifiers: {} },
    { name: 'ori', type: 'rep_origin', segments: [{ start: 190, end: 200 }, { start: 0, end: 5 }], strand: 1, qualifiers: {} },
    { name: 'site', type: 'misc_feature', segments: [{ start: 150, end: 160 }], strand: 0, qualifiers: {} },
  ],
})

const toBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

describe('SnapGene', () => {
  it('writes a file with the SnapGene cookie', () => {
    const bytes = writeSnapGene(doc)
    expect(isSnapGene(bytes)).toBe(true)
    expect(bytes[0]).toBe(0x09)
  })

  it('round-trips sequence, topology, notes and features', () => {
    const again = parseSnapGene(toBuffer(writeSnapGene(doc)), 'fallback')
    expect(again).toMatchObject({
      name: 'pDemo',
      description: 'Demo & <test> plasmid',
      sequence: doc.sequence,
      topology: 'circular',
      sourceFormat: 'snapgene',
    })
    expect(again.features).toEqual(doc.features)
  })

  it('reads linear sequences and strips HTML from values', () => {
    // Packets as SnapGene itself writes them: HTML-wrapped text, 1-based inclusive ranges.
    const packet = (type: number, payload: Uint8Array) => {
      const out = new Uint8Array(5 + payload.length)
      out[0] = type
      new DataView(out.buffer).setUint32(1, payload.length)
      out.set(payload, 5)
      return out
    }
    const enc = new TextEncoder()
    const cookie = new Uint8Array([...enc.encode('SnapGene'), 0, 1, 0, 14, 0, 16])
    const features =
      '<?xml version="1.0"?><Features nextValidID="1"><Feature name="KanR" directionality="2" type="CDS">' +
      '<Segment range="3-8" type="standard"/><Q name="note"><V text="&lt;html&gt;&lt;body&gt;&lt;i&gt;kan&lt;/i&gt; gene&lt;/body&gt;&lt;/html&gt;"/></Q>' +
      '<Q name="codon_start"><V int="1"/></Q></Feature></Features>'
    const parts = [packet(0x09, cookie), packet(0x00, enc.encode('\x02acgtacgtac')), packet(0x0a, enc.encode(features))]
    const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    parts.reduce((offset, p) => (bytes.set(p, offset), offset + p.length), 0)

    const again = parseSnapGene(toBuffer(bytes), 'fallback')
    expect(again).toMatchObject({ name: 'fallback', sequence: 'ACGTACGTAC', topology: 'linear' })
    expect(again.features).toEqual([
      { name: 'KanR', type: 'CDS', segments: [{ start: 2, end: 8 }], strand: -1, qualifiers: { note: ['kan gene'], codon_start: ['1'] } },
    ])
  })

  it('rejects other binary files', () => {
    expect(() => parseSnapGene(new Uint8Array([1, 2, 3]).buffer, 'x')).toThrow(expect.objectContaining({ code: 'invalidSnapGene' }))
  })
})
