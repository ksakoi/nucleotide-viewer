import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { Ab1ParseError, parseAb1 } from './parser'
import { buildAbif, synthesizeChromatogram } from './writer'

describe('parseAb1', () => {
  it('round-trips a synthetic chromatogram', () => {
    const input = synthesizeChromatogram(200, 42)
    const data = parseAb1(buildAbif(input))

    expect(data.sampleName).toBe('Demo_Synthetic_Read')
    expect(data.sequence).toBe(input.sequence)
    expect(data.peakLocations).toEqual(input.peakLocations)
    expect(data.qualities).toEqual(input.qualities)
    expect(data.traceLength).toBe(input.traces.A.length)
    for (const base of ['A', 'C', 'G', 'T'] as const) {
      expect(Array.from(data.traces[base])).toEqual(Array.from(input.traces[base]))
    }
    expect(data.maxSignal).toBeGreaterThan(0)
  })

  it('maps channels using the FWO_ base order', () => {
    const input = synthesizeChromatogram(20, 7)
    const data = parseAb1(buildAbif({ ...input, baseOrder: 'ACGT' }))
    expect(Array.from(data.traces.G)).toEqual(Array.from(input.traces.G))
  })

  it('stores short data inline in the directory entry', () => {
    const input = synthesizeChromatogram(3, 3)
    const data = parseAb1(buildAbif({ ...input, sampleName: 'ab' }))
    expect(data.sequence).toHaveLength(3)
    expect(data.sampleName).toBe('ab')
  })

  it('rejects non-ABIF input', () => {
    expect(() => parseAb1(new TextEncoder().encode('>seq\nACGT\n').buffer as ArrayBuffer)).toThrow(
      Ab1ParseError,
    )
  })

  // Optional check against real instrument files, e.g. Biopython's Tests/Abi.
  const fixtureDir = process.env.AB1_FIXTURE_DIR
  it.runIf(fixtureDir)('parses real .ab1 files', () => {
    const files = readdirSync(fixtureDir!).filter((f) => f.endsWith('.ab1'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const bytes = readFileSync(path.join(fixtureDir!, file))
      const data = parseAb1(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
      console.log(file, data.sampleName, data.sequence.length, data.sequence.slice(0, 30), data.traceLength)
      expect(data.sequence.length).toBeGreaterThan(0)
      expect(data.peakLocations.every((p) => p >= 0 && p < data.traceLength)).toBe(true)
    }
  })
})
