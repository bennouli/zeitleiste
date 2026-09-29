import { entries } from '@/data/entries'
import { isSpan, type Entry } from '@/lib/entry'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import { describe, expect, it } from 'vitest'
import {
    isOngoing,
    laneBox,
    spanLayout,
    withFrozenLanes,
} from '../spanGeometry'

const TODAY = Date.UTC(2026, 8, 27)
const WIDTH = 1920
const spans = entries.filter(isSpan)

function linear(from: number, to: number, width = WIDTH) {
    return (t: number) => ((t - from) / (to - from)) * width
}

/** Widest zoom: 1700 to today across 1920 px. */
const wide = linear(startOf({ year: 1700 }), TODAY)

const finished: Entry = {
    id: 'vorbei',
    title: 'Vorbei',
    summary: '',
    start: { year: 1900 },
    end: { year: 1950 },
    type: 'war',
    tags: [],
}

describe('spanLayout', () => {
    it('lays out every span in the sample data and ignores points', () => {
        const bars = spanLayout(entries, wide, TODAY)
        expect([...bars.keys()].sort()).toEqual(spans.map((e) => e.id).sort())
    })

    it('stretches the Cuban Missile Crisis to the 2 px minimum at the widest zoom', () => {
        const bar = spanLayout(spans, wide, TODAY).get('kubakrise')!
        expect(bar.x1 - bar.x0).toBe(2)
        expect(bar.extended).toBe(true)
    })

    it('ends an ongoing span at today', () => {
        const zoomedIn = linear(startOf({ year: 1990 }), TODAY)
        const bar = spanLayout(spans, zoomedIn, TODAY).get(
            'russischer-angriffskrieg-gegen-die-ukraine'
        )!
        expect(bar.x1).toBeCloseTo(zoomedIn(TODAY), 6)
    })

    it('skips spans at non-finite positions', () => {
        const nowhere = () => NaN
        const unplaceable = [finished]
        expect(spanLayout(unplaceable, nowhere, TODAY).size).toBe(0)
    })
})

describe('withFrozenLanes', () => {
    function barIn(id: string, lane: number): SpanBar {
        return {
            id,
            x0: 0,
            x1: 100,
            trueX0: 0,
            trueX1: 100,
            extended: false,
            lane,
        }
    }

    it('moves bars to their frozen lanes', () => {
        const liveBars = new Map([
            ['a', barIn('a', 0)],
            ['b', barIn('b', 1)],
        ])
        const lanes = new Map([
            ['a', 2],
            ['b', 0],
        ])
        const frozen = withFrozenLanes(liveBars, lanes)
        expect(frozen.get('a')!.lane).toBe(2)
        expect(frozen.get('b')!.lane).toBe(0)
    })

    it('keeps the live lane of a bar without a frozen one', () => {
        const liveBars = new Map([['a', barIn('a', 1)]])
        const lanes = new Map([['b', 0]])
        expect(withFrozenLanes(liveBars, lanes).get('a')!.lane).toBe(1)
    })

    it('leaves the live bars untouched', () => {
        const liveBar = barIn('a', 0)
        const liveBars = new Map([['a', liveBar]])
        const lanes = new Map([['a', 3]])
        withFrozenLanes(liveBars, lanes)
        expect(liveBars.get('a')).toBe(liveBar)
        expect(liveBar.lane).toBe(0)
    })
})

describe('isOngoing', () => {
    const endingOn = (end: Entry['end']): Entry => ({ ...finished, end })

    it.each([
        ['ongoing', 'ongoing' as const, true],
        ['ending today', { year: 2026, month: 9, day: 27 }, true],
        ['ending this month', { year: 2026, month: 9 }, true],
        ['ending this year', { year: 2026 }, true],
        ['ended yesterday', { year: 2026, month: 9, day: 26 }, false],
        ['ended last month', { year: 2026, month: 8 }, false],
        ['ended last year', { year: 2025 }, false],
    ])('%s: %s', (_, end, expected) => {
        const span = endingOn(end)
        expect(isOngoing(span, TODAY)).toBe(expected)
    })
})

describe('laneBox', () => {
    it('centres lane 0 (9 px) on the 1 px axis line', () => {
        expect(laneBox(0)).toEqual({ top: -4, height: 9 })
    })

    it('hangs lane n ≥ 1 (6 px) at 7 px + (n − 1) · 8 px below the axis line', () => {
        expect([1, 2, 3].map(laneBox)).toEqual([
            { top: 7, height: 6 },
            { top: 15, height: 6 },
            { top: 23, height: 6 },
        ])
    })

    it('keeps neighbouring lanes apart', () => {
        const lanes = [0, 1, 2, 3].map(laneBox)
        const gaps = lanes
            .slice(1)
            .map((box, i) => box.top - (lanes[i]!.top + lanes[i]!.height))
        expect(Math.min(...gaps)).toBeGreaterThan(0)
    })
})
