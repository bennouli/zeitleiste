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
    PRIVATE_UNDER_TESTS,
    type EntryLayout,
    type LayoutItem,
} from './useEntryLayout'

const { parentMap, markerCollisions, mergeInto } = PRIVATE_UNDER_TESTS

const points = entries.filter((e) => !isSpan(e))
const T0 = Date.UTC(1700, 0, 1)
const T1 = Date.UTC(2026, 8, 27)

type LayoutScenario = {
    pts: Entry[]
    width: number
    visibleYears: number
    centerT?: number
    previous?: Map<string, Slot> | null
    maxLevels?: number
    groupLevels?: number
}

/** Layout of `pts` with `visibleYears` across `width` px, centered on `centerT`. */
function layout({
    pts,
    width,
    visibleYears,
    centerT = (T0 + T1) / 2,
    previous = null,
    maxLevels = 3,
    groupLevels = 3,
}: LayoutScenario): EntryLayout {
    const span = visibleYears * MS_PER_YEAR
    const start = centerT - span / 2
    const geometry = {
        timeToX: (t: number) => ((t - start) / span) * width,
        msPerPx: span / width,
        width,
        maxLevels,
        groupLevels,
        gapPx: 8,
    }
    const tree = buildClusterTree(
        pts.map((e) => ({ id: e.id, t: entryAnchor(e) }))
    )
    const parents = parentMap(tree)
    return layoutEntries(pts, geometry, tree, parents, previous)
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
                        layout({
                            pts: points,
                            width,
                            visibleYears: years,
                            centerT: center,
                        }),
                        width,
                        years,
                        center
                    )
                }
            }
        }
    })

    it('places cards above first and below only when above is taken', () => {
        const l = layout({ pts: points, width: 1920, visibleYears: 300 })
        expect(l.items.some((i) => i.slot.side === 'above')).toBe(true)
        const singles = l.items.filter((i) => i.kind === 'card')
        expect(singles.length).toBeGreaterThan(3)
    })

    it('groups the crowded years at the widest zoom and splits them when zoomed in', () => {
        const wide = layout({ pts: points, width: 1000, visibleYears: 300 })
        const group = wide.items.find(
            (i) =>
                i.kind !== 'card' &&
                i.entries.some((e) => e.id === 'oktoberrevolution')
        )
        expect(group).toBeDefined()
        expect(group!.entries.length).toBeGreaterThanOrEqual(3)
        const near = layout({
            pts: points,
            width: 1000,
            visibleYears: 10,
            centerT: Date.UTC(1918, 0, 1),
        })
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
        const l = layout({
            pts: many,
            width: 375,
            visibleYears: 40,
            centerT: Date.UTC(1900, 0, 1),
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
        const first = layout({ pts: points, width: 1920, visibleYears: 300 })
        const previous = new Map(first.items.map((i) => [i.id, i.slot]))
        const second = layout({
            pts: points,
            width: 1920,
            visibleYears: 300,
            previous,
        })
        for (const i of second.items) expect(i.slot).toEqual(previous.get(i.id))
    })

    it('returns nothing for width 0 or no points', () => {
        expect(
            layout({ pts: points, width: 0, visibleYears: 300 }).items
        ).toEqual([])
        expect(
            layout({ pts: [], width: 1000, visibleYears: 300 }).items
        ).toEqual([])
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
