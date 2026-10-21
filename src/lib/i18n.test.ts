import { describe, expect, it } from 'vitest'

import { detectLocale, getMessages } from './i18n'

describe('detectLocale', () => {
  it('uses Japanese when the preferred language is Japanese', () => {
    expect(detectLocale(['ja'])).toBe('ja')
    expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja')
  })

  it('falls back to English otherwise', () => {
    expect(detectLocale(['en-US', 'ja'])).toBe('en')
    expect(detectLocale(['fr-FR'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('messages', () => {
  it('defines every key in both locales', () => {
    const keys = (m: object): string[] =>
      Object.entries(m).flatMap(([k, v]) => (typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k]))
    expect(keys(getMessages('en')).sort()).toEqual(keys(getMessages('ja')).sort())
  })
})
