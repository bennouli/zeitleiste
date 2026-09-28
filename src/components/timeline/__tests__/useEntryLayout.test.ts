import { entries } from '@/data/entries'
import {
    buildClusterTree,
    isGroup,
    type Cluster,
    type ClusterNode,
} from '@/lib/cluster'
import { isSpan, type Entry } from '@/lib/entry'
import type { Slot } from '@/lib/placement'
import { entryAnchor, MS_PER_DAY, MS_PER_YEAR } from '@/lib/time'
import { sampleEntry } from '@/test/entries'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { estimateLabelWidthPx, LABEL_MAX_WIDTH_PX } from '../labelMetrics'
import {
    PRIVATE_UNDER_TESTS,
    useEntryLayout,
    type EntryLayout,
    type LayoutGeometry,
    type LayoutItem,
} from '../useEntryLayout'

const { layoutEntries, parentMap, markerCollisions, mergeInto } =
    PRIVATE_UNDER_TESTS

const POINT = sampleEntry('dekabristenaufstand')
const spans = entries.filter(isSpan)
const T0 = Date.UTC(1700, 0, 1)
const T1 = Date.UTC(2026, 8, 27)
const Y1918 = Date.UTC(1918, 0, 1)
const Y1900 = Date.UTC(1900, 0, 1)

type LayoutScenario = {
    pts: Entry[]
    width: number
    visibleYears: number
    centerT?: number
    previous?: Map<string, Slot> | null
    maxLevels?: number
    groupLevels?: number
}

const WIDE_DESKTOP: LayoutScenario = {
    pts: entries,
    width: 1920,
    visibleYears: 300,
}
const WIDE_LAPTOP: LayoutScenario = {
    pts: entries,
    width: 1000,
    visibleYears: 300,
}
const NEAR_1918_LAPTOP: LayoutScenario = {
    pts: entries,
    width: 1000,
    visibleYears: 10,
    centerT: Y1918,
}
const ZERO_WIDTH: LayoutScenario = { pts: entries, width: 0, visibleYears: 300 }
const NO_ENTRIES: LayoutScenario = { pts: [], width: 1000, visibleYears: 300 }
const GAP_PX = 8
const DEFAULT_LEVELS = 3

/** Layout of `pts` with `visibleYears` across `width` px, centered on `centerT`. */
function layout({
    pts,
    width,
    visibleYears,
    centerT = (T0 + T1) / 2,
    previous = null,
    maxLevels = DEFAULT_LEVELS,
    groupLevels = DEFAULT_LEVELS,
}: LayoutScenario): EntryLayout {
    const span = visibleYears * MS_PER_YEAR
    const geometry = {
        timeToX: timeToXOf({ pts, width, visibleYears, centerT }),
        msPerPx: span / width,
        width,
        maxLevels,
        groupLevels,
        gapPx: GAP_PX,
    }
    const tree = buildClusterTree(
        pts.map((e) => ({ id: e.id, t: entryAnchor(e) }))
    )
    const parents = parentMap(tree)
    return layoutEntries(pts, geometry, tree, parents, previous)
}

function timeToXOf({
    width,
    visibleYears,
    centerT = (T0 + T1) / 2,
}: LayoutScenario): (t: number) => number {
    const span = visibleYears * MS_PER_YEAR
    const start = centerT - span / 2
    return (t) => ((t - start) / span) * width
}

/** Rows an item covers on its side: every group row for a stack, its own row for a card. */
function rowsOf(item: LayoutItem, groupLevels = DEFAULT_LEVELS): number[] {
    return item.kind === 'group'
        ? Array.from({ length: groupLevels }, (_, level) => level)
        : [item.slot.level]
}

function isNear(a: [number, number], b: [number, number]): boolean {
    return a[0] < b[1] + GAP_PX && b[0] < a[1] + GAP_PX
}

function extent(
    item: LayoutItem,
    timeToX: (t: number) => number
): [number, number] {
    const x = timeToX(item.t)
    const width =
        item.kind === 'card'
            ? estimateLabelWidthPx(item.entries[0]!)
            : LABEL_MAX_WIDTH_PX
    return [x, x + width]
}

