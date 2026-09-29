import type { Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR } from '@/lib/time'
import type { Viewport } from '@/lib/viewport'
import { describe, expect, it } from 'vitest'
import { groupZoomTarget } from '../groupZoom'

function entryIn(year: number): Entry {
    return {
        id: `e${year}`,
        title: `Eintrag ${year}`,
        summary: 'Zusammenfassung',
        start: { year },
        type: 'event',
        tags: [],
    }
}

const WIDE_VIEW: Viewport = { start: 0, end: 1000 * MS_PER_YEAR }

describe('groupZoomTarget', () => {
    it('has no target for an empty group', () => {
        const empty: Entry[] = []
        expect(groupZoomTarget(empty, WIDE_VIEW)).toBeNull()
    })

    it('opens a single entry to two years around it', () => {
        const entry = entryIn(1917)
        const single = [entry]
        expect(groupZoomTarget(single, WIDE_VIEW)).toEqual({
            centerT: entryAnchor(entry),
            spanMs: 2 * MS_PER_YEAR,
        })
    })

    it('opens a group to three times its width around its middle', () => {
        const first = entryIn(1910)
        const last = entryIn(1920)
        const t0 = entryAnchor(first)
        const t1 = entryAnchor(last)
        const group = [first, last]
        expect(groupZoomTarget(group, WIDE_VIEW)).toEqual({
            centerT: (t0 + t1) / 2,
            spanMs: (t1 - t0) * 3,
        })
    })

    it('zooms to at most half the current span', () => {
        const narrowView: Viewport = {
            start: entryAnchor(entryIn(1900)),
            end: entryAnchor(entryIn(1940)),
        }
        const group = [entryIn(1900), entryIn(1940)]
        expect(groupZoomTarget(group, narrowView)?.spanMs).toBe(
            (narrowView.end - narrowView.start) / 2
        )
    })
})
