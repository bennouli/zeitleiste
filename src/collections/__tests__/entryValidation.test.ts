import { describe, expect, it } from 'vitest'
import {
    endPrecisionProblem,
    endProblem,
    entryDatesOf,
    partOfProblem,
    precisionProblem,
    type EntryDates,
} from '../entryValidation'

const NEW_YEAR_1917 = '1917-01-01T12:00:00.000Z'
const FIRST_OF_MARCH_1917 = '1917-03-01T12:00:00.000Z'
const OCTOBER_REVOLUTION = '1917-11-07T12:00:00.000Z'

describe('precisionProblem', () => {
    it('accepts a date on the first of its unit', () => {
        expect(precisionProblem(NEW_YEAR_1917, 'year')).toBeUndefined()
        expect(precisionProblem(FIRST_OF_MARCH_1917, 'month')).toBeUndefined()
        expect(precisionProblem(NEW_YEAR_1917, 'month')).toBeUndefined()
    })

    it('accepts any date at day precision', () => {
        expect(precisionProblem(OCTOBER_REVOLUTION, 'day')).toBeUndefined()
        expect(precisionProblem(NEW_YEAR_1917, 'day')).toBeUndefined()
    })

    it('rejects a year precision on any day but 1 January', () => {
        expect(precisionProblem(FIRST_OF_MARCH_1917, 'year')).toMatch(/Jahr/)
        expect(precisionProblem(OCTOBER_REVOLUTION, 'year')).toMatch(/Jahr/)
    })

    it('rejects a month precision after the first of the month', () => {
        expect(precisionProblem(OCTOBER_REVOLUTION, 'month')).toMatch(/Monat/)
    })

    it('reads the calendar day in UTC', () => {
        const noonNewYear = new Date(Date.UTC(1917, 0, 1, 12))
        const lateOnNewYearsEve = '1916-12-31T23:00:00.000Z'
        expect(precisionProblem(noonNewYear, 'year')).toBeUndefined()
        expect(precisionProblem(lateOnNewYearsEve, 'year')).toMatch(/Jahr/)
    })

    it('leaves a missing date or precision to the required check', () => {
        expect(precisionProblem(undefined, 'year')).toBeUndefined()
        expect(precisionProblem(OCTOBER_REVOLUTION, null)).toBeUndefined()
    })
})

describe('endProblem', () => {
    const war: EntryDates = {
        at: '1812-06-24T12:00:00.000Z',
        atPrecision: 'day',
    }

    it('accepts no end, and an end after the start', () => {
        const ended: EntryDates = {
            ...war,
            endedAt: '1812-12-01T12:00:00.000Z',
            endedAtPrecision: 'month',
        }
        expect(endProblem(war)).toBeUndefined()
        expect(endProblem(ended)).toBeUndefined()
    })

    it('compares at the coarser precision, so a year end may lie in the start year', () => {
        const endsIn1812: EntryDates = {
            ...war,
            endedAt: '1812-01-01T12:00:00.000Z',
            endedAtPrecision: 'year',
        }
        expect(endProblem(endsIn1812)).toBeUndefined()
    })

    it('rejects an end before the start', () => {
        const endsEarly: EntryDates = {
            ...war,
            endedAt: '1812-06-23T12:00:00.000Z',
            endedAtPrecision: 'day',
        }
        const endsYearEarly: EntryDates = {
            ...war,
            endedAt: '1811-01-01T12:00:00.000Z',
            endedAtPrecision: 'year',
        }
        expect(endProblem(endsEarly)).toMatch(/vor dem Beginn/)
        expect(endProblem(endsYearEarly)).toMatch(/vor dem Beginn/)
    })

    it('rejects an end together with ongoing', () => {
        const both: EntryDates = {
            ...war,
            endedAt: '1813-01-01T12:00:00.000Z',
            endedAtPrecision: 'year',
            ongoing: true,
        }
        const ongoingOnly: EntryDates = { ...war, ongoing: true }
        expect(endProblem(both)).toMatch(/andauern/)
        expect(endProblem(ongoingOnly)).toBeUndefined()
    })
})

describe('endPrecisionProblem', () => {
    it('requires a precision exactly when an end is set', () => {
        const endWithout: EntryDates = { endedAt: NEW_YEAR_1917 }
        const endWith: EntryDates = {
            endedAt: NEW_YEAR_1917,
            endedAtPrecision: 'year',
        }
        expect(endPrecisionProblem(endWithout)).toMatch(/Genauigkeit/)
        expect(endPrecisionProblem(endWith)).toBeUndefined()
        expect(endPrecisionProblem({})).toBeUndefined()
    })
})

describe('malformed input', () => {
    it('leaves values that are not dates or precisions to the fields’ own checks', () => {
        const garbage: EntryDates = {
            at: 'kein Datum',
            atPrecision: 'decade',
            endedAt: 42,
            endedAtPrecision: 'year',
            ongoing: 'yes',
        }
        expect(precisionProblem(garbage.at, 'year')).toBeUndefined()
        expect(precisionProblem(OCTOBER_REVOLUTION, 'decade')).toBeUndefined()
        expect(endProblem(garbage)).toBeUndefined()
        expect(endPrecisionProblem(garbage)).toBeUndefined()
    })

    it('reads no dates from sibling data that is not an object', () => {
        expect(entryDatesOf(null)).toEqual({})
        expect(entryDatesOf('at')).toEqual({})
    })
})

describe('partOfProblem', () => {
    const stalingrad = 7

    it('rejects the entry itself, as id or populated document', () => {
        const itself = { id: stalingrad, title: 'Schlacht von Stalingrad' }
        expect(partOfProblem(stalingrad, stalingrad)).toMatch(/sich selbst/)
        expect(partOfProblem(itself, stalingrad)).toMatch(/sich selbst/)
    })

    it('accepts another entry, no entry, and any entry before the first save', () => {
        const zweiterWeltkrieg = 3
        expect(partOfProblem(zweiterWeltkrieg, stalingrad)).toBeUndefined()
        expect(partOfProblem(null, stalingrad)).toBeUndefined()
        expect(partOfProblem(stalingrad, undefined)).toBeUndefined()
    })
})
