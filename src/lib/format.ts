import {
    CATEGORY_LABEL,
    precisionOf,
    REGION_LABEL,
    type Entry,
    type HDate,
} from './entry'
import { startOf } from './time'

export type DateStyle = 'short' | 'long'

const SINCE: Record<string, string> = { de: 'seit', en: 'since' }
const EN_DASH = '–'

const cache = new Map<string, Intl.DateTimeFormat>()

/** ICU emits thin/narrow/no-break spaces depending on version and locale; normalize them for stable output across server and browser. */
function plainSpaces(s: string): string {
    return s.replace(/[\u2009\u202f\u00a0]/g, ' ')
}

function dtf(
    locale: string,
    options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
    const key = locale + JSON.stringify(options)
    let f = cache.get(key)
    if (!f) {
        f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options })
        cache.set(key, f)
    }
    return f
}

function optionsFor(d: HDate, style: DateStyle): Intl.DateTimeFormatOptions {
    const month = style === 'long' ? 'long' : 'short'
    switch (precisionOf(d)) {
        case 'year':
            return { year: 'numeric' }
        case 'month':
            return { year: 'numeric', month }
        case 'day':
            return { year: 'numeric', month, day: 'numeric' }
    }
}

/** Years must be >= 1 (Intl drops the era for BC years).
 *  short: '1700' | 'Nov. 1917' | '7. Nov. 1917';  long: '1700' | 'November 1917' | '7. November 1917' */
function formatHDate(
    d: HDate,
    style: DateStyle = 'short',
    locale = 'de'
): string {
    return plainSpaces(dtf(locale, optionsFor(d, style)).format(startOf(d)))
}

/** A range or point for a card or a tooltip:
 *  point → formatHDate(start)
 *  span with end → '1700–1721' (en dash, no spaces); short style across years → years only ('1914–1918'); same year, day precision → '16.–28. Okt. 1962' (short) / '16.–28. Oktober 1962' (long);
 *              same year different months, day precision → '28. Juli – 11. Nov. 1918' (spaced en dash); otherwise 'start – end' with full dates
 *  ongoing → 'seit 24. Feb. 2022' / 'seit 2022'
 */
export function formatEntryDate(
    e: Entry,
    style: DateStyle = 'short',
    locale = 'de'
): string {
    const start = formatHDate(e.start, style, locale)
    if (e.end === undefined) return start
    if (e.end === 'ongoing') {
        const since = SINCE[new Intl.Locale(locale).language] ?? SINCE.en
        return `${since} ${start}`
    }
    const end = formatHDate(e.end, style, locale)
    if (start === end) return start
    const ps = precisionOf(e.start)
    const pe = precisionOf(e.end)
    if (ps === 'year' && pe === 'year') return `${start}${EN_DASH}${end}`
    // Cards are narrow: a short span across years shows years only ('1914–1918'); the long style keeps the full dates.
    if (style === 'short' && e.start.year !== e.end.year)
        return `${e.start.year}${EN_DASH}${e.end.year}`
    if (ps === 'day' && pe === 'day' && e.start.year === e.end.year) {
        // Intl compresses the shared parts ('16.–28. Okt. 1962').
        return plainSpaces(
            dtf(locale, optionsFor(e.start, style)).formatRange(
                startOf(e.start),
                startOf(e.end)
            )
        )
    }
    return `${start} ${EN_DASH} ${end}`
}

/** Accessible name of an entry's card or bar: 'Oktoberrevolution, 7. Nov. 1917, Beitrag'. */
export function entryLabel(entry: Entry): string {
    const label = `${entry.title}, ${formatEntryDate(entry, 'short')}`
    return entry.post ? `${label}, Beitrag` : label
}

/** Meta line of an entry's hover note: '1700 – 10. September 1721 · Krieg · Russland/Sowjetunion'. */
export function formatEntryMeta(entry: Entry): string {
    return [
        formatEntryDate(entry, 'long'),
        CATEGORY_LABEL[entry.category],
        REGION_LABEL[entry.region],
    ].join(' · ')
}

/** Years a chronological group covers, from its first to its last entry's start: '1917–1922', or '1917' once. Empty for no entries. */
function formatGroupYears(entries: readonly Entry[]): string {
    const first = entries[0]
    const last = entries[entries.length - 1]
    if (!first || !last) return ''
    const from = first.start.year
    const to = last.start.year
    return from === to ? String(from) : `${from}${EN_DASH}${to}`
}

/** Meta line of a group's hover note: '6 Einträge · 1917–1922'. */
export function formatGroupMeta(entries: readonly Entry[]): string {
    const count = entries.length
    const noun = count === 1 ? 'Eintrag' : 'Einträge'
    return `${count} ${noun} · ${formatGroupYears(entries)}`
}

/** Accessible name of a group: 'Gruppe mit 6 Einträgen, 1917–1922'; 'Gruppe' for no entries. */
export function formatGroupName(entries: readonly Entry[]): string {
    const count = entries.length
    if (count === 0) return 'Gruppe'
    const noun = count === 1 ? 'Eintrag' : 'Einträgen'
    return `Gruppe mit ${count} ${noun}, ${formatGroupYears(entries)}`
}

/** Position of a stack's window: zero-based `index` of `count` → '1 von 6'. */
export function formatPosition(index: number, count: number): string {
    return `${index + 1} von ${count}`
}

/** Year label for the axis, e.g. '1917'. */
export function formatYear(t: number, locale = 'de'): string {
    return plainSpaces(dtf(locale, { year: 'numeric' }).format(t))
}

/** Month label for the axis: short 'Nov.' or with year 'Nov. 1917'. */
export function formatMonth(
    t: number,
    withYear: boolean,
    locale = 'de'
): string {
    if (withYear)
        return plainSpaces(
            dtf(locale, { year: 'numeric', month: 'short' }).format(t)
        )
    // The stand-alone short month lacks the abbreviation dot in de ('Nov'); take the in-date form.
    const parts = dtf(locale, { day: 'numeric', month: 'short' }).formatToParts(
        t
    )
    return parts.find((p) => p.type === 'month')?.value ?? ''
}

/** Day label for the axis: '7. Nov.' */
export function formatDay(t: number, locale = 'de'): string {
    return plainSpaces(
        dtf(locale, { day: 'numeric', month: 'short' }).format(t)
    )
}

export const PRIVATE_UNDER_TESTS = { formatHDate, formatGroupYears }
