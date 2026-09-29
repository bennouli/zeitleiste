import type { Locale } from '@/i18n/locales'
import { INTL_LOCALE, messages } from '@/i18n/messages'
import { precisionOf, type Entry, type HDate } from './entry'
import { startOf } from './time'

export type DateStyle = 'short' | 'long'

const EN_DASH = '–'

const cache = new Map<string, Intl.DateTimeFormat>()

/** ICU emits thin/narrow/no-break spaces depending on version and locale; normalize them for stable output across server and browser. */
function plainSpaces(s: string): string {
    return s.replace(/[\u2009\u202f\u00a0]/g, ' ')
}

function dtf(
    locale: Locale,
    options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
    const key = locale + JSON.stringify(options)
    let f = cache.get(key)
    if (!f) {
        f = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
            timeZone: 'UTC',
            ...options,
        })
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
 *  de short: '1700' | 'Nov. 1917' | '7. Nov. 1917';  long: '1700' | 'November 1917' | '7. November 1917'
 *  en short: '1700' | 'Nov 1917' | '7 Nov 1917';  long: '1700' | 'November 1917' | '7 November 1917' */
function formatHDate(d: HDate, style: DateStyle, locale: Locale): string {
    return plainSpaces(dtf(locale, optionsFor(d, style)).format(startOf(d)))
}

/** A range or point for a card or a tooltip:
 *  point → formatHDate(start)
 *  span with end → '1700–1721' (en dash, no spaces); short style across years → years only ('1914–1918'); same year, day precision → Intl's range,
 *              de '16.–28. Okt. 1962', en '16 – 28 Oct 1962'; same year different months, day precision → '28. Juli – 11. Nov. 1918' (spaced en dash);
 *              otherwise 'start – end' with full dates
 *  ongoing → 'seit 24. Feb. 2022' / 'since 24 Feb 2022'
 */
export function formatEntryDate(
    e: Entry,
    style: DateStyle,
    locale: Locale
): string {
    const start = formatHDate(e.start, style, locale)
    if (e.end === undefined) return start
    if (e.end === 'ongoing') return `${messages[locale].since} ${start}`
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

/** Accessible name of an entry's card or bar: title, short date and, with a post, the post label. */
export function entryLabel(entry: Entry, locale: Locale): string {
    const label = `${entry.title}, ${formatEntryDate(entry, 'short', locale)}`
    return entry.post ? `${label}, ${messages[locale].post.label}` : label
}

/** Parts of an entry's meta line: long date, type, then its tags in order. */
export function entryMetaParts(entry: Entry, locale: Locale): string[] {
    return [
        formatEntryDate(entry, 'long', locale),
        messages[locale].entryType[entry.type],
        ...entry.tags,
    ]
}

/** Meta line of an entry's hover note: its meta parts joined by ' · '. */
export function formatEntryMeta(entry: Entry, locale: Locale): string {
    return entryMetaParts(entry, locale).join(' · ')
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

/** Meta line of a group's hover note: the entry count, then the years. */
export function formatGroupMeta(
    entries: readonly Entry[],
    locale: Locale
): string {
    return messages[locale].groupMeta(entries.length, formatGroupYears(entries))
}

/** Accessible name of a group: its entry count and years; the bare group noun for no entries. */
export function formatGroupName(
    entries: readonly Entry[],
    locale: Locale
): string {
    const t = messages[locale]
    if (entries.length === 0) return t.group
    return t.groupName(entries.length, formatGroupYears(entries))
}

/** Accessible name of a group's axis marker, distinct from the stack's: the zoom action, then the group's name. */
export function formatGroupZoomName(
    entries: readonly Entry[],
    locale: Locale
): string {
    return `${messages[locale].timeline.zoomIn}: ${formatGroupName(entries, locale)}`
}

/** Position of a stack's window: zero-based `index` of `count`, counted from one. */
export function formatPosition(
    index: number,
    count: number,
    locale: Locale
): string {
    return messages[locale].position(index + 1, count)
}

/** Year label for the axis, e.g. '1917'. */
export function formatYear(t: number, locale: Locale): string {
    return plainSpaces(dtf(locale, { year: 'numeric' }).format(t))
}

/** Month label for the axis: short 'Nov.' or with year 'Nov. 1917' (en 'Nov', 'Nov 1917'). */
export function formatMonth(
    t: number,
    withYear: boolean,
    locale: Locale
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

/** Day label for the axis: '7. Nov.' (en '7 Nov'). */
export function formatDay(t: number, locale: Locale): string {
    return plainSpaces(
        dtf(locale, { day: 'numeric', month: 'short' }).format(t)
    )
}

export const PRIVATE_UNDER_TESTS = { formatHDate, formatGroupYears }
