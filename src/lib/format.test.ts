import { entries } from '@/data/entries'
import { sampleEntry } from '@/test/entries'
import { describe, expect, it } from 'vitest'
import type { Entry, HDate } from './entry'
import {
    formatDay,
    formatEntryDate,
    formatHDate,
    formatMonth,
    formatYear,
} from './format'

const DASH = '–'

function span(start: HDate, end?: HDate | 'ongoing'): Entry {
    return {
        id: 't',
        title: 'T',
        summary: 'T',
        start,
        end,
        region: 'both',
        category: 'event',
        importance: 2,
    }
}

describe('formatHDate (de)', () => {
    it('year precision', () => {
        expect(formatHDate({ year: 1700 })).toBe('1700')
        expect(formatHDate({ year: 1700 }, 'long')).toBe('1700')
    })

    it('month precision', () => {
        expect(formatHDate({ year: 1917, month: 11 })).toBe('Nov. 1917')
        expect(formatHDate({ year: 1917, month: 11 }, 'long')).toBe(
            'November 1917'
        )
        expect(formatHDate({ year: 2014, month: 3 })).toBe('März 2014')
        expect(formatHDate({ year: 1907, month: 6 })).toBe('Juni 1907')
    })

    it('day precision', () => {
        expect(formatHDate({ year: 1917, month: 11, day: 7 })).toBe(
            '7. Nov. 1917'
        )
        expect(formatHDate({ year: 1917, month: 11, day: 7 }, 'long')).toBe(
            '7. November 1917'
        )
        expect(formatHDate({ year: 1918, month: 7, day: 28 })).toBe(
            '28. Juli 1918'
        )
        expect(formatHDate({ year: 1721, month: 9, day: 10 })).toBe(
            '10. Sept. 1721'
        )
        expect(formatHDate({ year: 1916, month: 2, day: 29 })).toBe(
            '29. Feb. 1916'
        )
    })

    it('defaults to short style and German', () => {
        expect(formatHDate({ year: 1962, month: 10, day: 16 })).toBe(
            formatHDate({ year: 1962, month: 10, day: 16 }, 'short', 'de')
        )
    })
})

describe('formatEntryDate (de)', () => {
    it('point', () => {
        expect(formatEntryDate(sampleEntry('oktoberrevolution'))).toBe(
            '7. Nov. 1917'
        )
        expect(formatEntryDate(sampleEntry('oktoberrevolution'), 'long')).toBe(
            '7. November 1917'
        )
        expect(formatEntryDate(sampleEntry('annexion-der-krim'))).toBe(
            'März 2014'
        )
    })

    it('year–year span: unspaced en dash', () => {
        expect(formatEntryDate(span({ year: 1700 }, { year: 1721 }))).toBe(
            `1700${DASH}1721`
        )
        expect(
            formatEntryDate(span({ year: 1700 }, { year: 1721 }), 'long')
        ).toBe(`1700${DASH}1721`)
    })

    it('same year and month, day precision', () => {
        expect(formatEntryDate(sampleEntry('kubakrise'))).toBe(
            `16.${DASH}28. Okt. 1962`
        )
        expect(formatEntryDate(sampleEntry('kubakrise'), 'long')).toBe(
            `16.${DASH}28. Oktober 1962`
        )
    })

    it('same year different months, day precision: spaced en dash', () => {
        const e = span(
            { year: 1918, month: 7, day: 28 },
            { year: 1918, month: 11, day: 11 }
        )
        expect(formatEntryDate(e)).toBe(`28. Juli ${DASH} 11. Nov. 1918`)
        expect(formatEntryDate(e, 'long')).toBe(
            `28. Juli ${DASH} 11. November 1918`
        )
    })

    it('otherwise full dates with a spaced en dash', () => {
        expect(formatEntryDate(sampleEntry('erster-weltkrieg'))).toBe(
            `1914${DASH}1918`
        )
        expect(formatEntryDate(sampleEntry('erster-weltkrieg'), 'long')).toBe(
            `28. Juli 1914 ${DASH} 11. November 1918`
        )
        expect(formatEntryDate(sampleEntry('grosser-nordischer-krieg'))).toBe(
            `1700${DASH}1721`
        )
        expect(
            formatEntryDate(sampleEntry('grosser-nordischer-krieg'), 'long')
        ).toBe(`1700 ${DASH} 10. September 1721`)
        expect(formatEntryDate(sampleEntry('russlandfeldzug-1812'))).toBe(
            `24. Juni 1812 ${DASH} Dez. 1812`
        )
        expect(
            formatEntryDate(
                span({ year: 1918, month: 3 }, { year: 1918, month: 6 })
            )
        ).toBe(`März 1918 ${DASH} Juni 1918`)
    })

    it('contains no thin or no-break spaces', () => {
        for (const e of entries) {
            for (const style of ['short', 'long'] as const) {
                expect(formatEntryDate(e, style)).not.toMatch(
                    /[\u2009\u202f\u00a0]/
                )
            }
        }
    })

    it('day-precision span across a year boundary', () => {
        const e = span(
            { year: 1918, month: 12, day: 31 },
            { year: 1919, month: 1, day: 2 }
        )
        expect(formatEntryDate(e)).toBe(`1918${DASH}1919`)
        expect(formatEntryDate(e, 'long')).toBe(
            `31. Dezember 1918 ${DASH} 2. Januar 1919`
        )
    })

    it('years below 100', () => {
        expect(formatHDate({ year: 50 })).toBe('50')
        expect(
            formatEntryDate(
                span(
                    { year: 50, month: 3, day: 1 },
                    { year: 50, month: 3, day: 5 }
                )
            )
        ).toBe(`1.${DASH}5. März 50`)
        expect(formatEntryDate(span({ year: 50 }, { year: 120 }))).toBe(
            `50${DASH}120`
        )
    })

    it('synthetic ranges and labels contain no thin or no-break spaces', () => {
        const out = [
            formatEntryDate(
                span(
                    { year: 1918, month: 7, day: 28 },
                    { year: 1918, month: 11, day: 11 }
                )
            ),
            formatEntryDate(
                span(
                    { year: 1918, month: 7, day: 28 },
                    { year: 1918, month: 11, day: 11 }
                ),
                'long'
            ),
            formatMonth(Date.UTC(1917, 10, 1), true),
            formatDay(Date.UTC(1917, 10, 7)),
        ]
        for (const s of out) expect(s).not.toMatch(/[\u2009\u202f\u00a0]/)
    })

    it('degenerate span collapses to one date', () => {
        expect(formatEntryDate(span({ year: 1918 }, { year: 1918 }))).toBe(
            '1918'
        )
        expect(
            formatEntryDate(
                span({ year: 1918, month: 3 }, { year: 1918, month: 3 })
            )
        ).toBe('März 1918')
    })

    it('ongoing', () => {
        expect(
            formatEntryDate(
                sampleEntry('russischer-angriffskrieg-gegen-die-ukraine')
            )
        ).toBe('seit 24. Feb. 2022')
        expect(
            formatEntryDate(
                sampleEntry('russischer-angriffskrieg-gegen-die-ukraine'),
                'long'
            )
        ).toBe('seit 24. Februar 2022')
        expect(formatEntryDate(span({ year: 2022 }, 'ongoing'))).toBe(
            'seit 2022'
        )
        expect(formatEntryDate(span({ year: 2022, month: 2 }, 'ongoing'))).toBe(
            'seit Feb. 2022'
        )
    })
})

