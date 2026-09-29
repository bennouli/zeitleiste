import { daysInMonth, endsBeforeStart, type HDate } from '@/lib/entry'
import { endOf, startOf } from '@/lib/time'

/**
 * The date parts of an entry as a validator or hook receives them: raw input
 * from the admin form or an API caller, checked here before use.
 */
export type EntryDateParts = {
    startYear?: unknown
    startMonth?: unknown
    startDay?: unknown
    endYear?: unknown
    endMonth?: unknown
    endDay?: unknown
    ongoing?: unknown
}

export type Side = 'start' | 'end'

/** A validator's or hook's `siblingData` as date parts; anything but an object has none. */
export function datePartsOf(siblingData: unknown): EntryDateParts {
    return typeof siblingData === 'object' && siblingData !== null
        ? siblingData
        : {}
}

/** Year, month or day must be a whole number; an empty value is left to `required`. */
export function wholeNumberProblem(value: unknown): string | undefined {
    return isEmpty(value) || Number.isInteger(value)
        ? undefined
        : 'Nur ganze Zahlen.'
}

/** A day needs a month, and must exist in that month and year. */
export function dayProblem(
    parts: EntryDateParts,
    side: Side
): string | undefined {
    const { year, month, day } = partsOf(parts, side)
    if (isEmpty(day)) return undefined
    if (isEmpty(month)) return 'Ein Tag braucht einen Monat.'
    if (!isWhole(year) || !isMonth(month) || !isWhole(day)) return undefined
    return day > daysInMonth(year, month)
        ? `Den ${day}.${month}.${year} gibt es nicht.`
        : undefined
}

/** An end month or day needs an end year. */
export function endYearProblem(parts: EntryDateParts): string | undefined {
    const { year, month, day } = partsOf(parts, 'end')
    return isEmpty(year) && (!isEmpty(month) || !isEmpty(day))
        ? 'Zu Monat oder Tag des Endes gehört ein Jahr.'
        : undefined
}

/** "Ongoing" excludes every end part. */
export function ongoingProblem(parts: EntryDateParts): string | undefined {
    const { year, month, day } = partsOf(parts, 'end')
    const hasEnd = [year, month, day].some((part) => !isEmpty(part))
    return parts.ongoing === true && hasEnd
        ? 'Ein Eintrag mit Ende kann nicht zugleich andauern.'
        : undefined
}

/** The end may not lie before the start, compared at the coarser of the two precisions. */
export function endBeforeStartProblem(
    parts: EntryDateParts
): string | undefined {
    const start = hDateOf(parts, 'start')
    const end = hDateOf(parts, 'end')
    return start && end && endsBeforeStart(start, end)
        ? 'Das Ende darf nicht vor dem Beginn liegen.'
        : undefined
}

/** Start of the entry's first unit as an ISO timestamp, for sorting; undefined while the start is incomplete. */
export function startAtOf(parts: EntryDateParts): string | undefined {
    const start = hDateOf(parts, 'start')
    return start && new Date(startOf(start)).toISOString()
}

/**
 * Exclusive end of the entry's last unit as an ISO timestamp, the same instant
 * the timeline draws a span to; undefined for a point in time or an ongoing entry.
 */
export function endAtOf(parts: EntryDateParts): string | undefined {
    const end = hDateOf(parts, 'end')
    return end && parts.ongoing !== true
        ? new Date(endOf(end)).toISOString()
        : undefined
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

function partsOf(parts: EntryDateParts, side: Side) {
    return side === 'start'
        ? {
              year: parts.startYear,
              month: parts.startMonth,
              day: parts.startDay,
          }
        : { year: parts.endYear, month: parts.endMonth, day: parts.endDay }
}

/** The side's date as far as its parts are well-formed: a whole year, then a month 1–12, then a day. */
function hDateOf(parts: EntryDateParts, side: Side): HDate | undefined {
    const { year, month, day } = partsOf(parts, side)
    if (!isWhole(year)) return undefined
    if (!isMonth(month)) return { year }
    if (!isWhole(day)) return { year, month }
    return { year, month, day }
}

function isEmpty(value: unknown): boolean {
    return value === undefined || value === null
}

function isWhole(value: unknown): value is number {
    return Number.isInteger(value)
}

function isMonth(value: unknown): value is number {
    return isWhole(value) && value >= 1 && value <= 12
}
