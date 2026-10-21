// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildAbif, synthesizeChromatogram } from '../abif/writer'
import { EXPORT_FORMATS, detectFormat, exportDocument, readSequenceFile } from './index'

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer

async function toArrayBuffer(part: BlobPart): Promise<ArrayBuffer> {
  const bytes = typeof part === 'string' ? new TextEncoder().encode(part) : (part as Uint8Array)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('format detection', () => {
  it('detects by content first, then by extension', () => {
    expect(detectFormat(buildAbif(synthesizeChromatogram(5)), 'x.txt')).toBe('ab1')
    expect(detectFormat(encode('LOCUS       x  4 bp'), 'x.fasta')).toBe('genbank')
    expect(detectFormat(encode('﻿>x\nACGT'), 'x.gb')).toBe('fasta')
    expect(detectFormat(encode('ACGT'), 'x.fa')).toBe('fasta')
    expect(detectFormat(encode('ACGT'), 'x.xyz')).toBeNull()
  })

  it('reports unknown formats', () => {
    expect(() => readSequenceFile('x.png', encode('PNG'))).toThrow(expect.objectContaining({ code: 'unknownFormat' }))
  })
})

describe('conversion', () => {
  it('converts an .ab1 read to every export format', async () => {
    const { doc } = readSequenceFile('read.ab1', buildAbif(synthesizeChromatogram(120, 9)))
    expect(doc.chromatogram).not.toBeNull()
    for (const format of EXPORT_FORMATS) {
      const { doc: converted } = readSequenceFile(`out${format.extension}`, await toArrayBuffer(exportDocument(doc, format.id)))
      expect(converted.sourceFormat).toBe(format.id)
      expect(converted.sequence).toBe(doc.sequence)
    }
  })

  // Optional: real files, e.g. Biopython's Tests/GenBank, Tests/SnapGene and Tests/Fasta.
  const fixtureDir = process.env.FORMAT_FIXTURE_DIR
  it.runIf(fixtureDir)('reads real files and keeps features through every export format', async () => {
    for (const file of readdirSync(fixtureDir!)) {
      const bytes = readFileSync(path.join(fixtureDir!, file))
      const { doc, recordCount } = readSequenceFile(file, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
      const shown = doc.features.filter((f) => f.type !== 'source')
      console.log(file, doc.sourceFormat, doc.name, doc.sequence.length, doc.topology, `${shown.length} features`, `${recordCount} records`)
      for (const format of EXPORT_FORMATS) {
        const out = readSequenceFile(`out${format.extension}`, await toArrayBuffer(exportDocument(doc, format.id))).doc
        expect(out.sequence).toBe(doc.sequence)
        if (format.id !== 'fasta') {
          expect(out.topology).toBe(doc.topology)
          const keep = (f: (typeof shown)[number]) => ({ type: f.type, segments: f.segments, strand: f.strand || 1 })
          expect(out.features.filter((f) => f.type !== 'source').map(keep)).toEqual(shown.map(keep))
        }
      }
    }
  })
})