function checkInvariants(
    pts: Entry[],
    entryLayout: EntryLayout,
    width: number,
    visibleYears: number,
    centerT: number
) {
    const timeToX = timeToXOf({ pts, width, visibleYears, centerT })
    // Every entry exactly once.
    const seen = entryLayout.items
        .flatMap((i) => i.entries.map((e) => e.id))
        .sort()
    expect(seen).toEqual(pts.map((e) => e.id).sort())
    // Chronological members and items.
    for (const i of entryLayout.items) {
        for (let k = 1; k < i.entries.length; k++)
            expect(entryAnchor(i.entries[k]!)).toBeGreaterThanOrEqual(
                entryAnchor(i.entries[k - 1]!)
            )
    }
    for (let k = 1; k < entryLayout.items.length; k++)
        expect(entryLayout.items[k]!.t).toBeGreaterThanOrEqual(
            entryLayout.items[k - 1]!.t
        )
    // No two placed items share a row and overlap.
    const placedItems = entryLayout.items.filter((i) => i.kind !== 'marker')
    for (let a = 0; a < placedItems.length; a++) {
        for (let b = a + 1; b < placedItems.length; b++) {
            const A = placedItems[a]!
            const B = placedItems[b]!
            const sameSide = A.slot.side === B.slot.side
            const rowsB = rowsOf(B)
            if (!sameSide || !rowsOf(A).some((r) => rowsB.includes(r))) continue
            expect(
                isNear(extent(A, timeToX), extent(B, timeToX)),
                `${A.id} overlaps ${B.id}`
            ).toBe(false)
        }
    }
}

