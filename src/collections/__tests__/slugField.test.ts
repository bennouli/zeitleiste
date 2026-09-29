import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../slugField'

const { filledSlug } = PRIVATE_UNDER_TESTS

describe('filledSlug', () => {
    const title = 'Großer Nordischer Krieg'

    it('generates the slug from the source text while the slug is empty', () => {
        expect(filledSlug(undefined, title)).toBe('grosser-nordischer-krieg')
        expect(filledSlug('', title)).toBe('grosser-nordischer-krieg')
    })

    it('keeps a slug once set, even when the source text changes', () => {
        const edited = 'nordischer-krieg'
        expect(filledSlug(edited, title)).toBe(edited)
    })

    it('leaves the slug empty when the source text yields none', () => {
        expect(filledSlug('', ' – ')).toBe('')
        expect(filledSlug(undefined, undefined)).toBeUndefined()
    })
})
