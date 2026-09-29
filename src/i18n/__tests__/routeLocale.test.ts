import { describe, expect, it, vi } from 'vitest'
import { documentLocale, routeLocale } from '../routeLocale'

vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
}))

describe('routeLocale', () => {
    it('decodes a locale segment', () => {
        expect(routeLocale('en')).toBe('en')
    })

    it.each(['xx', 'EN', ''])('is a 404 for %j', (lang) => {
        expect(() => routeLocale(lang)).toThrow('NEXT_NOT_FOUND')
    })
})

describe('documentLocale', () => {
    it('decodes a locale segment and falls back to German', () => {
        expect(documentLocale('en')).toBe('en')
        expect(documentLocale('xx')).toBe('de')
    })
})