describe('layoutEntries', () => {
    it('shows every sample entry exactly once without overlaps at several zoom levels and widths', () => {
        for (const width of [360, 1000, 1920]) {
            for (const years of [300, 100, 40, 10, 2]) {
                for (const center of [
                    (T0 + T1) / 2,
                    Date.UTC(1917, 6, 1),
                    T1,
                ]) {
                    const scenario: LayoutScenario = {
                        pts: entries,
                        width,
                        visibleYears: years,
                        centerT: center,
                    }
                    checkInvariants(
                        entries,
                        layout(scenario),
                        width,
                        years,
                        center
                    )
                }
            }
        }
    })

    it('alternates consecutive single entries between the sides wherever the other side has room', () => {
        const EVENLY_SPACED: Entry[] = Array.from({ length: 12 }, (_, k) => ({
            ...POINT,
            id: `even${k}`,
            title: `Punkt ${k}`,
            start: { year: 1710 + k * 25 },
            end: undefined,
        }))
        const evenlySpaced: LayoutScenario = {
            pts: EVENLY_SPACED,
            width: 1920,
            visibleYears: 300,
        }
        const initialViews: LayoutScenario[] = [
            WIDE_DESKTOP,
            { ...WIDE_DESKTOP, width: 1280 },
            WIDE_LAPTOP,
        ]
        const evenSides = layout(evenlySpaced).items.map((i) => i.slot.side)
        expect(evenSides).toEqual(
            EVENLY_SPACED.map((_, k) => (k % 2 === 0 ? 'above' : 'below'))
        )
        for (const scenario of [evenlySpaced, ...initialViews]) {
            const entryLayout = layout(scenario)
            const timeToX = timeToXOf(scenario)
            const maxLevels = scenario.maxLevels ?? DEFAULT_LEVELS
            const cardPairs = entryLayout.items
                .slice(1)
                .map((later, k) => [entryLayout.items[k]!, later] as const)
                .filter(([a, b]) => a.kind === 'card' && b.kind === 'card')
            expect(cardPairs.length).toBeGreaterThan(1)
            for (const [earlier, later] of cardPairs) {
                if (earlier.slot.side !== later.slot.side) continue
                const otherSide =
                    later.slot.side === 'above' ? 'below' : 'above'
                const laterExtent = extent(later, timeToX)
                const isRowTaken = (level: number) =>
                    entryLayout.items.some(
                        (i) =>
                            i.kind !== 'marker' &&
                            i.slot.side === otherSide &&
                            rowsOf(i, scenario.groupLevels).includes(level) &&
                            isNear(extent(i, timeToX), laterExtent)
                    )
                const levels = Array.from({ length: maxLevels }, (_, l) => l)
                expect(
                    levels.every(isRowTaken),
                    `${earlier.id} and ${later.id} share a side`
                ).toBe(true)
            }
        }
    })

    it('groups the crowded years at the widest zoom and splits them when zoomed in', () => {
        const wide = layout(WIDE_LAPTOP)
        const group = wide.items.find(
            (i) =>
                i.kind !== 'card' &&
                i.entries.some((e) => e.id === 'oktoberrevolution')
        )
        expect(group).toBeDefined()
        expect(group!.entries.length).toBeGreaterThanOrEqual(3)
        const near = layout(NEAR_1918_LAPTOP)
        const single = near.items.find((i) =>
            i.entries.some((e) => e.id === 'oktoberrevolution')
        )
        expect(single?.kind).toBe('card')
    })

    it('never drops entries under extreme crowding; the rest become bare markers', () => {
        const many: Entry[] = Array.from({ length: 300 }, (_, k) => ({
            ...POINT,
            id: `p${k}`,
            title: `Punkt ${k}`,
            start: {
                year: 1700 + Math.floor((k * 326) / 300),
                month: 1 + (k % 12),
            },
            end: undefined,
            importance: ((k % 3) + 1) as 1 | 2 | 3,
        }))
        const narrowPhone1900: LayoutScenario = {
            pts: many,
            width: 375,
            visibleYears: 40,
            centerT: Y1900,
            maxLevels: 1,
            groupLevels: 2,
        }
        const entryLayout = layout(narrowPhone1900)
        checkInvariants(many, entryLayout, 375, 40, Y1900)
        // Groups never span more than the cap in px (a marker far from its members would mislead).
        const span = 40 * MS_PER_YEAR
        for (const i of entryLayout.items.filter((i) => i.kind === 'group')) {
            const px =
                ((entryAnchor(i.entries.at(-1)!) - entryAnchor(i.entries[0]!)) /
                    span) *
                375
            expect(px).toBeLessThanOrEqual(352 + 1)
        }
    })

    it('keeps previous slots that still fit', () => {
        const first = layout(WIDE_DESKTOP)
        const previous = new Map(first.items.map((i) => [i.id, i.slot]))
        const withPrevious: LayoutScenario = { ...WIDE_DESKTOP, previous }
        const second = layout(withPrevious)
        for (const i of second.items) expect(i.slot).toEqual(previous.get(i.id))
    })

    it('returns nothing for width 0 or no entries', () => {
        expect(layout(ZERO_WIDTH).items).toEqual([])
        expect(layout(NO_ENTRIES).items).toEqual([])
    })

    it("counts a span's date range in its label width, so it groups when rows run out", () => {
        // '1. Jan. – 30. Nov. 1900' is far wider than the title.
        const span: Entry = {
            ...POINT,
            id: 'span',
            title: 'X',
            start: { year: 1900, month: 1, day: 1 },
            end: { year: 1900, month: 11, day: 30 },
        }
        const asPoint: Entry = { ...span, end: undefined }
        const spanWidth = estimateLabelWidthPx(span)
        const pointWidth = estimateLabelWidthPx(asPoint)
        // Right of where the span's label would end as a point, left of where its range line ends.
        const lateDays = Math.round((spanWidth + pointWidth) / 2)
        const early: Entry = {
            ...POINT,
            id: 'early',
            title: 'Ein Punkt mit einem langen Titel',
            start: { year: 1900, month: 1, day: 1 + 50 },
        }
        const late: Entry = {
            ...POINT,
            id: 'late',
            title: 'Y',
            start: dayOf(Date.UTC(1900, 0, 1) + lateDays * MS_PER_DAY),
        }
        const onePxPerDay: LayoutGeometry = {
            timeToX: (t) => (t - Date.UTC(1900, 0, 1)) / MS_PER_DAY,
            msPerPx: MS_PER_DAY,
            width: 1000,
            maxLevels: 1,
            groupLevels: 1,
            gapPx: GAP_PX,
        }
        const layoutOf = (pts: Entry[]) => {
            const tree = buildClusterTree(
                pts.map((e) => ({ id: e.id, t: entryAnchor(e) }))
            )
            return layoutEntries(pts, onePxPerDay, tree, parentMap(tree), null)
        }

        const withSpan = layoutOf([span, early, late])
        const withPoint = layoutOf([asPoint, early, late])

        expect(lateDays - pointWidth).toBeGreaterThan(GAP_PX)
        expect(spanWidth - lateDays).toBeGreaterThan(GAP_PX)
        expect(withPoint.items.map((i) => i.kind)).toEqual([
            'card',
            'card',
            'card',
        ])
        expect(withSpan.items.some((i) => i.kind !== 'card')).toBe(true)
    })
})

describe('useEntryLayout', () => {
    it('places spans at their start like points', () => {
        const geometry: LayoutGeometry = {
            timeToX: timeToXOf(WIDE_DESKTOP),
            msPerPx:
                (WIDE_DESKTOP.visibleYears * MS_PER_YEAR) / WIDE_DESKTOP.width,
            width: WIDE_DESKTOP.width,
            maxLevels: DEFAULT_LEVELS,
            groupLevels: DEFAULT_LEVELS,
            gapPx: GAP_PX,
        }

        const { result } = renderHook(() =>
            useEntryLayout(entries, geometry, 'key')
        )

        const itemOf = (id: string) =>
            result.current.items.find((i) => i.entries.some((e) => e.id === id))
        for (const span of spans) expect(itemOf(span.id)).toBeDefined()
        const spanCards = result.current.items.filter(
            (i) => i.kind === 'card' && isSpan(i.entries[0]!)
        )
        expect(spanCards.length).toBeGreaterThan(0)
        for (const card of spanCards)
            expect(card.t).toBe(entryAnchor(card.entries[0]!))
    })
})

