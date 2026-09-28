import type { Entry } from '@/lib/entry'
import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../CardLayer'

const { markerLabel } = PRIVATE_UNDER_TESTS

function entryIn(year: number): Entry {
    return {
        id: `e${year}`,
        title: `Eintrag ${year}`,
        summary: 'Zusammenfassung',
        start: { year },
        region: 'russia',
        category: 'event',
        importance: 2,
    }
}

describe('markerLabel', () => {
    it('prefixes the group name with the zoom action', () => {
        const entries = [entryIn(1914), entryIn(1922)]
        expect(markerLabel(entries)).toBe(
            'Hineinzoomen: Gruppe mit 2 Einträgen, 1914–1922'
        )
    })
})
