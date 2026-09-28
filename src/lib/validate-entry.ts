import type { HDate } from '@/lib/entry'

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const REGIONS = ['russia', 'west', 'both'] as const
const CATEGORIES = ['war', 'revolution', 'power', 'event'] as const
const IMPORTANCES = [1, 2, 3] as const

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
    if (month === 2) return isLeapYear(year) ? 29 : 28
    return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Problems with a single HDate (proleptic Gregorian calendar); empty if valid. */
export function validateHDate(d: unknown, label: string): string[] {
    if (!isRecord(d)) return [`${label}: must be an object`]
    const problems: string[] = []
    const { year, month, day } = d
    if (!Number.isInteger(year))
        problems.push(`${label}.year: must be an integer`)
    if (
        month !== undefined &&
        (!Number.isInteger(month) ||
            (month as number) < 1 ||
            (month as number) > 12)
    ) {
        problems.push(`${label}.month: must be an integer 1–12`)
    }
    if (day !== undefined) {
        if (
            !Number.isInteger(day) ||
            (day as number) < 1 ||
            (day as number) > 31
        ) {
            problems.push(`${label}.day: must be an integer 1–31`)
        } else if (month === undefined) {
            problems.push(`${label}.day: requires month`)
        }
    }
    if (
        problems.length === 0 &&
        month !== undefined &&
        day !== undefined &&
        (day as number) > daysInMonth(year as number, month as number)
    ) {
        problems.push(`${label}: ${year}-${month}-${day} does not exist`)
    }
    return problems
}

/** True if `end` lies before `start`, compared only at the precision both share. */
function endsBeforeStart(start: HDate, end: HDate): boolean {
    if (end.year !== start.year) return end.year < start.year
    if (end.month === undefined || start.month === undefined) return false
    if (end.month !== start.month) return end.month < start.month
    if (end.day === undefined || start.day === undefined) return false
    return end.day < start.day
}

function nonEmptyString(v: unknown): boolean {
    return typeof v === 'string' && v.trim().length > 0
}

/** Returns a list of problems with an entry; empty if the entry is valid. */
export function validateEntry(e: unknown): string[] {
    if (!isRecord(e)) return ['entry: must be an object']
    const problems: string[] = []

    for (const key of ['id', 'title', 'summary'] as const) {
        if (!nonEmptyString(e[key]))
            problems.push(`${key}: must be a non-empty string`)
    }
    if (typeof e.id === 'string' && !ID_PATTERN.test(e.id)) {
        problems.push(
            'id: must be lowercase a-z0-9 separated by single hyphens'
        )
    }

    const startProblems = validateHDate(e.start, 'start')
    problems.push(...startProblems)

    if (e.end !== undefined && e.end !== 'ongoing') {
        const endProblems = validateHDate(e.end, 'end')
        problems.push(...endProblems)
        if (
            startProblems.length === 0 &&
            endProblems.length === 0 &&
            endsBeforeStart(e.start as HDate, e.end as HDate)
        ) {
            problems.push('end: must not be before start')
        }
    }

    if (!(REGIONS as readonly unknown[]).includes(e.region)) {
        problems.push(`region: must be one of ${REGIONS.join(', ')}`)
    }
    if (!(CATEGORIES as readonly unknown[]).includes(e.category)) {
        problems.push(`category: must be one of ${CATEGORIES.join(', ')}`)
    }
    if (!(IMPORTANCES as readonly unknown[]).includes(e.importance)) {
        problems.push(`importance: must be one of ${IMPORTANCES.join(', ')}`)
    }

    if (e.post !== undefined) {
        if (!isRecord(e.post) || !nonEmptyString(e.post.body)) {
            problems.push('post.body: must be a non-empty string')
        }
    }

    return problems
}
