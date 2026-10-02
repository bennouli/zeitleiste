import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../slugField'

const { slugOf } = PRIVATE_UNDER_TESTS

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
