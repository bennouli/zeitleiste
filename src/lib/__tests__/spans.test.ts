import { entries } from '@/data/entries'
import { describe, expect, it } from 'vitest'
import { isSpan, type HDate } from '../entry'
import {
    layoutSpans,
    PRIVATE_UNDER_TESTS,
    type SpanBar,
    type SpanInput,
} from '../spans'

const { drawnExtent, firstFreeLane } = PRIVATE_UNDER_TESTS

function span(id: string, x0: number, x1: number): SpanInput {
    return { id, x0, x1 }
}

function byId(bars: SpanBar[], id: string): SpanBar {
    const bar = bars.find((b) => b.id === id)
    if (!bar) throw new Error(`missing bar ${id}`)
    return bar
}

function only(bars: SpanBar[]): SpanBar {
    expect(bars).toHaveLength(1)
    return bars[0] as SpanBar
}

function assertNoOverlapInLanes(bars: SpanBar[], gap: number) {
    for (const a of bars) {
        for (const b of bars) {
            if (a === b || a.lane !== b.lane) continue
            expect(
                a.x1 + gap <= b.x0 || b.x1 + gap <= a.x0,
                `${a.id} overlaps ${b.id}`
            ).toBe(true)
        }
    }
}

describe('layoutSpans: extent and minimum width', () => {
    it('keeps the true start and end of every bar', () => {
        const input = [span('a', 0, 10), span('b', 100, 400), span('c', 50, 50)]
        const { bars } = layoutSpans(input)
        for (const s of input) {
            const bar = byId(bars, s.id)
            expect(bar.x0).toBe(s.x0)
            expect(bar.trueX0).toBe(s.x0)
            expect(bar.trueX1).toBe(s.x1)
            expect(bar.x1).toBeGreaterThanOrEqual(bar.trueX1)
        }
    })

    it('extends a span narrower than the minimum width to the right', () => {
        // A 12-day span such as the Cuban Missile Crisis at the widest zoom.
        const bar = only(layoutSpans([span('kubakrise', 500, 502)]).bars)
        expect(bar.x1 - bar.x0).toBe(64)
        expect(bar.x0).toBe(500)
        expect(bar.extended).toBe(true)
    })

    it('leaves spans at or above the minimum width unchanged', () => {
        const { bars } = layoutSpans([
            span('exact', 0, 64),
            span('wide', 100, 300),
        ])
        expect(byId(bars, 'exact')).toMatchObject({ x1: 64, extended: false })
        expect(byId(bars, 'wide')).toMatchObject({ x1: 300, extended: false })
    })

    it('honours a custom minimum width', () => {
        const { bars } = layoutSpans([span('a', 0, 10)], { minWidthPx: 32 })
        expect(only(bars)).toMatchObject({ x1: 32, extended: true })
    })

    it('treats x1 < x0 as a zero-length span', () => {
        const { bars } = layoutSpans([span('a', 10, 5)])
        expect(only(bars)).toMatchObject({
            x0: 10,
            trueX1: 10,
            x1: 74,
            extended: true,
        })
    })
})

