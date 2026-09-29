import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../slugField'

const { slugOf, slugOnSave } = PRIVATE_UNDER_TESTS

const requestIn = (locale: string) => ({ locale }) as unknown as PayloadRequest

describe('slugOf', () => {
    it('transliterates a German title', () => {
        const title = 'Großer Nordischer Krieg'
        expect(slugOf(title)).toBe('grosser-nordischer-krieg')
    })

    it('has no slug for a missing, non-text or empty source', () => {
        const year = 1917
        const dashOnly = ' – '
        expect(slugOf(undefined)).toBeUndefined()
        expect(slugOf(year)).toBeUndefined()
        expect(slugOf(dashOnly)).toBeUndefined()
    })
})

describe('slugOnSave', () => {
    const storedSlug = 'grosser-nordischer-krieg'

    it('derives the slug from the German title on a German save', () => {
        const args = {
            data: { slug: storedSlug },
            req: requestIn('de'),
            valueToSlugify: 'Nordischer Krieg',
        }
        expect(slugOnSave(args)).toBe('nordischer-krieg')
    })

    it('keeps the slug on an English save', () => {
        const args = {
            data: { slug: storedSlug },
            req: requestIn('en'),
            valueToSlugify: 'Great Northern War',
        }
        expect(slugOnSave(args)).toBe(storedSlug)
    })

    it('derives the slug from the English title for an entry created in English', () => {
        const args = {
            data: {},
            req: requestIn('en'),
            valueToSlugify: 'Great Northern War',
        }
        expect(slugOnSave(args)).toBe('great-northern-war')
    })
})
