import { describe, expect, it } from 'vitest'

import { baseRange, contentWidth, nearestBase, sampleToX, xToSample } from './chromatogram'

describe('chromatogram geometry', () => {
  const peaks = [10, 22, 35, 47]

  it('finds the nearest base to a sample', () => {
    expect(nearestBase(peaks, 0)).toBe(0)
    expect(nearestBase(peaks, 16)).toBe(0)
    expect(nearestBase(peaks, 17)).toBe(1)
    expect(nearestBase(peaks, 100)).toBe(3)
    expect(nearestBase([], 5)).toBe(-1)
  })

  it('returns bases inside a sample window', () => {
    expect(baseRange(peaks, 20, 40)).toEqual({ start: 1, end: 3 })
    expect(baseRange(peaks, 22, 35)).toEqual({ start: 1, end: 3 })
    expect(baseRange(peaks, 48, 60)).toEqual({ start: 4, end: 4 })
  })

  it('maps samples to x and back', () => {
    expect(xToSample(sampleToX(123, 2.5), 2.5)).toBeCloseTo(123)
    expect(contentWidth(101, 2)).toBe(sampleToX(100, 2) + sampleToX(0, 2))
  })
})