describe('layoutSpans: maxX', () => {
    it('extends a short span ending at maxX to the left', () => {
        // An ongoing span ending at today, shorter than the minimum width.
        const bar = only(
            layoutSpans([span('ongoing', 973, 1000)], { maxX: 1000 }).bars
        )
        expect(bar).toMatchObject({
            x0: 1000 - 64,
            x1: 1000,
            trueX0: 973,
            trueX1: 1000,
            extended: true,
        })
    })

    it('still extends a short span far from maxX to the right', () => {
        const bar = only(
            layoutSpans([span('a', 500, 502)], { maxX: 1000 }).bars
        )
        expect(bar).toMatchObject({
            x0: 500,
            x1: 564,
            trueX0: 500,
            trueX1: 502,
            extended: true,
        })
    })

    it('extends to both sides when there is not enough room on the right', () => {
        const bar = only(
            layoutSpans([span('a', 960, 970)], { maxX: 1000 }).bars
        )
        expect(bar).toMatchObject({
            x0: 936,
            x1: 1000,
            trueX0: 960,
            trueX1: 970,
        })
        expect(bar.x0).toBeLessThan(bar.trueX0)
        expect(bar.x1).toBeGreaterThan(bar.trueX1)
    })

    it('extends exactly up to maxX without moving x0', () => {
        const bar = only(
            layoutSpans([span('a', 936, 940)], { maxX: 1000 }).bars
        )
        expect(bar).toMatchObject({ x0: 936, x1: 1000, trueX0: 936 })
    })

    it('never clips the true extent of a span crossing maxX', () => {
        const { bars } = layoutSpans(
            [span('short', 990, 1010), span('long', 0, 1100)],
            { maxX: 1000 }
        )
        expect(byId(bars, 'short')).toMatchObject({
            x0: 1010 - 64,
            x1: 1010,
            trueX0: 990,
            trueX1: 1010,
        })
        expect(byId(bars, 'long')).toMatchObject({
            x0: 0,
            x1: 1100,
            extended: false,
        })
    })

    it('does not change long spans and ignores a non-finite maxX', () => {
        const input = [span('a', 900, 1000), span('b', 990, 995)]
        expect(
            only(layoutSpans([input[0]!], { maxX: 1000 }).bars)
        ).toMatchObject({ x0: 900, x1: 1000, extended: false })
        expect(layoutSpans(input, { maxX: NaN })).toEqual(layoutSpans(input))
        expect(layoutSpans(input, { maxX: Infinity })).toEqual(
            layoutSpans(input)
        )
    })

    it('uses the left-extended extent for overlap and sorts by drawn x0', () => {
        // 'end' is drawn over [936, 1000] and collides with 'mid' at [900, 940].
        const { bars } = layoutSpans(
            [span('mid', 900, 940), span('end', 990, 1000)],
            { maxX: 1000 }
        )
        expect(byId(bars, 'mid').lane).not.toBe(byId(bars, 'end').lane)
        assertNoOverlapInLanes(bars, 4)
        const { bars: shared } = layoutSpans(
            [span('left', 0, 930), span('end', 990, 1000)],
            { maxX: 1000 }
        )
        expect(shared.map((b) => b.id)).toEqual(['left', 'end'])
        expect(byId(shared, 'end').lane).toBe(0)
    })

    it('handles spans at and entirely past maxX', () => {
        expect(
            only(layoutSpans([span('a', 1000, 1000)], { maxX: 1000 }).bars)
        ).toMatchObject({ x0: 936, x1: 1000 })
        expect(
            only(layoutSpans([span('a', 1020, 1030)], { maxX: 1000 }).bars)
        ).toMatchObject({
            x0: 1030 - 64,
            x1: 1030,
            trueX0: 1020,
        })
    })

    it('ignores float noise at the boundary', () => {
        const bar = only(
            layoutSpans([span('a', 1000 - 64 + 1e-12, 940)], { maxX: 1000 })
                .bars
        )
        expect(bar.x0).toBe(bar.trueX0)
    })

    it('does not depend on the input order with maxX', () => {
        const input = [
            span('a', 900, 940),
            span('b', 990, 1000),
            span('c', 950, 960),
            span('d', 0, 1000),
        ]
        expect(layoutSpans([...input].reverse(), { maxX: 1000 })).toEqual(
            layoutSpans(input, { maxX: 1000 })
        )
    })
})

