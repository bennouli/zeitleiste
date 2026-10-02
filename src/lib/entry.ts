import { de } from '@/i18n/de'
import type { PostBody } from './richText'

/** A historical date with year, month or day precision. Gregorian calendar throughout. */
export type HDate = {
    year: number
    /** 1–12 */
    month?: number
    /** 1–31; requires month */
    day?: number
}

export type Precision = 'year' | 'month' | 'day'

export const ENTRY_TYPES = ['war', 'revolution', 'power', 'event'] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

/** A work a post draws on, linked by its http or https address. */
export type Source = {
    title: string
    url: string
}

export type Post = {
    body: PostBody
    /** In the editor's order; absent where the post is not loaded. */
    sources?: readonly Source[]
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

/** Days in a month of the proleptic Gregorian calendar; `month` is 1–12. */
export function daysInMonth(year: number, month: number): number {
    if (month === 2) return isLeapYear(year) ? 29 : 28
    return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = de.entryType
