import { entries } from '@/data/entries'
import { describe, expect, it } from 'vitest'
import { slugify } from '../slug'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe('slugify', () => {
    it('spells out umlauts and ß', () => {
        const title = 'Großer Nordischer Krieg'
        expect(slugify(title)).toBe('grosser-nordischer-krieg')
        expect(slugify('Französische Revolution')).toBe(
            'franzoesische-revolution'
        )
        expect(slugify('Kronstädter Matrosenaufstand')).toBe(
            'kronstaedter-matrosenaufstand'
        )
    })

    it('strips other diacritics', () => {
        expect(slugify('Grande Armée')).toBe('grande-armee')
    })

    it('joins words and digits with single hyphens, trimmed', () => {
        expect(slugify('Terroranschläge vom 11. September')).toBe(
            'terroranschlaege-vom-11-september'
        )
        expect(slugify(' Hitler-Stalin-Pakt! ')).toBe('hitler-stalin-pakt')
    })

    it('returns an empty slug for text without letters or digits', () => {
        expect(slugify(' – ')).toBe('')
    })

    it('always yields a valid slug for the sample titles', () => {
        const invalid = entries
            .map((e) => slugify(e.title))
            .filter((slug) => !SLUG_PATTERN.test(slug))
        expect(invalid).toEqual([])
    })
})