describe('layoutSpans: lanes', () => {
    it('returns no bars and zero lanes for empty input', () => {
        expect(layoutSpans([])).toEqual({ bars: [], laneCount: 0 })
    })

    it('puts overlapping spans in different lanes', () => {
        const { bars, laneCount } = layoutSpans([
            span('a', 0, 100),
            span('b', 50, 150),
        ])
        expect(byId(bars, 'a').lane).not.toBe(byId(bars, 'b').lane)
        expect(laneCount).toBe(2)
    })

    it('lets non-overlapping spans share a lane', () => {
        const { bars, laneCount } = layoutSpans([
            span('a', 0, 100),
            span('b', 200, 300),
        ])
        expect(bars.map((b) => b.lane)).toEqual([0, 0])
        expect(laneCount).toBe(1)
    })

    it('respects the gap between bars in one lane', () => {
        // Exactly the gap apart: fits. One px less: needs a new lane.
        expect(
            layoutSpans([span('a', 0, 100), span('b', 104, 200)]).laneCount
        ).toBe(1)
        expect(
            layoutSpans([span('a', 0, 100), span('b', 103, 200)]).laneCount
        ).toBe(2)
        expect(
            layoutSpans([span('a', 0, 100), span('b', 103, 200)], { gapPx: 0 })
                .laneCount
        ).toBe(1)
    })

    it('processes spans by x0 before id', () => {
        const { bars } = layoutSpans([
            span('a', 50, 150),
            span('b', 120, 200),
            span('z', 0, 100),
        ])
        expect(byId(bars, 'z').lane).toBe(0)
        expect(byId(bars, 'a').lane).toBe(1)
        expect(byId(bars, 'b').lane).toBe(0)
    })

    it('uses the extended extent for overlap', () => {
        // a is 10 px wide but drawn 64 px wide, so b at 40 collides with it.
        const { bars } = layoutSpans([span('a', 0, 10), span('b', 40, 200)])
        expect(byId(bars, 'a').lane).not.toBe(byId(bars, 'b').lane)
        assertNoOverlapInLanes(bars, 4)
    })

    it('gives the earlier of two overlapping spans lane 0', () => {
        const { bars } = layoutSpans([
            span('later', 100, 200),
            span('earlier', 0, 300),
        ])
        expect(byId(bars, 'earlier').lane).toBe(0)
        expect(byId(bars, 'later').lane).toBe(1)
    })

    it('reuses a lower lane when a later span fits there', () => {
        const { bars, laneCount } = layoutSpans([
            span('a', 0, 100),
            span('b', 50, 150),
            span('c', 200, 300),
        ])
        expect(byId(bars, 'c').lane).toBe(0)
        expect(laneCount).toBe(2)
    })

    it('reports laneCount as the highest lane plus one', () => {
        const { bars, laneCount } = layoutSpans([
            span('a', 0, 100),
            span('b', 10, 110),
            span('c', 20, 120),
            span('d', 500, 600),
        ])
        expect(laneCount).toBe(Math.max(...bars.map((b) => b.lane)) + 1)
        expect(laneCount).toBe(3)
    })

    it('returns bars sorted by lane, then x0', () => {
        const { bars } = layoutSpans([
            span('a', 200, 300),
            span('m', 50, 150),
            span('z', 0, 100),
        ])
        expect(bars.map((b) => [b.lane, b.id])).toEqual([
            [0, 'z'],
            [0, 'a'],
            [1, 'm'],
        ])
    })
})

describe('layoutSpans: determinism', () => {
    const input: [
        SpanInput,
        SpanInput,
        SpanInput,
        SpanInput,
        SpanInput,
        SpanInput,
    ] = [
        span('a', 0, 100),
        span('b', 50, 150),
        span('c', 50, 150),
        span('d', 120, 125),
        span('e', 300, 310),
        span('f', 0, 400),
    ]

    it('does not depend on the input order', () => {
        const expected = layoutSpans(input)
        const reversed = layoutSpans([...input].reverse())
        const shuffled = layoutSpans([
            input[3],
            input[0],
            input[5],
            input[2],
            input[4],
            input[1],
        ])
        expect(reversed).toEqual(expected)
        expect(shuffled).toEqual(expected)
    })

    it('breaks ties between equal spans by id', () => {
        const { bars } = layoutSpans([input[2], input[1]])
        expect(byId(bars, 'b').lane).toBe(0)
        expect(byId(bars, 'c').lane).toBe(1)
    })

    it('does not mutate its input', () => {
        const copy = structuredClone(input)
        layoutSpans(input)
        expect(input).toEqual(copy)
    })
})

