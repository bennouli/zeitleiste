import {
    utcDay,
    utcMonth,
    utcYear,
    type CountableTimeInterval,
    type TimeInterval,
} from 'd3-time'

export type TickUnit =
    | 'century'
    | 'half-century'
    | 'twenty-years'
    | 'decade'
    | 'five-years'
    | 'two-years'
    | 'year'
    | 'half-year'
    | 'quarter'
    | 'month'
    | 'week'
    | 'day'

export interface Tick {
    /** ms UTC */
    t: number
    /** Label to draw, e.g. '1900', '1917', 'Nov. 1917', 'Nov.', '7. Nov.' */
    label: string
    /** Emphasised mark: century boundaries when stepping decades, decades when stepping years, years when stepping months, months when stepping days. */
    major: boolean
}

export interface TicksOptions {
    /**
     * Minimum horizontal distance between adjacent labels (tick positions) in px, default 72.
     * Rule: adjacent tick positions must be at least
     * max(minLabelGapPx, (widthA + widthB) / 2 + LABEL_PADDING_PX) apart,
     * where a label's width is estimated as label.length * charWidthPx (labels are centred on their tick).
     */
    minLabelGapPx?: number
    /** Estimated width of one label character in px, default 7.5. */
    charWidthPx?: number
    /** Default 'de'. */
    locale?: string
}

export interface TickResult {
    unit: TickUnit
    ticks: Tick[]
}

/** Free space kept between the edges of two neighbouring labels, in px. */
export const LABEL_PADDING_PX = 8

const DAY_MS = 86_400_000
/** Days of the month that carry a tick at 'week' steps; keeps month starts on the grid. */
const WEEK_DAYS = new Set([1, 8, 15, 22])

type LabelMode = 'long' | 'short'

interface Candidate {
    unit: TickUnit
    interval: TimeInterval
    /** Lower bound of the distance between two ticks, used to skip hopeless units cheaply. */
    minStepMs: number
    mode: LabelMode
}

function years(n: number): TimeInterval {
    return (utcYear as CountableTimeInterval).every(n) as TimeInterval
}
function months(n: number): TimeInterval {
    return (utcMonth as CountableTimeInterval).every(n) as TimeInterval
}

const YEAR_MS = 365 * DAY_MS

const CENTURY: Candidate = {
    unit: 'century',
    interval: years(100),
    minStepMs: 100 * YEAR_MS,
    mode: 'long',
}

/** Finest first; for month-based units the long label form is tried before the short one. */
const CANDIDATES: Candidate[] = [
    { unit: 'day', interval: utcDay, minStepMs: DAY_MS, mode: 'long' },
    {
        unit: 'week',
        interval: utcDay.filter((d) => WEEK_DAYS.has(d.getUTCDate())),
        minStepMs: 7 * DAY_MS,
        mode: 'long',
    },
    { unit: 'month', interval: utcMonth, minStepMs: 28 * DAY_MS, mode: 'long' },
    {
        unit: 'month',
        interval: utcMonth,
        minStepMs: 28 * DAY_MS,
        mode: 'short',
    },
    {
        unit: 'quarter',
        interval: months(3),
        minStepMs: 89 * DAY_MS,
        mode: 'long',
    },
    {
        unit: 'quarter',
        interval: months(3),
        minStepMs: 89 * DAY_MS,
        mode: 'short',
    },
    {
        unit: 'half-year',
        interval: months(6),
        minStepMs: 181 * DAY_MS,
        mode: 'long',
    },
    {
        unit: 'half-year',
        interval: months(6),
        minStepMs: 181 * DAY_MS,
        mode: 'short',
    },
    { unit: 'year', interval: years(1), minStepMs: YEAR_MS, mode: 'long' },
    {
        unit: 'two-years',
        interval: years(2),
        minStepMs: 2 * YEAR_MS,
        mode: 'long',
    },
    {
        unit: 'five-years',
        interval: years(5),
        minStepMs: 5 * YEAR_MS,
        mode: 'long',
    },
    {
        unit: 'decade',
        interval: years(10),
        minStepMs: 10 * YEAR_MS,
        mode: 'long',
    },
    {
        unit: 'twenty-years',
        interval: years(20),
        minStepMs: 20 * YEAR_MS,
        mode: 'long',
    },
    {
        unit: 'half-century',
        interval: years(50),
        minStepMs: 50 * YEAR_MS,
        mode: 'long',
    },
    CENTURY,
]

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(
    locale: string,
    opts: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
    const key = locale + JSON.stringify(opts)
    let f = formatterCache.get(key)
    if (!f) {
        f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts })
        formatterCache.set(key, f)
    }
    return f
}

