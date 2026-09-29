import { describe, expect, it } from 'vitest'
import { preferredLocale } from '../preferredLocale'

describe('preferredLocale', () => {
    it.each([
        ['de-AT', 'de'],
        ['en-US,en;q=0.9', 'en'],
        ['fr', 'de'],
        ['fr, en;q=0.5', 'en'],
        ['fr;q=0.9, en;q=0.5, de;q=0.8', 'de'],
        ['EN-gb', 'en'],
        ['en;q=0, de;q=0.1', 'de'],
        ['en;q=0', 'de'],
        ['*, en;q=0.5', 'en'],
        ['en;q=abc, de;q=0.2', 'de'],
        ['en;q=, de;q=0.2', 'de'],
        ['en;q=2, de;q=0.2', 'de'],
        ['', 'de'],
    ])('%j → %s', (header, locale) => {
        expect(preferredLocale(header)).toBe(locale)
    })

    it('falls back to German without a header', () => {
        expect(preferredLocale(null)).toBe('de')
    })
})
