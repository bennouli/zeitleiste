import { MS_PER_DAY, MS_PER_YEAR } from '@/lib/time'
import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS, ticks, type TickUnit } from '../ticks'

const { LABEL_PADDING_PX, timeToX } = PRIVATE_UNDER_TESTS

const UNITS: TickUnit[] = [
    'century',
    'half-century',
    'twenty-years',
    'decade',
    'five-years',
    'two-years',
    'year',
    'half-year',
    'quarter',
    'month',
    'week',
    'day',
]
const fineness = (u: TickUnit) => UNITS.indexOf(u)

const END = Date.UTC(2026, 8, 27)
const START_1700 = Date.UTC(1700, 0, 1)

const SPANS: [string, number][] = [
    ['300 years', 300 * MS_PER_YEAR],
    ['100 years', 100 * MS_PER_YEAR],
    ['40 years', 40 * MS_PER_YEAR],
    ['10 years', 10 * MS_PER_YEAR],
    ['3 years', 3 * MS_PER_YEAR],
    ['1 year', MS_PER_YEAR],
    ['6 months', 182 * MS_PER_DAY],
    ['3 months', 91 * MS_PER_DAY],
]

const CHAR = 7.5
const estWidth = (label: string) => label.length * CHAR

describe.each([360, 1920])('ticks at %ipx', (width) => {
    describe.each([
        ['ending 2026-09-27', (span: number) => [END - span, END] as const],
        [
            'starting 1700',
            (span: number) => [START_1700, START_1700 + span] as const,
        ],
    ])('%s', (_name, range) => {
        it.each(SPANS)(
            '%s: sorted, unique, labels do not overlap',
            (_n, span) => {
                const [start, end] = range(span)
                const { ticks: ts } = ticks(start, end, width)
                expect(ts.length).toBeGreaterThanOrEqual(2)
                for (let i = 1; i < ts.length; i++) {
                    const a = ts[i - 1]!
                    const b = ts[i]!
                    expect(b.t).toBeGreaterThan(a.t)
                    const dx =
                        timeToX(start, end, width, b.t) -
                        timeToX(start, end, width, a.t)
                    expect(dx).toBeGreaterThanOrEqual(
                        Math.max(estWidth(a.label), estWidth(b.label))
                    )
                    expect(dx).toBeGreaterThanOrEqual(
                        (estWidth(a.label) + estWidth(b.label)) / 2 +
                            LABEL_PADDING_PX
                    )
                    expect(dx).toBeGreaterThanOrEqual(72)
                }
            }
        )

        it('has exactly one tick beyond each edge', (): void => {
            for (const [, span] of SPANS) {
                const [start, end] = range(span)
                const ts = ticks(start, end, width).ticks
                expect(ts.filter((t) => t.t < start)).toHaveLength(1)
                expect(ts.filter((t) => t.t > end)).toHaveLength(1)
            }
        })

        it('picks finer units for narrower spans', () => {
            const units = SPANS.map(
                ([, span]) => ticks(...range(span), width).unit
            )
            for (let i = 1; i < units.length; i++) {
                expect(fineness(units[i]!)).toBeGreaterThanOrEqual(
                    fineness(units[i - 1]!)
                )
            }
            expect(fineness(units.at(-1)!)).toBeGreaterThan(fineness(units[0]!))
        })
    })

    it('shows twenty-year steps or coarser for 300 years and months or finer for 3 months', () => {
        expect(
            fineness(ticks(END - 300 * MS_PER_YEAR, END, width).unit)
        ).toBeLessThanOrEqual(fineness('twenty-years'))
        expect(
            fineness(ticks(END - 91 * MS_PER_DAY, END, width).unit)
        ).toBeGreaterThanOrEqual(fineness('month'))
    })
})

describe('ticks: units by zoom', () => {
    it('uses centuries for 300 years at 360px', () => {
        expect(ticks(END - 300 * MS_PER_YEAR, END, 360).unit).toBe('century')
    })
    it('uses days when a few weeks span a wide screen', () => {
        const r = ticks(Date.UTC(1917, 10, 1), Date.UTC(1917, 10, 15), 1920)
        expect(r.unit).toBe('day')
        expect(r.ticks.map((t) => t.label)).toContain('7. Nov.')
    })
})