describe('layoutSpans: sample data', () => {
    // 300 years across 1920 px, by year fraction; 'ongoing' ends at the start of 2027.
    const startYear = 1700
    const pxPerYear = 1920 / 300
    const yearOf = (d: HDate) =>
        d.year + ((d.month ?? 1) - 1) / 12 + ((d.day ?? 1) - 1) / 365
    const toPx = (d: HDate) => (yearOf(d) - startYear) * pxPerYear

    const input: SpanInput[] = entries.filter(isSpan).map((e) => ({
        id: e.id,
        x0: toPx(e.start),
        x1: e.end === 'ongoing' ? (2027 - startYear) * pxPerYear : toPx(e.end!),
    }))
    const maxX = (2027 - startYear) * pxPerYear
    const { bars, laneCount } = layoutSpans(input, { maxX })

    it('lays out every span', () => {
        expect(bars).toHaveLength(input.length)
        expect(input.length).toBeGreaterThan(5)
    })

    it('never overlaps two bars in one lane', () => {
        assertNoOverlapInLanes(bars, 4)
    })

    it('keeps WWI, WWII, Cold War and Soviet Union in few lanes', () => {
        const ids = [
            'erster-weltkrieg',
            'zweiter-weltkrieg',
            'kalter-krieg',
            'sowjetunion',
        ]
        const lanes = ids.map((id) => byId(bars, id).lane)
        for (const lane of lanes) expect(lane).toBeLessThan(4)
        expect(laneCount).toBe(Math.max(...bars.map((b) => b.lane)) + 1)
    })

    it('stretches the Cuban Missile Crisis to the minimum width', () => {
        const bar = byId(bars, 'kubakrise')
        expect(bar.extended).toBe(true)
        expect(bar.x1 - bar.x0).toBeCloseTo(64, 9)
    })

    it('ends the stretched ongoing war at maxX', () => {
        const bar = byId(bars, 'russischer-angriffskrieg-gegen-die-ukraine')
        expect(bar.extended).toBe(true)
        expect(bar.x1).toBe(maxX)
        expect(bar.x1 - bar.x0).toBeCloseTo(64, 9)
        for (const b of bars) expect(b.x1).toBeLessThanOrEqual(maxX)
    })
})

describe('drawnExtent', () => {
    it('keeps an extent at or above the minimum width', () => {
        expect(drawnExtent(0, 64, 64, Infinity)).toEqual({
            x0: 0,
            x1: 64,
            extended: false,
        })
        expect(drawnExtent(900, 1100, 64, 1000)).toEqual({
            x0: 900,
            x1: 1100,
            extended: false,
        })
    })

    it('extends a short extent to the right', () => {
        expect(drawnExtent(500, 502, 64, 1000)).toEqual({
            x0: 500,
            x1: 564,
            extended: true,
        })
    })

    it('extends exactly up to maxX without moving x0', () => {
        expect(drawnExtent(936, 940, 64, 1000)).toEqual({
            x0: 936,
            x1: 1000,
            extended: true,
        })
    })

    it('ends at maxX and extends to the left when the right would cross it', () => {
        expect(drawnExtent(973, 1000, 64, 1000)).toEqual({
            x0: 936,
            x1: 1000,
            extended: true,
        })
        expect(drawnExtent(960, 970, 64, 1000)).toEqual({
            x0: 936,
            x1: 1000,
            extended: true,
        })
    })

    it('ends at the true end when it lies past maxX', () => {
        expect(drawnExtent(990, 1010, 64, 1000)).toEqual({
            x0: 946,
            x1: 1010,
            extended: true,
        })
        expect(drawnExtent(1020, 1030, 64, 1000)).toEqual({
            x0: 966,
            x1: 1030,
            extended: true,
        })
    })

    it('ignores float noise at the maxX boundary', () => {
        const trueX0 = 1000 - 64 + 1e-12
        expect(drawnExtent(trueX0, 940, 64, 1000).x0).toBe(trueX0)
    })

    it('leaves the extent unchanged for a NaN minimum width', () => {
        expect(drawnExtent(0, 10, NaN, Infinity)).toEqual({
            x0: 0,
            x1: 10,
            extended: false,
        })
    })

    it('stretches a zero-length extent', () => {
        expect(drawnExtent(10, 10, 64, Infinity)).toEqual({
            x0: 10,
            x1: 74,
            extended: true,
        })
    })
})

describe('firstFreeLane', () => {
    const bar = (x0: number, x1: number): SpanBar => ({
        id: `${x0}-${x1}`,
        x0,
        x1,
        trueX0: x0,
        trueX1: x1,
        extended: false,
        lane: 0,
    })

    it('opens lane 0 when there are no lanes', () => {
        expect(firstFreeLane([], 0, 10, 4)).toBe(0)
    })

    it('allows a bar exactly `gap` away on either side', () => {
        const lanes = [[bar(0, 10), bar(30, 40)]]
        expect(firstFreeLane(lanes, 14, 26, 4)).toBe(0)
    })

    it('takes the lowest lane with room', () => {
        const lanes = [[bar(0, 10)], [bar(100, 110)], [bar(0, 10)]]
        expect(firstFreeLane(lanes, 5, 20, 4)).toBe(1)
    })

    it('opens a new lane when every lane is taken', () => {
        const lanes = [[bar(0, 10)], [bar(5, 15)]]
        expect(firstFreeLane(lanes, 12, 20, 4)).toBe(2)
    })
})
