import { describe, expect, it } from 'vitest'

import { complement, complementBase, reverseComplement } from './sequence'

describe('complement', () => {
  it('pairs standard bases', () => {
    expect(complement('ACGT')).toBe('TGCA')
    expect(reverseComplement('AACG')).toBe('CGTT')
  })

  it('handles IUPAC ambiguity codes, case and gaps', () => {
    expect(complement('RYSWKMBDHVN')).toBe('YRSWMKVHDBN')
    expect(complement('acgu')).toBe('tgca')
    expect(complementBase('-')).toBe('-')
    expect(complementBase('*')).toBe('*')
  })

  it('is its own inverse for every code', () => {
    const all = 'ACGTRYSWKMBDHVN'
    expect(complement(complement(all))).toBe(all)
  })
})
