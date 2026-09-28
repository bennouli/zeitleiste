import type { Entry } from '@/lib/entry'
import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../CardLayer'

const { groupLabel, markerLabel } = PRIVATE_UNDER_TESTS

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

describe('groupLabel', () => {
    it('names the count and the year range', () => {
        const entries = [entryIn(1914), entryIn(1917), entryIn(1922)]
        expect(groupLabel(entries)).toBe('Gruppe mit 3 Einträgen, 1914–1922')
    })

    it('names a single year once', () => {
        const entries = [entryIn(1917), entryIn(1917)]
        expect(groupLabel(entries)).toBe('Gruppe mit 2 Einträgen, 1917')
    })

    it('falls back to a bare name for an empty group', () => {
        expect(groupLabel([])).toBe('Gruppe')
    })
})

describe('markerLabel', () => {
    it('prefixes the group name with the zoom action', () => {
        const entries = [entryIn(1914), entryIn(1922)]
        expect(markerLabel(entries)).toBe(
            'Hineinzoomen: Gruppe mit 2 Einträgen, 1914–1922'
        )
    })
})