const fmtYear = (l: string, t: number) =>
    formatter(l, { year: 'numeric' }).format(t)
const fmtMonthYear = (l: string, t: number) =>
    formatter(l, { month: 'short', year: 'numeric' }).format(t)
const fmtDayMonth = (l: string, t: number) =>
    formatter(l, { day: 'numeric', month: 'short' }).format(t)
/** Month name in its format (not standalone) form, e.g. 'Nov.' rather than 'Nov'. */
function fmtMonth(l: string, t: number): string {
    const parts = formatter(l, {
        month: 'short',
        year: 'numeric',
    }).formatToParts(t)
    return parts.find((p) => p.type === 'month')?.value ?? fmtMonthYear(l, t)
}

function isMajor(unit: TickUnit, d: Date): boolean {
    switch (unit) {
        case 'century':
        case 'half-century':
        case 'twenty-years':
        case 'decade':
            return d.getUTCFullYear() % 100 === 0
        case 'five-years':
        case 'two-years':
        case 'year':
            return d.getUTCFullYear() % 10 === 0
        case 'half-year':
        case 'quarter':
        case 'month':
            return d.getUTCMonth() === 0
        case 'week':
        case 'day':
            return d.getUTCDate() === 1
    }
}

function labelFor(c: Candidate, d: Date, locale: string): string {
    const t = d.getTime()
    switch (c.unit) {
        case 'half-year':
        case 'quarter':
        case 'month':
            if (c.mode === 'long') return fmtMonthYear(locale, t)
            return d.getUTCMonth() === 0
                ? fmtYear(locale, t)
                : fmtMonth(locale, t)
        case 'week':
        case 'day':
            return d.getUTCDate() === 1
                ? fmtMonthYear(locale, t)
                : fmtDayMonth(locale, t)
        default:
            return fmtYear(locale, t)
    }
}

function build(
    c: Candidate,
    start: number,
    end: number,
    locale: string
): Tick[] {
    // One tick strictly before start and one strictly after end.
    const lo = c.interval.floor(new Date(start - 1))
    const hi = c.interval.ceil(new Date(end + 1))
    // range() excludes its stop value, so step past hi.
    return c.interval.range(lo, new Date(hi.getTime() + 1)).map((d) => ({
        t: d.getTime(),
        label: labelFor(c, d, locale),
        major: isMajor(c.unit, d),
    }))
}

function fits(
    ticks: Tick[],
    start: number,
    end: number,
    widthPx: number,
    minGap: number,
    charWidth: number
): boolean {
    let a: Tick | undefined
    for (const b of ticks) {
        if (!a) {
            a = b
            continue
        }
        const dx =
            timeToX(start, end, widthPx, b.t) -
            timeToX(start, end, widthPx, a.t)
        const needed = Math.max(
            minGap,
            ((a.label.length + b.label.length) * charWidth) / 2 +
                LABEL_PADDING_PX
        )
        if (dx < needed) return false
        a = b
    }
    return true
}

function positiveOr(v: number | undefined, fallback: number): number {
    return v !== undefined && Number.isFinite(v) && v > 0 ? v : fallback
}

/** Ticks for the visible range [start, end] rendered across widthPx. Picks the finest unit whose labels don't overlap. */
export function ticks(
    start: number,
    end: number,
    widthPx: number,
    options: TicksOptions = {}
): TickResult {
    const minLabelGapPx = positiveOr(options.minLabelGapPx, 72)
    const charWidthPx = positiveOr(options.charWidthPx, 7.5)
    const locale = options.locale ?? 'de'
    const fallback = CENTURY
    if (
        ![start, end, widthPx].every(Number.isFinite) ||
        end <= start ||
        widthPx <= 0
    ) {
        return { unit: fallback.unit, ticks: [] }
    }
    const pxPerMs = widthPx / (end - start)
    for (const c of CANDIDATES) {
        if (c.minStepMs * pxPerMs < minLabelGapPx) continue
        const result = build(c, start, end, locale)
        if (
            c === fallback ||
            fits(result, start, end, widthPx, minLabelGapPx, charWidthPx)
        ) {
            return { unit: c.unit, ticks: result }
        }
    }
    return { unit: fallback.unit, ticks: build(fallback, start, end, locale) }
}

/** Map a time to x within [0, widthPx] for the given range (linear). Exported for tests and callers. */
export function timeToX(
    start: number,
    end: number,
    widthPx: number,
    t: number
): number {
    if (end === start) return 0
    return ((t - start) / (end - start)) * widthPx
}