describe('ticks: labels', () => {
    it('labels yearly ticks for 1914–1922', () => {
        const start = Date.UTC(1914, 0, 1)
        const end = Date.UTC(1922, 0, 1)
        const r = ticks(start, end, 960)
        expect(r.unit).toBe('year')
        const inside = r.ticks
            .filter((t) => t.t >= start && t.t <= end)
            .map((t) => t.label)
        expect(inside).toEqual([
            '1914',
            '1915',
            '1916',
            '1917',
            '1918',
            '1919',
            '1920',
            '1921',
            '1922',
        ])
        expect(r.ticks[0]?.label).toBe('1913')
        expect(r.ticks.at(-1)?.label).toBe('1923')
    })

    it('uses German month abbreviations with year when there is room', () => {
        const r = ticks(Date.UTC(1917, 0, 1), Date.UTC(1917, 11, 31), 1920)
        expect(r.unit).toBe('month')
        const labels = r.ticks.map((t) => t.label)
        for (const l of [
            'Jan. 1917',
            'März 1917',
            'Juni 1917',
            'Sept. 1917',
            'Nov. 1917',
            'Dez. 1917',
        ]) {
            expect(labels).toContain(l)
        }
    })

    it('falls back to short month labels with the year on January', () => {
        // 1 year across 950px: February is ≥ 72px wide, but 'Sept. 1917'/'Okt. 1917' need ~79px over 30 days.
        const r = ticks(Date.UTC(1917, 0, 1), Date.UTC(1918, 0, 1), 950)
        expect(r.unit).toBe('month')
        const labels = r.ticks.map((t) => t.label)
        expect(labels).toContain('1917')
        expect(labels).toContain('Nov.')
        expect(labels).toContain('Mai')
        expect(labels.some((l) => /\d{4}/.test(l) && l.length > 4)).toBe(false)
    })

    it('labels the first of the month with month and year at day steps', () => {
        const r = ticks(Date.UTC(1917, 9, 20), Date.UTC(1917, 10, 10), 1920)
        expect(r.unit).toBe('day')
        const first = r.ticks.find((t) => t.t === Date.UTC(1917, 10, 1))
        expect(first).toEqual({
            t: Date.UTC(1917, 10, 1),
            label: 'Nov. 1917',
            major: true,
        })
        expect(r.ticks.find((t) => t.t === Date.UTC(1917, 10, 7))?.label).toBe(
            '7. Nov.'
        )
    })

    it('places week ticks on the 1st, 8th, 15th and 22nd', () => {
        const r = ticks(Date.UTC(1917, 5, 1), Date.UTC(1917, 8, 1), 1920)
        expect(r.unit).toBe('week')
        for (const t of r.ticks)
            expect([1, 8, 15, 22]).toContain(new Date(t.t).getUTCDate())
    })
})

describe('ticks: major flags', () => {
    it('marks centuries as major at decade steps', () => {
        const r = ticks(Date.UTC(1850, 0, 1), Date.UTC(1950, 0, 1), 1300)
        expect(r.unit).toBe('decade')
        for (const t of r.ticks) {
            expect(t.major).toBe(new Date(t.t).getUTCFullYear() % 100 === 0)
        }
        expect(r.ticks.some((t) => t.major)).toBe(true)
    })

    it('marks January as major at month steps', () => {
        const r = ticks(Date.UTC(1916, 6, 1), Date.UTC(1917, 6, 1), 1920)
        expect(r.unit).toBe('month')
        for (const t of r.ticks)
            expect(t.major).toBe(new Date(t.t).getUTCMonth() === 0)
        expect(r.ticks.filter((t) => t.major)).toHaveLength(1)
    })

    it('marks decades as major at two- and five-year steps and centuries at twenty-year steps', () => {
        const cases: [number, number, TickUnit, number][] = [
            [40, 1920, 'two-years', 10],
            [100, 1920, 'five-years', 10],
            [300, 1920, 'twenty-years', 100],
        ]
        for (const [span, width, unit, mod] of cases) {
            const r = ticks(END - span * MS_PER_YEAR, END, width)
            expect(r.unit).toBe(unit)
            for (const t of r.ticks)
                expect(t.major).toBe(new Date(t.t).getUTCFullYear() % mod === 0)
        }
    })

    it('marks the 1st of the month as major at week and day steps', () => {
        for (const [s, e] of [
            [Date.UTC(1917, 5, 1), Date.UTC(1917, 8, 1)],
            [Date.UTC(1917, 9, 20), Date.UTC(1917, 10, 10)],
        ] as const) {
            const r = ticks(s, e, 1920)
            expect(['week', 'day']).toContain(r.unit)
            for (const t of r.ticks)
                expect(t.major).toBe(new Date(t.t).getUTCDate() === 1)
        }
    })

    it('labels quarters in short form with the year on January', () => {
        // 3 years across 700px: long quarter labels do not fit, short ones do.
        const r = ticks(Date.UTC(1916, 0, 1), Date.UTC(1919, 0, 1), 700, {
            minLabelGapPx: 50,
        })
        expect(r.unit).toBe('quarter')
        const byMonth = new Map(
            r.ticks.map((t) => [new Date(t.t).getUTCMonth(), t.label])
        )
        expect(byMonth.get(3)).toBe('Apr.')
        expect(byMonth.get(6)).toBe('Juli')
        expect(byMonth.get(9)).toBe('Okt.')
        const jan = r.ticks.find((t) => t.t === Date.UTC(1917, 0, 1))
        expect(jan).toEqual({
            t: Date.UTC(1917, 0, 1),
            label: '1917',
            major: true,
        })
    })

    it('marks decades as major at year steps', () => {
        const r = ticks(Date.UTC(1914, 0, 1), Date.UTC(1922, 0, 1), 960)
        expect(r.ticks.filter((t) => t.major).map((t) => t.label)).toEqual([
            '1920',
        ])
    })
})

