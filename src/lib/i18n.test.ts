import { describe, expect, it } from 'vitest'

import { detectLocale, getMessages, resolveLocale } from './i18n'

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

describe('resolveLocale', () => {
  it('lets the URL override the browser language', () => {
    expect(resolveLocale('/ja/', '', ['en-US'])).toBe('ja')
    expect(resolveLocale('/ja', '', ['en-US'])).toBe('ja')
    expect(resolveLocale('/', '?lang=en', ['ja-JP'])).toBe('en')
    expect(resolveLocale('/ja/', '?lang=en', ['ja-JP'])).toBe('en')
  })

  it('falls back to the browser language', () => {
    expect(resolveLocale('/', '', ['ja-JP'])).toBe('ja')
    expect(resolveLocale('/', '?lang=fr', ['en-US'])).toBe('en')
    expect(resolveLocale('/japan', '', ['en-US'])).toBe('en')
  })
})

describe('messages', () => {
  it('defines every key in both locales', () => {
    const keys = (m: object): string[] =>
      Object.entries(m).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keys(v).map((s) => `${k}.${s}`) : [k]))
    expect(keys(getMessages('en')).sort()).toEqual(keys(getMessages('ja')).sort())
  })
})
