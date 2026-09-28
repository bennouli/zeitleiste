import { sampleEntry } from '@/test/entries'
import { describe, expect, it } from 'vitest'
import {
    MS_PER_DAY,
    MS_PER_YEAR,
    PRIVATE_UNDER_TESTS,
    entryAnchor,
    entryRange,
    startOf,
    todayMs,
} from '../time'

const { endOf, midOf, compareHDate } = PRIVATE_UNDER_TESTS

const TODAY = Date.UTC(2026, 8, 27)

describe('constants', () => {
    it('has day and mean Gregorian year lengths', () => {
        expect(MS_PER_DAY).toBe(86_400_000)
        expect(MS_PER_YEAR).toBe(365.2425 * 86_400_000)
    })
})

describe('startOf / endOf / midOf', () => {
    it('year precision', () => {
        expect(startOf({ year: 1917 })).toBe(Date.UTC(1917, 0, 1))
        expect(endOf({ year: 1917 })).toBe(Date.UTC(1918, 0, 1))
        expect(midOf({ year: 1917 })).toBe(
            (Date.UTC(1917, 0, 1) + Date.UTC(1918, 0, 1)) / 2
        )
    })

    it('month precision', () => {
        expect(startOf({ year: 1917, month: 11 })).toBe(Date.UTC(1917, 10, 1))
        expect(endOf({ year: 1917, month: 11 })).toBe(Date.UTC(1917, 11, 1))
        expect(midOf({ year: 1917, month: 11 })).toBe(Date.UTC(1917, 10, 16))
    })

    it('day precision', () => {
        expect(startOf({ year: 1917, month: 11, day: 7 })).toBe(
            Date.UTC(1917, 10, 7)
        )
        expect(endOf({ year: 1917, month: 11, day: 7 })).toBe(
            Date.UTC(1917, 10, 8)
        )
        expect(midOf({ year: 1917, month: 11, day: 7 })).toBe(
            Date.UTC(1917, 10, 7, 12)
        )
    })

    it('December rolls over into the next year', () => {
        expect(endOf({ year: 1991, month: 12 })).toBe(Date.UTC(1992, 0, 1))
        expect(endOf({ year: 1991, month: 12, day: 31 })).toBe(
            Date.UTC(1992, 0, 1)
        )
        expect(endOf({ year: 1991, month: 12, day: 26 })).toBe(
            Date.UTC(1991, 11, 27)
        )
    })

    it('month ends respect month lengths', () => {
        expect(endOf({ year: 1917, month: 1, day: 31 })).toBe(
            Date.UTC(1917, 1, 1)
        )
        expect(endOf({ year: 1917, month: 4, day: 30 })).toBe(
            Date.UTC(1917, 4, 1)
        )
    })

    it('handles leap days (1916 is leap, 1700 is not)', () => {
        expect(
            endOf({ year: 1916, month: 2 }) - startOf({ year: 1916, month: 2 })
        ).toBe(29 * MS_PER_DAY)
        expect(startOf({ year: 1916, month: 2, day: 29 })).toBe(
            Date.UTC(1916, 1, 29)
        )
        expect(endOf({ year: 1916, month: 2, day: 29 })).toBe(
            Date.UTC(1916, 2, 1)
        )
        expect(
            endOf({ year: 1700, month: 2 }) - startOf({ year: 1700, month: 2 })
        ).toBe(28 * MS_PER_DAY)
        expect(endOf({ year: 1700 }) - startOf({ year: 1700 })).toBe(
            365 * MS_PER_DAY
        )
        expect(endOf({ year: 2000 }) - startOf({ year: 2000 })).toBe(
            366 * MS_PER_DAY
        )
    })

    it('year 1700', () => {
        expect(startOf({ year: 1700 })).toBe(Date.UTC(1700, 0, 1))
        expect(endOf({ year: 1700 })).toBe(Date.UTC(1701, 0, 1))
    })

    it('does not map years below 100 to 1900+', () => {
        expect(new Date(startOf({ year: 50 })).getUTCFullYear()).toBe(50)
        expect(new Date(startOf({ year: 0 })).getUTCFullYear()).toBe(0)
        expect(endOf({ year: 99 })).toBe(startOf({ year: 100 }))
        expect(endOf({ year: 50, month: 12, day: 31 })).toBe(
            startOf({ year: 51 })
        )
    })
})

describe('entryAnchor / entryRange', () => {
    it('point: anchor is the midpoint of the start day', () => {
        const e = sampleEntry('oktoberrevolution')
        const a = Date.UTC(1917, 10, 7, 12)
        expect(entryAnchor(e)).toBe(a)
        expect(entryRange(e, TODAY)).toEqual([a, a])
    })

    it('point with month precision', () => {
        const e = sampleEntry('annexion-der-krim')
        expect(entryRange(e, TODAY)).toEqual([
            Date.UTC(2014, 2, 16, 12),
            Date.UTC(2014, 2, 16, 12),
        ])
    })

    it('span with day precision includes the whole end day', () => {
        const e = sampleEntry('kubakrise')
        expect(entryRange(e, TODAY)).toEqual([
            Date.UTC(1962, 9, 16),
            Date.UTC(1962, 9, 29),
        ])
        expect(entryAnchor(e)).toBe(Date.UTC(1962, 9, 16, 12))
    })

    it('span with mixed precision', () => {
        const e = sampleEntry('grosser-nordischer-krieg')
        expect(entryRange(e, TODAY)).toEqual([
            Date.UTC(1700, 0, 1),
            Date.UTC(1721, 8, 11),
        ])
    })

    it('ongoing span ends at today', () => {
        const e = sampleEntry('russischer-angriffskrieg-gegen-die-ukraine')
        expect(entryRange(e, TODAY)).toEqual([Date.UTC(2022, 1, 24), TODAY])
    })
})

describe('todayMs', () => {
    it('truncates to 00:00 UTC', () => {
        expect(todayMs(Date.UTC(2026, 8, 27, 23, 59, 59, 999))).toBe(TODAY)
        expect(todayMs(TODAY)).toBe(TODAY)
        expect(todayMs(Date.UTC(1917, 10, 7, 5))).toBe(Date.UTC(1917, 10, 7))
    })

    it('defaults to Date.now()', () => {
        const t = todayMs()
        expect(t % MS_PER_DAY).toBe(0)
        expect(Date.now() - t).toBeLessThan(MS_PER_DAY)
    })
})

describe('compareHDate', () => {
    it('orders chronologically across precisions', () => {
        expect(compareHDate({ year: 1917 }, { year: 1918 })).toBe(-1)
        expect(
            compareHDate(
                { year: 1917, month: 11, day: 7 },
                { year: 1917, month: 3 }
            )
        ).toBe(1)
        expect(
            compareHDate({ year: 1917 }, { year: 1917, month: 1, day: 1 })
        ).toBe(0)
        const sorted = [
            { year: 1918 },
            { year: 1917, month: 11 },
            { year: 1917, month: 3, day: 8 },
        ].sort(compareHDate)
        expect(sorted).toStrictEqual([
            { year: 1917, month: 3, day: 8 },
            { year: 1917, month: 11 },
            { year: 1918 },
        ])
    })
})
