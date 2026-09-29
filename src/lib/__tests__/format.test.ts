import { entries } from '@/data/entries'
import { sampleEntry } from '@/test/entries'
import { describe, expect, it } from 'vitest'
import type { Entry, HDate } from '../entry'
import {
    entryLabel,
    formatDay,
    formatEntryDate,
    formatEntryMeta,
    formatGroupMeta,
    formatGroupName,
    formatGroupZoomName,
    formatMonth,
    formatPosition,
    formatYear,
    PRIVATE_UNDER_TESTS,
} from '../format'

const { formatHDate, formatGroupYears } = PRIVATE_UNDER_TESTS

const DASH = '–'

function span(start: HDate, end?: HDate | 'ongoing'): Entry {
    return {
        id: 't',
        title: 'T',
        summary: 'T',
        start,
        end,
        type: 'event',
        tags: [],
    }
}

describe('formatHDate (de)', () => {
    it('year precision', () => {
        expect(formatHDate({ year: 1700 }, 'short', 'de')).toBe('1700')
        expect(formatHDate({ year: 1700 }, 'long', 'de')).toBe('1700')
    })

    it('month precision', () => {
        expect(formatHDate({ year: 1917, month: 11 }, 'short', 'de')).toBe(
            'Nov. 1917'
        )
        expect(formatHDate({ year: 1917, month: 11 }, 'long', 'de')).toBe(
            'November 1917'
        )
        expect(formatHDate({ year: 2014, month: 3 }, 'short', 'de')).toBe(
            'März 2014'
        )
        expect(formatHDate({ year: 1907, month: 6 }, 'short', 'de')).toBe(
            'Juni 1907'
        )
    })

    it('day precision', () => {
        expect(
            formatHDate({ year: 1917, month: 11, day: 7 }, 'short', 'de')
        ).toBe('7. Nov. 1917')
        expect(
            formatHDate({ year: 1917, month: 11, day: 7 }, 'long', 'de')
        ).toBe('7. November 1917')
        expect(
            formatHDate({ year: 1918, month: 7, day: 28 }, 'short', 'de')
        ).toBe('28. Juli 1918')
        expect(
            formatHDate({ year: 1721, month: 9, day: 10 }, 'short', 'de')
        ).toBe('10. Sept. 1721')
        expect(
            formatHDate({ year: 1916, month: 2, day: 29 }, 'short', 'de')
        ).toBe('29. Feb. 1916')
    })
})

