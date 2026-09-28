/** A historical date with year, month or day precision. Gregorian calendar throughout. */
export interface HDate {
    year: number
    /** 1–12 */
    month?: number
    /** 1–31; requires month */
    day?: number
}

export type Precision = 'year' | 'month' | 'day'
export type Region = 'russia' | 'west' | 'both'
export type Category = 'war' | 'revolution' | 'power' | 'event'
export type Importance = 1 | 2 | 3

export interface Post {
    /** Plain paragraphs separated by blank lines (prototype only; rich text comes with the CMS). */
    body: string
}

export interface Entry {
    /** URL slug, unique. */
    id: string
    title: string
    summary: string
    start: HDate
    /** Absent: a point in time. 'ongoing': runs until today. */
    end?: HDate | 'ongoing'
    region: Region
    category: Category
    importance: Importance
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

export const REGION_LABEL: Record<Region, string> = {
    russia: 'Russland/Sowjetunion',
    west: 'Westen',
    both: 'Beide',
}

export const CATEGORY_LABEL: Record<Category, string> = {
    war: 'Krieg',
    revolution: 'Revolution',
    power: 'Machtwechsel',
    event: 'Ereignis',
}