describe('parentMap', () => {
    it('maps every child to its node and leaves the root out', () => {
        const tree = buildClusterTree([
            { id: 'a', t: 0 },
            { id: 'b', t: 1 },
            { id: 'c', t: 10 },
        ])
        const root = tree as ClusterNode
        const ab = root.left as ClusterNode

        const parents = parentMap(tree)

        expect(
            Object.fromEntries([...parents].map(([id, p]) => [id, p.id]))
        ).toEqual({ a: ab.id, b: ab.id, [ab.id]: root.id, c: root.id })
    })

    it('is empty for no tree or a single leaf', () => {
        const leaf = buildClusterTree([{ id: 'a', t: 0 }])

        expect(parentMap(null).size).toBe(0)
        expect(parentMap(leaf).size).toBe(0)
    })
})

describe('markerCollisions', () => {
    const tree = buildClusterTree([
        { id: 'a', t: 0 },
        { id: 'b', t: 1 },
        { id: 'c', t: 20 },
        { id: 'd', t: 21 },
        { id: 'g', t: 30 },
        { id: 'h', t: 50 },
        { id: 'i', t: 51 },
    ])
    const ab = findNode(tree!, ['a', 'b'])
    const cd = findNode(tree!, ['c', 'd'])
    const hi = findNode(tree!, ['h', 'i'])
    const g = leavesOf(tree!).find((leaf) => leaf.id === 'g')!
    const cut = [ab, cd, g, hi]
    const identity = (t: number) => t

    it('flags a group marker too close to the last kept one; cards are ignored', () => {
        const markerOnly = new Set<string>()

        const collisions = markerCollisions(cut, markerOnly, identity)

        expect([...collisions]).toEqual([cd.id])
    })

    it('never flags a bare marker, but later markers keep their distance to it', () => {
        const markerOnly = new Set(['g'])

        const collisions = markerCollisions(cut, markerOnly, identity)

        expect([...collisions]).toEqual([cd.id, hi.id])
    })
})

describe('mergeInto', () => {
    const tree = buildClusterTree([
        { id: 'x', t: 0 },
        { id: 'a', t: 10 },
        { id: 'b', t: 11 },
        { id: 'c', t: 12 },
        { id: 'y', t: 30 },
    ])
    const leaves = Object.fromEntries(
        leavesOf(tree!).map((leaf) => [leaf.id, leaf])
    )
    const abc = findNode(tree!, ['a', 'b', 'c'])

    it('replaces the members by the parent at the first member, keeping the rest in order', () => {
        const cut = [leaves.x!, leaves.a!, leaves.b!, leaves.c!, leaves.y!]

        const merged = mergeInto(cut, abc)

        expect(merged.map((cluster) => cluster.id)).toEqual(['x', abc.id, 'y'])
    })

    it('absorbs a nested node of the cut', () => {
        const ab = findNode(tree!, ['a', 'b'])
        const cut = [leaves.x!, ab, leaves.c!, leaves.y!]

        const merged = mergeInto(cut, abc)

        expect(merged.map((cluster) => cluster.id)).toEqual(['x', abc.id, 'y'])
    })

    it('leaves a cut without members unchanged', () => {
        const cut = [leaves.x!, leaves.y!]

        expect(mergeInto(cut, abc)).toEqual(cut)
    })
})

function dayOf(t: number): Entry['start'] {
    const date = new Date(t)
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
    }
}

function leavesOf(cluster: Cluster): Cluster[] {
    return isGroup(cluster)
        ? [...leavesOf(cluster.left), ...leavesOf(cluster.right)]
        : [cluster]
}

function nodesOf(cluster: Cluster): ClusterNode[] {
    return isGroup(cluster)
        ? [cluster, ...nodesOf(cluster.left), ...nodesOf(cluster.right)]
        : []
}

function findNode(cluster: Cluster, members: string[]): ClusterNode {
    const found = nodesOf(cluster).find(
        (node) => node.members.join() === members.join()
    )
    if (!found) throw new Error(`no node with members ${members.join()}`)
    return found
}
