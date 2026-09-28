import { entries } from '@/data/entries'
import {
    buildClusterTree,
    isGroup,
    type Cluster,
    type ClusterNode,
} from '@/lib/cluster'
import { isSpan, type Entry } from '@/lib/entry'
import type { Slot } from '@/lib/placement'
import { entryAnchor, MS_PER_YEAR } from '@/lib/time'
import { describe, expect, it } from 'vitest'
import { CARD_WIDTH_PX } from './EntryCard'
import {
    layoutEntries,
    type EntryLayout,
    type LayoutItem,
} from './useEntryLayout'

const points = entries.filter((e) => !isSpan(e))
const T0 = Date.UTC(1700, 0, 1)
const T1 = Date.UTC(2026, 8, 27)

function parentsOf(root: Cluster | null): Map<string, ClusterNode> {
    const parents = new Map<string, ClusterNode>()
    const stack: Cluster[] = root ? [root] : []
    while (stack.length) {
        const c = stack.pop()!
        if (!isGroup(c)) continue
        parents.set(c.left.id, c)
        parents.set(c.right.id, c)
        stack.push(c.left, c.right)
    }
    return parents
}

/** Layout of `pts` with `visibleYears` across `width` px, centered on `centerT`. */
function layout(
    pts: Entry[],
    width: number,
    visibleYears: number,
    centerT = (T0 + T1) / 2,
    previous: Map<string, Slot> | null = null,
    options: { maxLevels?: number; groupLevels?: number } = {}
): EntryLayout {
    const span = visibleYears * MS_PER_YEAR
    const start = centerT - span / 2
    const timeToX = (t: number) => ((t - start) / span) * width
    const root = buildClusterTree(
        pts.map((e) => ({ id: e.id, t: entryAnchor(e) }))
    )
    return layoutEntries(
        {
            points: pts,
            timeToX,
            msPerPx: span / width,
            width,
            maxLevels: options.maxLevels ?? 3,
            groupLevels: options.groupLevels ?? 3,
            gapPx: 8,
        },
        root,
        parentsOf(root),
        previous
    )
}

function extent(
    item: LayoutItem,
    timeToX: (t: number) => number
): [number, number] {
    const x = timeToX(item.t)
    return item.alignEnd ? [x - CARD_WIDTH_PX, x] : [x, x + CARD_WIDTH_PX]
}

function checkInvariants(
    pts: Entry[],
    l: EntryLayout,
    width: number,
    visibleYears: number,
    centerT: number
) {
    const span = visibleYears * MS_PER_YEAR
    const timeToX = (t: number) => ((t - (centerT - span / 2)) / span) * width
    // Every point exactly once.
    const seen = l.items.flatMap((i) => i.entries.map((e) => e.id)).sort()
    expect(seen).toEqual(pts.map((e) => e.id).sort())
    // Chronological members and items.
    for (const i of l.items) {
        for (let k = 1; k < i.entries.length; k++)
            expect(entryAnchor(i.entries[k]!)).toBeGreaterThanOrEqual(
                entryAnchor(i.entries[k - 1]!)
            )
    }
    for (let k = 1; k < l.items.length; k++)
        expect(l.items[k]!.t).toBeGreaterThanOrEqual(l.items[k - 1]!.t)
    // No two placed items share a row and overlap.
    const placed = l.items.filter((i) => i.kind !== 'marker')
    for (let a = 0; a < placed.length; a++) {
        for (let b = a + 1; b < placed.length; b++) {
            const A = placed[a]!
            const B = placed[b]!
            const sameSide = A.slot.side === B.slot.side
            const rowsA = A.kind === 'group' ? [0, 1, 2] : [A.slot.level]
            const rowsB = B.kind === 'group' ? [0, 1, 2] : [B.slot.level]
            if (!sameSide || !rowsA.some((r) => rowsB.includes(r))) continue
            const [a0, a1] = extent(A, timeToX)
            const [b0, b1] = extent(B, timeToX)
            expect(a0 < b1 + 8 && b0 < a1 + 8, `${A.id} overlaps ${B.id}`).toBe(
                false
            )
        }
    }
}

describe('layoutEntries', () => {
    it('shows every sample point exactly once without overlaps at several zoom levels and widths', () => {
        for (const width of [360, 1000, 1920]) {
            for (const years of [300, 100, 40, 10, 2]) {
                for (const center of [
                    (T0 + T1) / 2,
                    Date.UTC(1917, 6, 1),
                    T1,
                ]) {
                    checkInvariants(
                        points,
                        layout(points, width, years, center),
                        width,
                        years,
                        center
                    )
                }
            }
        }
    })

    it('places cards above first and below only when above is taken', () => {
        const l = layout(points, 1920, 300)
        expect(l.items.some((i) => i.slot.side === 'above')).toBe(true)
        const singles = l.items.filter((i) => i.kind === 'card')
        expect(singles.length).toBeGreaterThan(3)
    })

    it('groups the crowded years at the widest zoom and splits them when zoomed in', () => {
        const wide = layout(points, 1000, 300)
        const group = wide.items.find(
            (i) =>
                i.kind !== 'card' &&
                i.entries.some((e) => e.id === 'oktoberrevolution')
        )
        expect(group).toBeDefined()
        expect(group!.entries.length).toBeGreaterThanOrEqual(3)
        const near = layout(points, 1000, 10, Date.UTC(1918, 0, 1))
        const single = near.items.find((i) =>
            i.entries.some((e) => e.id === 'oktoberrevolution')
        )
        expect(single?.kind).toBe('card')
    })

    it('never drops entries under extreme crowding; the rest become bare markers', () => {
        const many: Entry[] = Array.from({ length: 300 }, (_, k) => ({
            ...points[0]!,
            id: `p${k}`,
            title: `Punkt ${k}`,
            start: {
                year: 1700 + Math.floor((k * 326) / 300),
                month: 1 + (k % 12),
            },
            end: undefined,
            importance: ((k % 3) + 1) as 1 | 2 | 3,
        }))
        const l = layout(many, 375, 40, Date.UTC(1900, 0, 1), null, {
            maxLevels: 1,
            groupLevels: 2,
        })
        checkInvariants(many, l, 375, 40, Date.UTC(1900, 0, 1))
        // Groups never span more than the cap in px (a marker far from its members would mislead).
        const span = 40 * MS_PER_YEAR
        for (const i of l.items.filter((i) => i.kind === 'group')) {
            const px =
                ((entryAnchor(i.entries.at(-1)!) - entryAnchor(i.entries[0]!)) /
                    span) *
                375
            expect(px).toBeLessThanOrEqual(352 + 1)
        }
    })

    it('keeps previous slots that still fit', () => {
        const first = layout(points, 1920, 300)
        const previous = new Map(first.items.map((i) => [i.id, i.slot]))
        const second = layout(points, 1920, 300, undefined, previous)
        for (const i of second.items) expect(i.slot).toEqual(previous.get(i.id))
    })

    it('returns nothing for width 0 or no points', () => {
        expect(layout(points, 0, 300).items).toEqual([])
        expect(layout([], 1000, 300).items).toEqual([])
    })
})
