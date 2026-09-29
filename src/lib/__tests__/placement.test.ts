import { compareIds } from '@/lib/order'
import { describe, expect, it } from 'vitest'
import {
    PRIVATE_UNDER_TESTS,
    placeItems,
    type BlockedInterval,
    type PlaceableItem,
    type Placement,
    type PlacementOptions,
    type Side,
    type SideStrategy,
    type Slot,
    type SlotRequest,
} from '../placement'

const {
    usedLevels,
    candidateSlots,
    alternateSides,
    preferredSideFirst,
    buildRows,
} = PRIVATE_UNDER_TESTS

function item(id: string, x0: number, x1: number, order = 0): PlaceableItem {
    return { id, x0, x1, order }
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
        return item(`e${i}`, x0, x0 + 80 + Math.round(r() * 120), x0)
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

function chronological(items: readonly PlaceableItem[]): PlaceableItem[] {
    return [...items].sort(
        (a, b) => a.order - b.order || compareIds(a.id, b.id)
    )
}

function rowsFrom(firstSide: Side, maxLevels: number): Slot[] {
    const otherSide: Side = firstSide === 'above' ? 'below' : 'above'
    const levels = Array.from({ length: maxLevels }, (_, level) => level)
    return [
        ...levels.map((level) => ({ side: firstSide, level })),
        ...levels.map((level) => ({ side: otherSide, level })),
    ]
}

/**
 * Naive O(n²) oracle, walking the items in chronological order: each keeps its previous slot if
 * that row is free, otherwise it takes the first free row on its previous side, then the other
 * side; an item without a previous slot starts on the side opposite the last placed item.
 */
function checkOracle(
    items: readonly PlaceableItem[],
    p: Placement,
    gap = 8,
    maxLevels = 2,
    previous: ReadonlyMap<string, Slot> | null = null
) {
    const placed: { item: PlaceableItem; slot: Slot }[] = []
    for (const it of chronological(items)) {
        const free = (s: Slot) =>
            s.level < maxLevels &&
            !placed.some(
                (q) => sameRow(q.slot, s) && conflicts(q.item, it, gap)
            )
        const prev = previous?.get(it.id)
        const lastSide = placed.at(-1)?.slot.side
        const firstSide: Side =
            prev?.side ?? (lastSide === 'above' ? 'below' : 'above')
        const expected =
            prev && free(prev)
                ? prev
                : rowsFrom(firstSide, maxLevels).find(free)
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

/** One row per side, the row below fully taken: a second item can only share the row above. */
const BELOW_TAKEN: PlacementOptions = {
    maxLevels: 1,
    blocked: [{ side: 'below', level: 0, x0: -1000, x1: 1000 }],
}

describe('placeItems', () => {
    it('puts two overlapping cards one above and one below', () => {
        const items = [item('a', 0, 100, 0), item('b', 50, 150, 1)]
        const p = placeItems(items, null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 0 })
        expect(p.overflow).toEqual([])
    })

    it('places the first item above and offers each next one the opposite side first', () => {
        const items = [
            item('c', 400, 500, 2),
            item('a', 0, 100, 0),
            item('b', 200, 300, 1),
        ]
        const p = placeItems(items, null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'above', level: 0 })
        expect(usedLevels(p)).toEqual({ above: 1, below: 1 })
    })

    it('takes the next row on the offered side before crossing over', () => {
        const belowNearTaken: BlockedInterval[] = [
            { side: 'below', level: 0, x0: 0, x1: 200 },
        ]
        const options: PlacementOptions = { blocked: belowNearTaken }
        const items = [item('a', 300, 400, 0), item('b', 0, 100, 1)]
        const p = placeItems(items, null, options)
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 1 })
    })

    it('falls back to the other side, nearest row first, when the offered side is full', () => {
        const belowTaken: BlockedInterval[] = [
            { side: 'below', level: 0, x0: 0, x1: 300 },
            { side: 'below', level: 1, x0: 0, x1: 300 },
        ]
        const items = [
            item('a', 500, 600, 0),
            item('b', 0, 100, 1),
            item('c', 200, 300, 2),
        ]
        const options: PlacementOptions = { blocked: belowTaken }
        const p = placeItems(items, null, options)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'above', level: 0 })
    })

    it('counts items placed elsewhere in the alternation at their chronological position', () => {
        const aboveBefore: PlacementOptions = {
            placedElsewhere: [{ order: 1, side: 'above' }],
        }
        const aboveAfter: PlacementOptions = {
            placedElsewhere: [{ order: 9, side: 'above' }],
        }
        const belowBetween: PlacementOptions = {
            placedElsewhere: [{ order: 1, side: 'below' }],
        }
        const lone = [item('a', 0, 100, 5)]
        const pair = [item('a', 0, 100, 0), item('b', 200, 300, 2)]
        const afterAbove = placeItems(lone, null, aboveBefore)
        const beforeAbove = placeItems(lone, null, aboveAfter)
        const aroundBelow = placeItems(pair, null, belowBetween)
        expect(afterAbove.slots.get('a')?.side).toBe('below')
        expect(beforeAbove.slots.get('a')?.side).toBe('above')
        expect(aroundBelow.slots.get('a')?.side).toBe('above')
        expect(aroundBelow.slots.get('b')?.side).toBe('above')
    })

    it('puts an item on its preferred side against the alternation, crossing over only when that side is full', () => {
        const preferAbove: PlaceableItem[] = [
            { ...item('a', 0, 100, 0), preferredSide: 'above' },
            { ...item('b', 200, 300, 1), preferredSide: 'above' },
            { ...item('c', 250, 350, 2), preferredSide: 'above' },
        ]
        const oneRow: PlacementOptions = { maxLevels: 1 }
        const p = placeItems(preferAbove, null, oneRow)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'below', level: 0 })
    })

    it('takes candidate order from the side strategy and keeps hysteresis ahead of it', () => {
        const requests: SlotRequest[] = []
        const alwaysBelow: SideStrategy = (request) => {
            requests.push(request)
            return candidateSlots(request.maxLevels, 'below')
        }
        const options: PlacementOptions = { sideStrategy: alwaysBelow }
        const kept = new Map<string, Slot>([['b', { side: 'above', level: 0 }]])
        const items = [
            item('a', 0, 100, 0),
            item('b', 200, 300, 1),
            item('c', 400, 500, 2),
        ]
        const p = placeItems(items, kept, options)
        expect(p.slots.get('a')).toEqual({ side: 'below', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'below', level: 0 })
        expect(requests).toEqual([
            { item: items[0], precedingSide: undefined, maxLevels: 2 },
            { item: items[2], precedingSide: 'above', maxLevels: 2 },
        ])
    })

    it('matches the oracle on random sets', () => {
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
        const items = [
            item('a', 100, 0, 0),
            item('b', 50, 50, 1),
            item('c', 108, 108, 2),
        ]
        const p = placeItems(items, null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.slots.get('b')).toEqual({ side: 'below', level: 0 })
        expect(p.slots.get('c')).toEqual({ side: 'above', level: 0 })
    })

    it('sends duplicate ids and non-finite extents to overflow', () => {
        const items = [
            item('a', 0, 100, 0),
            item('a', 500, 600, 1),
            item('n', NaN, 100, 2),
            item('m', 0, Infinity, 3),
        ]
        const p = placeItems(items, null)
        expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
        expect(p.overflow).toEqual(['a', 'n', 'm'])
        expect(p.slots.size + p.overflow.length).toBe(4)
    })

    it('returns independent slot objects', () => {
        const p = placeItems([item('a', 0, 100), item('b', 200, 300)], null)
        expect(p.slots.get('a')).not.toBe(p.slots.get('b'))
    })

    it('breaks order ties by id', () => {
        const tied = [item('y', 0, 100), item('x', 0, 100)]
        const p = placeItems(tied, null)
        expect(p.slots.get('x')?.side).toBe('above')
        expect(p.slots.get('y')?.side).toBe('below')
    })

    it('overflows when all four rows are full at one x', () => {
        const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) =>
            item(id, i, 100 + i, i)
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
            item('a', 0, 100, 0),
            item('b', 0, 100, 1),
            item('c', 0, 100, 2),
        ]
        const oneRow: PlacementOptions = { maxLevels: 1 }
        const noRows: PlacementOptions = { maxLevels: 0 }
        const p = placeItems(items, null, oneRow)
        expect(p.overflow).toEqual(['c'])
        expect(placeItems(items, null, noRows).overflow).toEqual([
            'a',
            'b',
            'c',
        ])
    })

    it('respects the gap; touching cards (x1 + gap == x0) fit in one row', () => {
        const sharesRow = (
            first: PlaceableItem,
            second: PlaceableItem,
            options: PlacementOptions
        ) => placeItems([first, second], null, options).slots.has(second.id)
        const gap8: PlacementOptions = { ...BELOW_TAKEN, gapPx: 8 }
        const gap0: PlacementOptions = { ...BELOW_TAKEN, gapPx: 0 }
        const gap20: PlacementOptions = { ...BELOW_TAKEN, gapPx: 20 }
        const left = item('a', 0, 100, 0)
        const right = item('a', 108, 200, 0)
        const touchingRight = item('b', 108, 200, 1)
        const tooCloseRight = item('b', 107, 200, 1)
        const tooCloseLeft = item('b', 0, 101, 1)
        const touchingLeft = item('b', 0, 100, 1)
        const adjoining = item('b', 100, 200, 1)
        const touchingAt20 = item('b', 120, 200, 1)
        const tooCloseAt20 = item('b', 119, 200, 1)
        expect(sharesRow(left, touchingRight, gap8)).toBe(true)
        expect(sharesRow(left, tooCloseRight, gap8)).toBe(false)
        expect(sharesRow(right, tooCloseLeft, gap8)).toBe(false)
        expect(sharesRow(right, touchingLeft, gap8)).toBe(true)
        expect(sharesRow(left, adjoining, gap0)).toBe(true)
        expect(sharesRow(left, touchingAt20, gap20)).toBe(true)
        expect(sharesRow(left, tooCloseAt20, gap20)).toBe(false)
    })

    it('checks neighbours on both sides when inserting between cards', () => {
        const items = [
            item('l', 0, 100, 0),
            item('r', 300, 400, 1),
            item('mid', 108, 292, 2),
            item('wide', 90, 310, 3),
        ]
        const p = placeItems(items, null, BELOW_TAKEN)
        expect(p.slots.get('mid')).toEqual({ side: 'above', level: 0 })
        expect(p.overflow).toEqual(['wide'])
    })

    describe('hysteresis', () => {
        it('keeps a card below when both sides are free', () => {
            const prev = new Map<string, Slot>([
                ['a', { side: 'below', level: 0 }],
            ])
            const p = placeItems([item('a', 0, 100)], prev)
            expect(p.slots.get('a')).toEqual({ side: 'below', level: 0 })
        })

        it('keeps a still-fitting slot against the alternation, which then continues from it', () => {
            const prev = new Map<string, Slot>([
                ['b', { side: 'above', level: 0 }],
            ])
            const items = [
                item('a', 0, 100, 0),
                item('b', 200, 300, 1),
                item('c', 400, 500, 2),
            ]
            const p = placeItems(items, prev)
            expect(p.slots.get('a')).toEqual({ side: 'above', level: 0 })
            expect(p.slots.get('b')).toEqual({ side: 'above', level: 0 })
            expect(p.slots.get('c')).toEqual({ side: 'below', level: 0 })
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

        it('stays on its previous side when its previous slot is taken', () => {
            const items = [item('first', 0, 100, 0), item('second', 50, 150, 1)]
            const prevBelow = new Map<string, Slot>([
                ['first', { side: 'below', level: 0 }],
                ['second', { side: 'below', level: 0 }],
            ])
            const p = placeItems(items, prevBelow)
            expect(p.slots.get('first')).toEqual({ side: 'below', level: 0 })
            expect(p.slots.get('second')).toEqual({ side: 'below', level: 1 })
            const prevAbove = new Map<string, Slot>([
                ['second', { side: 'above', level: 0 }],
            ])
            const q = placeItems(items, prevAbove)
            expect(q.slots.get('first')).toEqual({ side: 'above', level: 0 })
            expect(q.slots.get('second')).toEqual({ side: 'above', level: 1 })
            const oneRowOptions: PlacementOptions = { maxLevels: 1 }
            const oneRow = placeItems(items, prevAbove, oneRowOptions)
            expect(oneRow.slots.get('second')).toEqual({
                side: 'below',
                level: 0,
            })
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
            const item = { id: 'a', x0: 0, x1: 100, order: 0 }
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
                [{ id: 'a', x0: 104, x1: 200, order: 0 }],
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
                [{ id: 'a', x0: 108, x1: 200, order: 0 }],
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
                [{ id: 'a', x0: 0, x1: 100, order: 0 }],
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
            const blocker = { id: 'b', x0: 0, x1: 100, order: 0 }
            const item = { id: 'a', x0: 10, x1: 110, order: 1 }
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
    it('lists every row on the given side, nearest first, before the other side', () => {
        expect(candidateSlots(2, 'below')).toEqual([
            { side: 'below', level: 0 },
            { side: 'below', level: 1 },
            { side: 'above', level: 0 },
            { side: 'above', level: 1 },
        ])
    })

    it('is empty for zero levels', () => {
        expect(candidateSlots(0, 'above')).toEqual([])
    })
})

describe('alternateSides', () => {
    it('offers the side opposite the preceding item first, above for the first item', () => {
        const lone = item('a', 0, 100)
        const first: SlotRequest = {
            item: lone,
            precedingSide: undefined,
            maxLevels: 2,
        }
        const afterAbove: SlotRequest = { ...first, precedingSide: 'above' }
        const afterBelow: SlotRequest = { ...first, precedingSide: 'below' }
        expect(alternateSides(first)).toEqual(candidateSlots(2, 'above'))
        expect(alternateSides(afterAbove)).toEqual(candidateSlots(2, 'below'))
        expect(alternateSides(afterBelow)).toEqual(candidateSlots(2, 'above'))
    })
})

describe('preferredSideFirst', () => {
    it("offers the item's preferred side first, whatever the preceding side", () => {
        const preferBelow: PlaceableItem = {
            ...item('a', 0, 100),
            preferredSide: 'below',
        }
        const afterAbove: SlotRequest = {
            item: preferBelow,
            precedingSide: 'above',
            maxLevels: 2,
        }
        const afterBelow: SlotRequest = {
            ...afterAbove,
            precedingSide: 'below',
        }
        expect(preferredSideFirst(afterAbove)).toEqual(
            candidateSlots(2, 'below')
        )
        expect(preferredSideFirst(afterBelow)).toEqual(
            candidateSlots(2, 'below')
        )
    })

    it('alternates for an item without a preferred side', () => {
        const noPreference: SlotRequest = {
            item: item('a', 0, 100),
            precedingSide: 'above',
            maxLevels: 2,
        }
        expect(preferredSideFirst(noPreference)).toEqual(
            alternateSides(noPreference)
        )
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
