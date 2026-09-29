import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../slugField'

const { slugOf } = PRIVATE_UNDER_TESTS

describe('slugOf', () => {
    it('transliterates a German title', () => {
        const title = 'Großer Nordischer Krieg'
        expect(slugOf(title)).toBe('grosser-nordischer-krieg')
    })

    it('has no slug for a missing, non-text or empty source', () => {
        expect(slugOf(undefined)).toBeUndefined()
        expect(slugOf(1917)).toBeUndefined()
        expect(slugOf(' – ')).toBeUndefined()
    })
})
