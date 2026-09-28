import { compareIds } from '@/lib/order'
import { describe, expect, it } from 'vitest'
import {
    PRIVATE_UNDER_TESTS,
    placeItems,
    type BlockedInterval,
    type PlaceableItem,
    type Placement,
    type Slot,
} from '../placement'

const { usedLevels, candidateSlots, candidateSlotsKeepingSide, buildRows } =
    PRIVATE_UNDER_TESTS

function item(
    id: string,
    x0: number,
    x1: number,
    importance = 1,
    order = 0
): PlaceableItem {
    return { id, x0, x1, importance, order }
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function randomItems(seed: number, n: number): PlaceableItem[] {
    const r = rng(seed)
    return Array.from({ length: n }, (_, i) => {
        const x0 = Math.round(r() * 1200)
        return item(
            `e${i}`,
            x0,
            x0 + 80 + Math.round(r() * 120),
            Math.floor(r() * 3),
            Math.round(r() * 50)
        )
    })
}

function shuffle<T>(arr: readonly T[], seed: number): T[] {
    const r = rng(seed)
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    return out
}

const sameRow = (a: Slot, b: Slot) => a.side === b.side && a.level === b.level
const conflicts = (a: PlaceableItem, b: PlaceableItem, gap: number) =>
    a.x0 < b.x1 + gap && b.x0 < a.x1 + gap

function sorted(items: readonly PlaceableItem[]): PlaceableItem[] {
    return [...items].sort(
        (a, b) =>
            b.importance - a.importance ||
            a.order - b.order ||
            compareIds(a.id, b.id)
    )
}

/**
 * Naive O(n²) oracle: each item keeps its previous slot if that row was free when it was placed,
 * otherwise it takes the first free row on its previous side, then the first free slot in try order.
 */
function checkOracle(
    items: readonly PlaceableItem[],
    p: Placement,
    gap = 8,
    maxLevels = 2,
    previous: ReadonlyMap<string, Slot> | null = null
) {
    const order = candidateSlots(maxLevels)
    const placed: { item: PlaceableItem; slot: Slot }[] = []
    for (const it of sorted(items)) {
        const free = (s: Slot) =>
            s.level < maxLevels &&
            !placed.some(
                (q) => sameRow(q.slot, s) && conflicts(q.item, it, gap)
            )
        const prev = previous?.get(it.id)
        const expected =
            prev && free(prev)
                ? prev
                : (prev
                      ? candidateSlotsKeepingSide(maxLevels, prev.side)
                      : order
                  ).find(free)
        const actual = p.slots.get(it.id)
        if (expected === undefined) {
            expect(actual).toBeUndefined()
            expect(p.overflow).toContain(it.id)
        } else {
            expect(actual, it.id).toEqual(expected)
            placed.push({ item: it, slot: expected })
        }
    }
}

function checkNoOverlap(
    items: readonly PlaceableItem[],
    p: Placement,
    gap = 8
) {
    const byId = new Map(items.map((i) => [i.id, i]))
    const entries = [...p.slots.entries()]
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const [ida, sa] = entries[i]!
            const [idb, sb] = entries[j]!
            if (sameRow(sa, sb))
                expect(conflicts(byId.get(ida)!, byId.get(idb)!, gap)).toBe(
                    false
                )
        }
    }
}

