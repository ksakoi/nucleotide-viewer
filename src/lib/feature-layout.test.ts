import { describe, expect, it } from 'vitest'

import { layoutFeatureLines } from './feature-layout'
import { emptyDocument, type SequenceFeature } from './formats/types'

const feature = (name: string, segments: [number, number][], strand: 1 | -1 | 0 = 1, type = 'misc_feature'): SequenceFeature => ({
  name,
  type,
  segments: segments.map(([start, end]) => ({ start, end })),
  strand,
  qualifiers: {},
})

const doc = (features: SequenceFeature[], length = 250) =>
  emptyDocument({ sequence: 'A'.repeat(length), sourceFormat: 'genbank', features })

describe('layoutFeatureLines', () => {
  it('splits a feature across lines and puts the arrowhead on its biological end', () => {
    const lines = layoutFeatureLines(doc([feature('f', [[90, 130]])]), 100)
    expect(lines[0]).toEqual([[{ featureIndex: 0, parts: [{ start: 90, end: 100 }], arrowPart: -1, arrow: null }]])
    expect(lines[1]).toEqual([[{ featureIndex: 0, parts: [{ start: 100, end: 130 }], arrowPart: 0, arrow: 'right' }]])
    expect(lines[2]).toEqual([])
  })

  it('points reverse-strand features left at their last segment', () => {
    // Biological order for the reverse strand: [50,60) then [10,20).
    const [line] = layoutFeatureLines(doc([feature('r', [[50, 60], [10, 20]], -1)]), 100)
    expect(line[0][0]).toMatchObject({ parts: [{ start: 10, end: 20 }, { start: 50, end: 60 }], arrow: 'left', arrowPart: 0 })
  })

  it('has no arrowhead for strandless features', () => {
    expect(layoutFeatureLines(doc([feature('n', [[5, 10]], 0)]), 100)[0][0][0].arrow).toBeNull()
  })

  it('packs overlapping features into separate lanes and reuses free lanes', () => {
    const [line] = layoutFeatureLines(doc([feature('a', [[0, 40]]), feature('b', [[30, 60]]), feature('c', [[45, 90]])]), 100)
    expect(line.map((lane) => lane.map((f) => f.featureIndex))).toEqual([[0, 2], [1]])
  })

  it('skips source features and handles features wrapping the origin', () => {
    const lines = layoutFeatureLines(
      doc([feature('src', [[0, 250]], 1, 'source'), feature('ori', [[240, 250], [0, 5]])]),
      100,
    )
    expect(lines[0][0][0]).toMatchObject({ featureIndex: 1, parts: [{ start: 0, end: 5 }], arrow: 'right' })
    expect(lines[2][0][0]).toMatchObject({ featureIndex: 1, parts: [{ start: 240, end: 250 }], arrow: null })
  })
})
