import {
    endsBeforeStart,
    PRECISIONS,
    type HDate,
    type Precision,
} from '@/lib/entry'

/**
 * The date fields of an entry as a validator receives them: raw input from
 * the admin form or an API caller, checked here before use.
 */
export type EntryDates = {
    at?: unknown
    atPrecision?: unknown
    endedAt?: unknown
    endedAtPrecision?: unknown
    ongoing?: unknown
}

/** A validator's `siblingData` as entry dates; anything but an object has none. */
export function entryDatesOf(siblingData: unknown): EntryDates {
    return typeof siblingData === 'object' && siblingData !== null
        ? siblingData
        : {}
}

const FIRST_OF: Record<Exclude<Precision, 'day'>, string> = {
    year: 'Bei der Genauigkeit „Jahr“ muss das Datum der 1. Januar sein.',
    month: 'Bei der Genauigkeit „Monat“ muss das Datum der Erste des Monats sein.',
}

/**
 * A year precision needs 1 January, a month precision the first of a month:
 * a finer date would be dropped silently when the timeline renders it.
 * A missing or malformed date or precision is left to the field's own check.
 */
export function precisionProblem(
    date: unknown,
    precision: unknown
): string | undefined {
    const day = calendarDate(date)
    const unit = precisionFrom(precision)
    if (!day || !unit || unit === 'day') return undefined
    const coarserThanDate =
        day.day !== 1 || (unit === 'year' && day.month !== 1)
    return coarserThanDate ? FIRST_OF[unit] : undefined
}

/** Problems with the end date: set together with "ongoing", or before the start. */
export function endProblem(dates: EntryDates): string | undefined {
    if (!calendarDate(dates.endedAt)) return undefined
    if (dates.ongoing === true)
        return 'Ein Eintrag mit Enddatum kann nicht zugleich andauern.'
    const start = toHDate(dates.at, dates.atPrecision)
    const end = toHDate(dates.endedAt, dates.endedAtPrecision)
    return start && end && endsBeforeStart(start, end)
        ? 'Das Enddatum darf nicht vor dem Beginn liegen.'
        : undefined
}

/** An end precision is required exactly when an end date is set. */
export function endPrecisionProblem(dates: EntryDates): string | undefined {
    return calendarDate(dates.endedAt) && !precisionFrom(dates.endedAtPrecision)
        ? 'Zum Enddatum gehört eine Genauigkeit.'
        : undefined
}

/** Year, month and day of a date value, read in UTC: the admin stores a day at noon, so UTC keeps the calendar day. */
function calendarDate(value: unknown): Required<HDate> | undefined {
    if (!(typeof value === 'string' || value instanceof Date)) return undefined
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return undefined
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
    }
}

function precisionFrom(value: unknown): Precision | undefined {
    return PRECISIONS.find((p) => p === value)
}

/** The date cut to its precision; day precision when none is given yet. */
function toHDate(date: unknown, precision: unknown): HDate | undefined {
    const day = calendarDate(date)
    if (!day) return undefined
    const unit = precisionFrom(precision) ?? 'day'
    if (unit === 'year') return { year: day.year }
    if (unit === 'month') return { year: day.year, month: day.month }
    return day
}

/** An entry cannot be part of itself; `value` is the id or the populated document. */
export function partOfProblem(value: unknown, id: unknown): string | undefined {
    const relatedId =
        typeof value === 'object' && value !== null && 'id' in value
            ? value.id
            : value
    return id !== undefined && relatedId === id
        ? 'Ein Eintrag kann nicht Teil von sich selbst sein.'
        : undefined
}