describe('formatEntryDate (de)', () => {
    it('point', () => {
        expect(
            formatEntryDate(sampleEntry('oktoberrevolution'), 'short', 'de')
        ).toBe('7. Nov. 1917')
        expect(
            formatEntryDate(sampleEntry('oktoberrevolution'), 'long', 'de')
        ).toBe('7. November 1917')
        expect(
            formatEntryDate(sampleEntry('annexion-der-krim'), 'short', 'de')
        ).toBe('März 2014')
    })

    it('year–year span: unspaced en dash', () => {
        expect(
            formatEntryDate(span({ year: 1700 }, { year: 1721 }), 'short', 'de')
        ).toBe(`1700${DASH}1721`)
        expect(
            formatEntryDate(span({ year: 1700 }, { year: 1721 }), 'long', 'de')
        ).toBe(`1700${DASH}1721`)
    })

    it('same year and month, day precision', () => {
        expect(formatEntryDate(sampleEntry('kubakrise'), 'short', 'de')).toBe(
            `16.${DASH}28. Okt. 1962`
        )
        expect(formatEntryDate(sampleEntry('kubakrise'), 'long', 'de')).toBe(
            `16.${DASH}28. Oktober 1962`
        )
    })

    it('same year different months, day precision: spaced en dash', () => {
        const e = span(
            { year: 1918, month: 7, day: 28 },
            { year: 1918, month: 11, day: 11 }
        )
        expect(formatEntryDate(e, 'short', 'de')).toBe(
            `28. Juli ${DASH} 11. Nov. 1918`
        )
        expect(formatEntryDate(e, 'long', 'de')).toBe(
            `28. Juli ${DASH} 11. November 1918`
        )
    })

    it('otherwise full dates with a spaced en dash', () => {
        expect(
            formatEntryDate(sampleEntry('erster-weltkrieg'), 'short', 'de')
        ).toBe(`1914${DASH}1918`)
        expect(
            formatEntryDate(sampleEntry('erster-weltkrieg'), 'long', 'de')
        ).toBe(`28. Juli 1914 ${DASH} 11. November 1918`)
        expect(
            formatEntryDate(
                sampleEntry('grosser-nordischer-krieg'),
                'short',
                'de'
            )
        ).toBe(`1700${DASH}1721`)
        expect(
            formatEntryDate(
                sampleEntry('grosser-nordischer-krieg'),
                'long',
                'de'
            )
        ).toBe(`1700 ${DASH} 10. September 1721`)
        expect(
            formatEntryDate(sampleEntry('russlandfeldzug-1812'), 'short', 'de')
        ).toBe(`24. Juni 1812 ${DASH} Dez. 1812`)
        expect(
            formatEntryDate(
                span({ year: 1918, month: 3 }, { year: 1918, month: 6 }),
                'short',
                'de'
            )
        ).toBe(`März 1918 ${DASH} Juni 1918`)
    })

    it('contains no thin or no-break spaces', () => {
        for (const e of entries) {
            for (const style of ['short', 'long'] as const) {
                expect(formatEntryDate(e, style, 'de')).not.toMatch(
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
        expect(formatEntryDate(e, 'short', 'de')).toBe(`1918${DASH}1919`)
        expect(formatEntryDate(e, 'long', 'de')).toBe(
            `31. Dezember 1918 ${DASH} 2. Januar 1919`
        )
    })

    it('years below 100', () => {
        expect(formatHDate({ year: 50 }, 'short', 'de')).toBe('50')
        expect(
            formatEntryDate(
                span(
                    { year: 50, month: 3, day: 1 },
                    { year: 50, month: 3, day: 5 }
                ),
                'short',
                'de'
            )
        ).toBe(`1.${DASH}5. März 50`)
        expect(
            formatEntryDate(span({ year: 50 }, { year: 120 }), 'short', 'de')
        ).toBe(`50${DASH}120`)
    })

    it('synthetic ranges and labels contain no thin or no-break spaces', () => {
        const out = [
            formatEntryDate(
                span(
                    { year: 1918, month: 7, day: 28 },
                    { year: 1918, month: 11, day: 11 }
                ),
                'short',
                'de'
            ),
            formatEntryDate(
                span(
                    { year: 1918, month: 7, day: 28 },
                    { year: 1918, month: 11, day: 11 }
                ),
                'long',
                'de'
            ),
            formatMonth(Date.UTC(1917, 10, 1), true, 'de'),
            formatDay(Date.UTC(1917, 10, 7), 'de'),
        ]
        for (const s of out) expect(s).not.toMatch(/[\u2009\u202f\u00a0]/)
    })

    it('degenerate span collapses to one date', () => {
        expect(
            formatEntryDate(span({ year: 1918 }, { year: 1918 }), 'short', 'de')
        ).toBe('1918')
        expect(
            formatEntryDate(
                span({ year: 1918, month: 3 }, { year: 1918, month: 3 }),
                'short',
                'de'
            )
        ).toBe('März 1918')
    })

    it('ongoing', () => {
        expect(
            formatEntryDate(
                sampleEntry('russischer-angriffskrieg-gegen-die-ukraine'),
                'short',
                'de'
            )
        ).toBe('seit 24. Feb. 2022')
        expect(
            formatEntryDate(
                sampleEntry('russischer-angriffskrieg-gegen-die-ukraine'),
                'long',
                'de'
            )
        ).toBe('seit 24. Februar 2022')
        expect(
            formatEntryDate(span({ year: 2022 }, 'ongoing'), 'short', 'de')
        ).toBe('seit 2022')
        expect(
            formatEntryDate(
                span({ year: 2022, month: 2 }, 'ongoing'),
                'short',
                'de'
            )
        ).toBe('seit Feb. 2022')
    })
})

describe('entryLabel', () => {
    it('names title and short date', () => {
        const withoutPost = sampleEntry('dekabristenaufstand')
        expect(entryLabel(withoutPost, 'de')).toBe(
            'Dekabristenaufstand, 26. Dez. 1825'
        )
    })

    it('marks an entry with a post', () => {
        const withPost = sampleEntry('oktoberrevolution')
        expect(entryLabel(withPost, 'de')).toBe(
            'Oktoberrevolution, 7. Nov. 1917, Beitrag'
        )
    })
})

describe('formatEntryMeta', () => {
    it('joins long date, type and the one tag', () => {
        const point = sampleEntry('oktoberrevolution')
        expect(formatEntryMeta(point, 'de')).toBe(
            '7. November 1917 · Revolution · Russland'
        )
    })

    it('gives a span its date range and every tag in order', () => {
        const range = sampleEntry('grosser-nordischer-krieg')
        expect(formatEntryMeta(range, 'de')).toBe(
            '1700 – 10. September 1721 · Krieg · Russland · Schweden'
        )
    })

    it('ends with the type when the entry has no tags', () => {
        const untagged: Entry = {
            ...sampleEntry('oktoberrevolution'),
            tags: [],
        }
        expect(formatEntryMeta(untagged, 'de')).toBe(
            '7. November 1917 · Revolution'
        )
    })
})

describe('group lines', () => {
    const revolution = span({ year: 1917 })
    const civilWar = span({ year: 1920 })
    const nep = span({ year: 1922 })
    const threeYears = [revolution, civilWar, nep]
    const twoInOneYear = [revolution, revolution]
    const single = [revolution]
    const none: Entry[] = []

    it('formatGroupYears spans the first to the last start year', () => {
        expect(formatGroupYears(threeYears)).toBe(`1917${DASH}1922`)
    })

    it('formatGroupYears names a single year once and nothing for no entries', () => {
        expect(formatGroupYears(twoInOneYear)).toBe('1917')
        expect(formatGroupYears(none)).toBe('')
    })

    it('formatGroupName names the count and the years', () => {
        expect(formatGroupName(threeYears, 'de')).toBe(
            `Gruppe mit 3 Einträgen, 1917${DASH}1922`
        )
        expect(formatGroupName(twoInOneYear, 'de')).toBe(
            'Gruppe mit 2 Einträgen, 1917'
        )
        expect(formatGroupName(single, 'de')).toBe('Gruppe mit 1 Eintrag, 1917')
    })

    it('formatGroupName falls back to a bare name for no entries', () => {
        expect(formatGroupName(none, 'de')).toBe('Gruppe')
    })

    it('formatGroupZoomName prefixes the group name with the zoom action', () => {
        expect(formatGroupZoomName(threeYears, 'de')).toBe(
            `Hineinzoomen: Gruppe mit 3 Einträgen, 1917${DASH}1922`
        )
    })

    it('formatGroupMeta counts the entries before the years', () => {
        expect(formatGroupMeta(threeYears, 'de')).toBe(
            `3 Einträge · 1917${DASH}1922`
        )
        expect(formatGroupMeta(single, 'de')).toBe('1 Eintrag · 1917')
    })

    it('formatPosition counts from one', () => {
        const firstOfSix = { index: 0, count: 6 }
        const fifthOfSeven = { index: 4, count: 7 }
        expect(formatPosition(firstOfSix.index, firstOfSix.count, 'de')).toBe(
            '1 von 6'
        )
        expect(
            formatPosition(fifthOfSeven.index, fifthOfSeven.count, 'de')
        ).toBe('5 von 7')
    })
})

describe('axis labels (de)', () => {
    it('formatYear', () => {
        expect(formatYear(Date.UTC(1917, 0, 1), 'de')).toBe('1917')
        expect(formatYear(Date.UTC(1700, 5, 15), 'de')).toBe('1700')
        expect(formatYear(Date.UTC(2022, 11, 31, 23, 59), 'de')).toBe('2022')
    })

    it('formatMonth uses the in-date abbreviation', () => {
        const m = (month: number) =>
            formatMonth(Date.UTC(1917, month - 1, 1), false, 'de')
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
        expect(formatMonth(Date.UTC(1917, 10, 1), true, 'de')).toBe('Nov. 1917')
        expect(formatMonth(Date.UTC(1917, 2, 1), true, 'de')).toBe('März 1917')
    })

    it('formatDay', () => {
        expect(formatDay(Date.UTC(1917, 10, 7), 'de')).toBe('7. Nov.')
        expect(formatDay(Date.UTC(1918, 6, 28), 'de')).toBe('28. Juli')
        expect(formatDay(Date.UTC(1916, 1, 29), 'de')).toBe('29. Feb.')
    })

    it('uses UTC, not local time', () => {
        expect(formatDay(Date.UTC(1917, 10, 7, 23, 30), 'de')).toBe('7. Nov.')
        expect(formatYear(Date.UTC(1917, 11, 31, 23, 30), 'de')).toBe('1917')
    })
})

describe('formatEntryDate (en)', () => {
    it('point', () => {
        const revolution = sampleEntry('oktoberrevolution')
        expect(formatEntryDate(revolution, 'short', 'en')).toBe('7 Nov 1917')
        expect(formatEntryDate(revolution, 'long', 'en')).toBe(
            '7 November 1917'
        )
        expect(
            formatHDate({ year: 1721, month: 9, day: 10 }, 'short', 'en')
        ).toBe('10 Sept 1721')
    })

    it('same year and month, day precision: the spaced Intl range', () => {
        const cubanCrisis = sampleEntry('kubakrise')
        expect(formatEntryDate(cubanCrisis, 'short', 'en')).toBe(
            `16 ${DASH} 28 Oct 1962`
        )
        expect(formatEntryDate(cubanCrisis, 'long', 'en')).toBe(
            `16 ${DASH} 28 October 1962`
        )
    })

    it('otherwise full dates with a spaced en dash', () => {
        const worldWar = sampleEntry('erster-weltkrieg')
        expect(formatEntryDate(worldWar, 'short', 'en')).toBe(`1914${DASH}1918`)
        expect(formatEntryDate(worldWar, 'long', 'en')).toBe(
            `28 July 1914 ${DASH} 11 November 1918`
        )
    })

    it('ongoing', () => {
        const ukraineWar = sampleEntry(
            'russischer-angriffskrieg-gegen-die-ukraine'
        )
        expect(formatEntryDate(ukraineWar, 'short', 'en')).toBe(
            'since 24 Feb 2022'
        )
        expect(formatEntryDate(ukraineWar, 'long', 'en')).toBe(
            'since 24 February 2022'
        )
    })
})

describe('entry and group texts (en)', () => {
    const revolution = span({ year: 1917 })
    const threeYears = [revolution, span({ year: 1920 }), span({ year: 1922 })]

    it('entryLabel marks an entry with a post', () => {
        const withPost = sampleEntry('oktoberrevolution')
        expect(entryLabel(withPost, 'en')).toBe(
            'Oktoberrevolution, 7 Nov 1917, Post'
        )
    })

    it('formatEntryMeta names the type in English', () => {
        const range = sampleEntry('grosser-nordischer-krieg')
        expect(formatEntryMeta(range, 'en')).toBe(
            '1700 – 10 September 1721 · War · Russland · Schweden'
        )
    })

    it('group names, lines and positions', () => {
        expect(formatGroupName(threeYears, 'en')).toBe(
            `Group of 3 entries, 1917${DASH}1922`
        )
        expect(formatGroupName([revolution], 'en')).toBe(
            'Group of 1 entry, 1917'
        )
        expect(formatGroupName([], 'en')).toBe('Group')
        expect(formatGroupZoomName(threeYears, 'en')).toBe(
            `Zoom in: Group of 3 entries, 1917${DASH}1922`
        )
        expect(formatGroupMeta(threeYears, 'en')).toBe(
            `3 entries · 1917${DASH}1922`
        )
        expect(formatPosition(4, 7, 'en')).toBe('5 of 7')
    })
})

describe('axis labels (en)', () => {
    it('formatMonth uses the British abbreviations', () => {
        const m = (month: number) =>
            formatMonth(Date.UTC(1917, month - 1, 1), false, 'en')
        expect([1, 6, 9, 11].map(m)).toStrictEqual([
            'Jan',
            'Jun',
            'Sept',
            'Nov',
        ])
        expect(formatMonth(Date.UTC(1917, 10, 1), true, 'en')).toBe('Nov 1917')
    })

    it('formatDay puts the day first', () => {
        expect(formatDay(Date.UTC(1917, 10, 7), 'en')).toBe('7 Nov')
    })

    it('formatYear', () => {
        expect(formatYear(Date.UTC(1917, 0, 1), 'en')).toBe('1917')
    })
})