describe('ticks: edge cases', () => {
    it('returns no ticks for an empty or inverted range or zero width', () => {
        expect(ticks(END, END, 1000).ticks).toEqual([])
        expect(ticks(END, END - MS_PER_YEAR, 1000).ticks).toEqual([])
        expect(ticks(END - MS_PER_YEAR, END, 0).ticks).toEqual([])
        expect(ticks(NaN, END, 1000).ticks).toEqual([])
    })

    it('falls back to centuries when nothing fits', () => {
        const r = ticks(END - 300 * MS_PER_YEAR, END, 100)
        expect(r.unit).toBe('century')
        expect(r.ticks.length).toBeGreaterThan(0)
    })

    it('is deterministic', () => {
        expect(ticks(END - 3 * MS_PER_YEAR, END, 800)).toEqual(
            ticks(END - 3 * MS_PER_YEAR, END, 800)
        )
    })

    it('replaces invalid options with the defaults', () => {
        const start = Date.UTC(1700, 0, 1)
        const def = ticks(start, END, 1920)
        for (const bad of [NaN, 0, -5, Infinity]) {
            expect(ticks(start, END, 1920, { minLabelGapPx: bad })).toEqual(def)
            expect(ticks(start, END, 1920, { charWidthPx: bad })).toEqual(def)
        }
    })

    it('keeps one tick outside each edge when the edges fall on ticks', () => {
        const start = Date.UTC(1914, 0, 1)
        const end = Date.UTC(1922, 0, 1)
        const ts = ticks(start, end, 960).ticks
        expect(ts.filter((t) => t.t < start)).toHaveLength(1)
        expect(ts.filter((t) => t.t > end)).toHaveLength(1)
    })

    it('never overlaps across a zoom sweep and never gets coarser as the span shrinks', () => {
        for (const width of [360, 800, 1920]) {
            let prev = -1
            for (
                let span = 300 * MS_PER_YEAR;
                span > 20 * MS_PER_DAY;
                span *= 0.97
            ) {
                const r = ticks(END - span, END, width)
                expect(fineness(r.unit)).toBeGreaterThanOrEqual(prev)
                prev = fineness(r.unit)
                for (let i = 1; i < r.ticks.length; i++) {
                    const a = r.ticks[i - 1]!
                    const b = r.ticks[i]!
                    const dx =
                        timeToX(END - span, END, width, b.t) -
                        timeToX(END - span, END, width, a.t)
                    expect(dx).toBeGreaterThanOrEqual(
                        (estWidth(a.label) + estWidth(b.label)) / 2 +
                            LABEL_PADDING_PX
                    )
                }
            }
        }
    })

    it('respects custom options', () => {
        const wide = ticks(END - 10 * MS_PER_YEAR, END, 1920, {
            minLabelGapPx: 300,
        })
        const tight = ticks(END - 10 * MS_PER_YEAR, END, 1920, {
            minLabelGapPx: 20,
        })
        expect(fineness(wide.unit)).toBeLessThan(fineness(tight.unit))
        const en = ticks(Date.UTC(1917, 0, 1), Date.UTC(1917, 11, 31), 1920, {
            locale: 'en',
        })
        expect(en.ticks.map((t) => t.label)).toContain('Nov 1917')
    })
})

describe('timeToX', () => {
    const s = Date.UTC(1900, 0, 1)
    const e = Date.UTC(2000, 0, 1)
    it('maps the range linearly onto [0, width]', () => {
        expect(timeToX(s, e, 1000, s)).toBe(0)
        expect(timeToX(s, e, 1000, e)).toBe(1000)
        expect(timeToX(s, e, 1000, (s + e) / 2)).toBeCloseTo(500)
        expect(timeToX(s, e, 1000, s - (e - s))).toBeCloseTo(-1000)
        const a = Date.UTC(1917, 10, 7)
        const b = Date.UTC(1941, 5, 22)
        expect(timeToX(s, e, 1000, b) - timeToX(s, e, 1000, a)).toBeCloseTo(
            ((b - a) / (e - s)) * 1000
        )
    })
    it('returns 0 for an empty range', () => {
        expect(timeToX(s, s, 1000, s)).toBe(0)
    })
})