describe('axis labels (de)', () => {
    it('formatYear', () => {
        expect(formatYear(Date.UTC(1917, 0, 1))).toBe('1917')
        expect(formatYear(Date.UTC(1700, 5, 15))).toBe('1700')
        expect(formatYear(Date.UTC(2022, 11, 31, 23, 59))).toBe('2022')
    })

    it('formatMonth uses the in-date abbreviation', () => {
        const m = (month: number) =>
            formatMonth(Date.UTC(1917, month - 1, 1), false)
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m)).toStrictEqual([
            'Jan.',
            'Feb.',
            'März',
            'Apr.',
            'Mai',
            'Juni',
            'Juli',
            'Aug.',
            'Sept.',
            'Okt.',
            'Nov.',
            'Dez.',
        ])
    })

    it('formatMonth with year', () => {
        expect(formatMonth(Date.UTC(1917, 10, 1), true)).toBe('Nov. 1917')
        expect(formatMonth(Date.UTC(1917, 2, 1), true)).toBe('März 1917')
    })

    it('formatDay', () => {
        expect(formatDay(Date.UTC(1917, 10, 7))).toBe('7. Nov.')
        expect(formatDay(Date.UTC(1918, 6, 28))).toBe('28. Juli')
        expect(formatDay(Date.UTC(1916, 1, 29))).toBe('29. Feb.')
    })

    it('uses UTC, not local time', () => {
        expect(formatDay(Date.UTC(1917, 10, 7, 23, 30))).toBe('7. Nov.')
        expect(formatYear(Date.UTC(1917, 11, 31, 23, 30))).toBe('1917')
    })
})

describe('other locales (smoke)', () => {
    it('formats in English', () => {
        expect(
            formatHDate({ year: 1917, month: 11, day: 7 }, 'long', 'en')
        ).toContain('November')
        expect(
            formatEntryDate(span({ year: 2022 }, 'ongoing'), 'short', 'en')
        ).toBe('since 2022')
        expect(
            formatEntryDate(span({ year: 1700 }, { year: 1721 }), 'short', 'en')
        ).toBe(`1700${DASH}1721`)
        expect(
            formatEntryDate(sampleEntry('kubakrise'), 'short', 'en')
        ).toMatch(/Oct.*16.*28.*1962/)
        expect(formatMonth(Date.UTC(1917, 10, 1), false, 'en')).toBe('Nov')
        expect(formatYear(Date.UTC(1917, 0, 1), 'en')).toBe('1917')
        expect(formatDay(Date.UTC(1917, 10, 7), 'en')).toMatch(/Nov.*7/)
    })
})