describe('placeItems', () => {
    it('puts two overlapping cards one above and one below', () => {
        const p = placeItems([item('a', 0, 100), item('b', 50, 150)], null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 0 })
        expect(p.overflow).toEqual([])
    })

    it('keeps non-overlapping cards above', () => {
        const p = placeItems([item('a', 0, 100), item('b', 200, 300)], null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'above', level: 0 })
        expect(usedLevels(p)).toEqual({ above: 1, below: 0 })
    })

    it('never moves a card below if it fits above (oracle, random sets)', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const items = randomItems(seed, 10 + (seed % 5) * 20)
            const p = placeItems(items, null)
            checkOracle(items, p)
            checkNoOverlap(items, p)
            expect(p.slots.size + p.overflow.length).toBe(items.length)
        }
    })

    it('matches the oracle for other gaps and level counts', () => {
        for (const [gap, maxLevels] of [
            [0, 1],
            [0, 3],
            [20, 2],
            [4, 4],
        ] as const) {
            for (let seed = 1; seed <= 10; seed++) {
                const items = randomItems(seed * 31, 60)
                const p = placeItems(items, null, { gapPx: gap, maxLevels })
                checkOracle(items, p, gap, maxLevels)
                checkNoOverlap(items, p, gap)
            }
        }
    })

    it('normalizes swapped extents and handles zero-width cards', () => {
        const p = placeItems(
            [
                item('a', 100, 0, 2),
                item('b', 50, 50, 1),
                item('c', 108, 108, 0),
            ],
            null
        )
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'above', level: 0 })
    })

    it('sends duplicate ids and non-finite extents to overflow', () => {
        const p = placeItems(
            [
                item('a', 0, 100, 2),
                item('a', 500, 600, 1),
                item('n', NaN, 100),
                item('m', 0, Infinity),
            ],
            null
        )
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.overflow).toEqual(['a', 'm', 'n'])
        expect(p.slots.size + p.overflow.length).toBe(4)
    })

    it('returns independent slot objects', () => {
        const p = placeItems([item('a', 0, 100), item('b', 200, 300)], null)
        expect(p.slots.get('a')).not.toBe(p.slots.get('b'))
    })

    it('gives the more important of two overlapping cards the above slot', () => {
        const p = placeItems(
            [item('minor', 0, 100, 1, 0), item('major', 50, 150, 3, 10)],
            null
        )
        expect(p.slots.get('major')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('minor')).toEqual({ side: 'below', level: 0 })
    })

    it('breaks importance ties by order, then by id', () => {
        const p = placeItems(
            [item('a', 0, 100, 1, 5), item('b', 0, 100, 1, 2)],
            null
        )
        expect(p.slots.get('b')?.side).toBe('above')
        const q = placeItems([item('y', 0, 100), item('x', 0, 100)], null)
        expect(q.slots.get('x')?.side).toBe('above')
    })

    it('overflows when all four rows are full at one x', () => {
        const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) =>
            item(id, i, 100 + i, 10 - i)
        )
        const p = placeItems(items, null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'above', level: 1 })
        expect(p.slots.get('d')).toEqual({ side: 'below', level: 1 })
        expect(p.overflow).toEqual(['e', 'f'])
        expect(usedLevels(p)).toEqual({ above: 2, below: 2 })
    })

    it('respects maxLevels', () => {
        const items = [
            item('a', 0, 100, 3),
            item('b', 0, 100, 2),
            item('c', 0, 100, 1),
        ]
        const p = placeItems(items, null, { maxLevels: 1 })
        expect(p.overflow).toEqual(['c'])
        expect(placeItems(items, null, { maxLevels: 0 }).overflow).toEqual([
            'a',
            'b',
            'c',
        ])
    })

    it('respects the gap; touching cards (x1 + gap == x0) fit in one row', () => {
        const touching = placeItems(
            [item('a', 0, 100), item('b', 108, 200)],
            null
        )
        expect(touching.slots.get('b')).toEqual({ side: 'above', level: 0 })
        const tooClose = placeItems(
            [item('a', 0, 100), item('b', 107, 200)],
            null
        )
        expect(tooClose.slots.get('b')).toEqual({ side: 'below', level: 0 })
        const left = placeItems([item('a', 108, 200), item('b', 0, 101)], null)
        expect(left.slots.get('b')).toEqual({ side: 'below', level: 0 })
        const leftTouching = placeItems(
            [item('a', 108, 200), item('b', 0, 100)],
            null
        )
        expect(leftTouching.slots.get('b')).toEqual({ side: 'above', level: 0 })
        const zeroGap = placeItems(
            [item('a', 0, 100), item('b', 100, 200)],
            null,
            { gapPx: 0 }
        )
        expect(zeroGap.slots.get('b')).toEqual({ side: 'above', level: 0 })
        const custom = placeItems(
            [item('a', 0, 100), item('b', 120, 200)],
            null,
            { gapPx: 20 }
        )
        expect(custom.slots.get('b')).toEqual({ side: 'above', level: 0 })
        const customClose = placeItems(
            [item('a', 0, 100), item('b', 119, 200)],
            null,
            { gapPx: 20 }
        )
        expect(customClose.slots.get('b')).toEqual({ side: 'below', level: 0 })
    })

    it('checks neighbours on both sides when inserting between cards', () => {
        const p = placeItems(
            [
                item('l', 0, 100, 3),
                item('r', 300, 400, 3),
                item('mid', 108, 292, 1),
                item('wide', 90, 310, 0),
            ],
            null
        )
        expect(p.slots.get('mid')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('wide')).toEqual({ side: 'below', level: 0 })
    })

    describe('hysteresis', () => {
        it('keeps a card below when both sides are free', () => {
            const prev = new Map<string, Slot>([
                ['a', { side: 'below', level: 0 }],
            ])
            const p = placeItems([item('a', 0, 100)], prev)
            expect(p.slots.get('a')).toEqual({ side: 'below', level: 0 })
        })

        it('keeps a card on a higher level while it fits there', () => {
            const prev = new Map<string, Slot>([
                ['a', { side: 'above', level: 1 }],
            ])
            expect(
                placeItems([item('a', 0, 100)], prev).slots.get('a')
            ).toEqual({ side: 'above', level: 1 })
        })

        it('does not flip-flop when recomputed from its own output', () => {
            const items = randomItems(7, 60)
            const first = placeItems(items, null)
            const second = placeItems(items, first.slots)
            expect(second.slots).toEqual(first.slots)
            expect(second.overflow).toEqual(first.overflow)
        })

        it('falls back to the try order when its previous slot is taken', () => {
            const items = [item('major', 0, 100, 5), item('minor', 50, 150, 1)]
            const prevBelow = new Map<string, Slot>([
                ['major', { side: 'below', level: 0 }],
                ['minor', { side: 'below', level: 0 }],
            ])
            const p = placeItems(items, prevBelow)
            expect(p.slots.get('major')).toEqual({ side: 'below', level: 0 })
            // Stays on its side, one row further out, instead of changing sides.
            expect(p.slots.get('minor')).toEqual({ side: 'below', level: 1 })
            const prevAbove = new Map<string, Slot>([
                ['minor', { side: 'above', level: 0 }],
            ])
            const q = placeItems(items, prevAbove)
            expect(q.slots.get('major')).toEqual({ side: 'above', level: 0 })
            expect(q.slots.get('minor')).toEqual({ side: 'above', level: 1 })
            // Only when its side is full does it cross over.
            const r = placeItems(items, prevAbove, { maxLevels: 1 })
            expect(r.slots.get('minor')).toEqual({ side: 'below', level: 0 })
        })

        it('ignores previous entries for unknown ids and invalid slots', () => {
            const prev = new Map<string, Slot>([
                ['ghost', { side: 'above', level: 0 }],
                ['a', { side: 'sideways' as Slot['side'], level: 0 }],
            ])
            expect(
                placeItems([item('a', 0, 100)], prev).slots.get('a')
            ).toEqual({ side: 'above', level: 0 })
        })

        it('keeps only the side of a previous slot beyond maxLevels', () => {
            const prev = new Map<string, Slot>([
                ['a', { side: 'below', level: 3 }],
            ])
            expect(
                placeItems([item('a', 0, 100)], prev).slots.get('a')
            ).toEqual({ side: 'below', level: 0 })
        })

        it('never produces overlaps with arbitrary previous slots', () => {
            const r = rng(99)
            const items = randomItems(11, 80)
            const prev = new Map<string, Slot>(
                items.map((i) => [
                    i.id,
                    {
                        side: r() < 0.5 ? 'above' : 'below',
                        level: Math.floor(r() * 2),
                    },
                ])
            )
            const p = placeItems(items, prev)
            checkOracle(items, p, 8, 2, prev)
            checkNoOverlap(items, p)
            expect(p.slots.size + p.overflow.length).toBe(items.length)
        })
    })

    it('is deterministic and independent of input order', () => {
        const items = randomItems(3, 80)
        const a = placeItems(items, null)
        const b = placeItems(items, null)
        const c = placeItems(shuffle(items, 5), null)
        expect(b.slots).toEqual(a.slots)
        expect(b.overflow).toEqual(a.overflow)
        expect(c.slots).toEqual(a.slots)
        expect(c.overflow).toEqual(a.overflow)
    })

    it('handles empty input', () => {
        const p = placeItems([], null)
        expect(p.slots.size).toBe(0)
        expect(p.overflow).toEqual([])
        expect(usedLevels(p)).toEqual({ above: 0, below: 0 })
    })
})

