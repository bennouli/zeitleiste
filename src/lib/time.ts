import { precisionOf, type Entry, type HDate } from './entry'

export const MS_PER_DAY = 86_400_000
/** Mean Gregorian year (365.2425 days); for approximate spans and zoom math only. */
export const MS_PER_YEAR = 365.2425 * MS_PER_DAY

/** Date.UTC without the 0–99 → 1900+ mapping. Month is 0-based; overflow rolls over. */
function utc(year: number, month0: number, day: number): number {
    return new Date(0).setUTCFullYear(year, month0, day)
}

/** Start (inclusive) of the unit the date is specified to, e.g. {1917,11} → 1 Nov 1917 00:00 UTC. */
export function startOf(d: HDate): number {
    return utc(d.year, (d.month ?? 1) - 1, d.day ?? 1)
}

/** End (exclusive) of that unit = start of the next unit, e.g. {1917,11} → 1 Dec 1917. */
function endOf(d: HDate): number {
    switch (precisionOf(d)) {
        case 'year':
            return utc(d.year + 1, 0, 1)
        case 'month':
            return utc(d.year, d.month!, 1)
        case 'day':
            return utc(d.year, d.month! - 1, d.day! + 1)
    }
}

/** Midpoint of the unit; the anchor used to position a point in time on the axis. */
function midOf(d: HDate): number {
    return (startOf(d) + endOf(d)) / 2
}

/** Anchor of an entry on the axis: midOf(e.start). */
export function entryAnchor(e: Entry): number {
    return midOf(e.start)
}

/** [start, end] of an entry: spans use startOf(start) and endOf(end) or `today` when ongoing; points return [anchor, anchor]. */
export function entryRange(e: Entry, today: number): [number, number] {
    if (e.end === undefined) {
        const a = entryAnchor(e)
        return [a, a]
    }
    return [startOf(e.start), e.end === 'ongoing' ? today : endOf(e.end)]
}

/** Today at 00:00 UTC, from `now` (default Date.now()). */
export function todayMs(now: number = Date.now()): number {
    return Math.floor(now / MS_PER_DAY) * MS_PER_DAY
}

/** Chronological comparison of two HDates by their startOf. */
function compareHDate(a: HDate, b: HDate): number {
    return Math.sign(startOf(a) - startOf(b))
}

export const PRIVATE_UNDER_TESTS = {
    endOf,
    midOf,
    compareHDate,
}
