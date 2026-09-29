/** A historical date with year, month or day precision. Gregorian calendar throughout. */
export type HDate = {
    year: number
    /** 1–12 */
    month?: number
    /** 1–31; requires month */
    day?: number
}

export const PRECISIONS = ['year', 'month', 'day'] as const
export type Precision = (typeof PRECISIONS)[number]

export const ENTRY_TYPES = ['war', 'revolution', 'power', 'event'] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

export type Post = {
    /** Plain paragraphs separated by blank lines (prototype only; rich text comes with the CMS). */
    body: string
}

export type Entry = {
    /** URL slug, unique. */
    id: string
    title: string
    summary: string
    start: HDate
    /** Absent: a point in time. 'ongoing': runs until today. */
    end?: HDate | 'ongoing'
    type: EntryType
    /** Tag names, in the order the editor gave them. */
    tags: readonly string[]
    /** Slug of the subject the entry belongs to. Not rendered yet. */
    subject?: string
    /** Id of the larger entry this one is part of. Not rendered yet. */
    partOf?: string
    post?: Post
}

/** The finest unit a date is specified to. */
export function precisionOf(d: HDate): Precision {
    if (d.month === undefined) return 'year'
    if (d.day === undefined) return 'month'
    return 'day'
}

/** True if the entry covers a time range (has an end or is ongoing). */
export function isSpan(e: Entry): boolean {
    return e.end !== undefined
}

/** True if `end` lies before `start`, compared only at the precision both share. */
export function endsBeforeStart(start: HDate, end: HDate): boolean {
    if (end.year !== start.year) return end.year < start.year
    if (end.month === undefined || start.month === undefined) return false
    if (end.month !== start.month) return end.month < start.month
    if (end.day === undefined || start.day === undefined) return false
    return end.day < start.day
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
    war: 'Krieg',
    revolution: 'Revolution',
    power: 'Machtwechsel',
    event: 'Ereignis',
}