describe('usedLevels', () => {
    it('counts rows per side', () => {
        const p: Placement = {
            slots: new Map<string, Slot>([
                ['a', { side: 'above', level: 0 }],
                ['b', { side: 'below', level: 1 }],
            ]),
            overflow: ['c'],
        }
        expect(usedLevels(p)).toEqual({ above: 1, below: 2 })
    })

    describe('blocked intervals', () => {
        it('keeps items out of blocked rows and lets them use the free ones', () => {
            const item = { id: 'a', x0: 0, x1: 100, importance: 1, order: 0 }
            const p = placeItems([item], null, {
                maxLevels: 2,
                blocked: [
                    { side: 'above', level: 0, x0: 0, x1: 100 },
                    { side: 'below', level: 0, x0: 50, x1: 60 },
                ],
            })
            expect(p.slots.get('a')).toEqual({ side: 'above', level: 1 })
        })

        it('respects the gap next to a blocked interval and merges overlapping blocks', () => {
            const p = placeItems(
                [{ id: 'a', x0: 104, x1: 200, importance: 1, order: 0 }],
                null,
                {
                    maxLevels: 1,
                    gapPx: 8,
                    blocked: [
                        { side: 'above', level: 0, x0: 0, x1: 60 },
                        { side: 'above', level: 0, x0: 40, x1: 100 },
                    ],
                }
            )
            expect(p.slots.get('a')).toEqual({ side: 'below', level: 0 })
            const q = placeItems(
                [{ id: 'a', x0: 108, x1: 200, importance: 1, order: 0 }],
                null,
                {
                    maxLevels: 1,
                    gapPx: 8,
                    blocked: [{ side: 'above', level: 0, x0: 0, x1: 100 }],
                }
            )
            expect(q.slots.get('a')).toEqual({ side: 'above', level: 0 })
        })

        it('overflows when every row is blocked', () => {
            const p = placeItems(
                [{ id: 'a', x0: 0, x1: 100, importance: 1, order: 0 }],
                null,
                {
                    maxLevels: 1,
                    blocked: [
                        { side: 'above', level: 0, x0: 0, x1: 100 },
                        { side: 'below', level: 0, x0: 0, x1: 100 },
                    ],
                }
            )
            expect(p.overflow).toEqual(['a'])
        })
    })

    describe('hysteresis keeps the side', () => {
        it('moves to another row on the same side before changing sides', () => {
            const blocker = { id: 'b', x0: 0, x1: 100, importance: 3, order: 0 }
            const item = { id: 'a', x0: 10, x1: 110, importance: 1, order: 1 }
            const previous = new Map([
                ['a', { side: 'below' as const, level: 0 }],
            ])
            // 'b' takes above 0; the previous below 0 is blocked, so 'a' should go to below 1, not above 1.
            const p = placeItems([blocker, item], previous, {
                maxLevels: 2,
                blocked: [{ side: 'below', level: 0, x0: 0, x1: 200 }],
            })
            expect(p.slots.get('a')).toEqual({ side: 'below', level: 1 })
        })
    })
})

