import type { HDate } from '@/lib/entry'

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const STRING_FIELDS = ['id', 'title', 'summary'] as const
const REGIONS = ['russia', 'west', 'both'] as const
const CATEGORIES = ['war', 'revolution', 'power', 'event'] as const
const IMPORTANCES = [1, 2, 3] as const

/** Problems with a single HDate (proleptic Gregorian calendar); empty if valid. */
export function validateHDate(d: unknown, label: string): string[] {
    if (!isRecord(d)) return [`${label}: must be an object`]
    const problems: string[] = []
    const { year, month, day } = d
    if (!isInteger(year)) problems.push(`${label}.year: must be an integer`)
    if (month !== undefined && (!isInteger(month) || month < 1 || month > 12))
        problems.push(`${label}.month: must be an integer 1–12`)
    if (day !== undefined) {
        if (!isInteger(day) || day < 1 || day > 31)
            problems.push(`${label}.day: must be an integer 1–31`)
        else if (month === undefined)
            problems.push(`${label}.day: requires month`)
    }
    if (
        problems.length === 0 &&
        isInteger(year) &&
        isInteger(month) &&
        isInteger(day) &&
        day > daysInMonth(year, month)
    )
        problems.push(`${label}: ${year}-${month}-${day} does not exist`)
    return problems
}

/** Returns a list of problems with an entry; empty if the entry is valid. */
export function validateEntry(e: unknown): string[] {
    if (!isRecord(e)) return ['entry: must be an object']
    return [
        ...stringProblems(e),
        ...idProblems(e),
        ...dateProblems(e),
        ...enumProblems(e),
        ...postProblems(e),
    ]
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isInteger(v: unknown): v is number {
    return Number.isInteger(v)
}

function daysInMonth(year: number, month: number): number {
    if (month === 2) return isLeapYear(year) ? 29 : 28
    return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function stringProblems(e: Record<string, unknown>): string[] {
    return STRING_FIELDS.filter((key) => !nonEmptyString(e[key])).map(
        (key) => `${key}: must be a non-empty string`
    )
}

function nonEmptyString(v: unknown): boolean {
    return typeof v === 'string' && v.trim().length > 0
}

function idProblems(e: Record<string, unknown>): string[] {
    return typeof e.id === 'string' && !ID_PATTERN.test(e.id)
        ? ['id: must be lowercase a-z0-9 separated by single hyphens']
        : []
}

function dateProblems(e: Record<string, unknown>): string[] {
    const startProblems = validateHDate(e.start, 'start')
    if (e.end === undefined || e.end === 'ongoing') return startProblems
    const endProblems = validateHDate(e.end, 'end')
    const bothValid = startProblems.length === 0 && endProblems.length === 0
    const orderProblems =
        bothValid && endsBeforeStart(e.start as HDate, e.end as HDate)
            ? ['end: must not be before start']
            : []
    return [...startProblems, ...endProblems, ...orderProblems]
}

/** True if `end` lies before `start`, compared only at the precision both share. */
function endsBeforeStart(start: HDate, end: HDate): boolean {
    if (end.year !== start.year) return end.year < start.year
    if (end.month === undefined || start.month === undefined) return false
    if (end.month !== start.month) return end.month < start.month
    if (end.day === undefined || start.day === undefined) return false
    return end.day < start.day
}

function enumProblems(e: Record<string, unknown>): string[] {
    return [
        ...oneOf(e.region, REGIONS, 'region'),
        ...oneOf(e.category, CATEGORIES, 'category'),
        ...oneOf(e.importance, IMPORTANCES, 'importance'),
    ]
}

function oneOf(
    value: unknown,
    allowed: readonly unknown[],
    field: string
): string[] {
    return allowed.includes(value)
        ? []
        : [`${field}: must be one of ${allowed.join(', ')}`]
}

function postProblems(e: Record<string, unknown>): string[] {
    if (e.post === undefined) return []
    return isRecord(e.post) && nonEmptyString(e.post.body)
        ? []
        : ['post.body: must be a non-empty string']
}