describe('candidateSlots', () => {
    it('alternates sides level by level', () => {
        expect(candidateSlots(2)).toEqual([
            { side: 'above', level: 0 },
            { side: 'below', level: 0 },
            { side: 'above', level: 1 },
            { side: 'below', level: 1 },
        ])
    })

    it('is empty for zero levels', () => {
        expect(candidateSlots(0)).toEqual([])
    })
})

describe('candidateSlotsKeepingSide', () => {
    it('lists every row on the given side before the other side', () => {
        expect(candidateSlotsKeepingSide(2, 'below')).toEqual([
            { side: 'below', level: 0 },
            { side: 'below', level: 1 },
            { side: 'above', level: 0 },
            { side: 'above', level: 1 },
        ])
    })

    it('is empty for zero levels', () => {
        expect(candidateSlotsKeepingSide(0, 'above')).toEqual([])
    })
})

describe('buildRows', () => {
    it('builds maxLevels empty rows per side', () => {
        const noBlocked: BlockedInterval[] = []
        const rows = buildRows(3, 8, noBlocked)
        expect(rows.above).toHaveLength(3)
        expect(rows.below).toHaveLength(3)
        expect(rows.above[0]!.isFree(0, 100)).toBe(true)
    })

    it('blocks an interval given in either direction, keeping the gap', () => {
        const blocked: BlockedInterval[] = [
            { side: 'below', level: 1, x0: 200, x1: 100 },
        ]
        const rows = buildRows(2, 8, blocked)
        expect(rows.below[1]!.isFree(150, 160)).toBe(false)
        expect(rows.below[1]!.isFree(208, 300)).toBe(true)
        expect(rows.below[1]!.isFree(201, 300)).toBe(false)
        expect(rows.below[0]!.isFree(150, 160)).toBe(true)
        expect(rows.above[1]!.isFree(150, 160)).toBe(true)
    })

    it('ignores non-finite and out-of-range blocked intervals', () => {
        const blocked: BlockedInterval[] = [
            { side: 'above', level: 0, x0: 0, x1: Infinity },
            { side: 'above', level: 0, x0: NaN, x1: 10 },
            { side: 'above', level: 5, x0: 0, x1: 10 },
        ]
        const rows = buildRows(1, 8, blocked)
        expect(rows.above[0]!.isFree(0, 10)).toBe(true)
    })
})
