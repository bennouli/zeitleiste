import { describe, expect, it } from 'vitest'
import {
    datePartsOf,
    datePartsOnSave,
    dayProblem,
    endAtOf,
    endBeforeStartProblem,
    endYearProblem,
    ongoingProblem,
    partOfProblem,
    startAtOf,
    wholeNumberProblem,
    type EntryDateParts,
} from '../entryDates'

const hitlerStalinPakt: EntryDateParts = {
    startYear: 1939,
    startMonth: 8,
    startDay: 23,
}

describe('wholeNumberProblem', () => {
    it('accepts whole numbers and leaves empty values to required', () => {
        const year = 1917
        expect(wholeNumberProblem(year)).toBeUndefined()
        expect(wholeNumberProblem(null)).toBeUndefined()
        expect(wholeNumberProblem(undefined)).toBeUndefined()
    })

    it('rejects fractions and non-numbers', () => {
        const fraction = 1917.5
        const text = '1917'
        expect(wholeNumberProblem(fraction)).toMatch(/ganze Zahlen/)
        expect(wholeNumberProblem(text)).toMatch(/ganze Zahlen/)
    })
})

describe('dayProblem', () => {
    it('accepts a day that exists, and no day at all', () => {
        const yearOnly: EntryDateParts = { startYear: 1740 }
        const leapDay: EntryDateParts = {
            startYear: 2000,
            startMonth: 2,
            startDay: 29,
        }
        expect(dayProblem(hitlerStalinPakt, 'start')).toBeUndefined()
        expect(dayProblem(yearOnly, 'start')).toBeUndefined()
        expect(dayProblem(leapDay, 'start')).toBeUndefined()
    })

    it('rejects a day without a month', () => {
        const dayWithoutMonth: EntryDateParts = { endYear: 1945, endDay: 8 }
        expect(dayProblem(dayWithoutMonth, 'end')).toMatch(/Monat/)
    })

    it('rejects a day the month does not have', () => {
        const noLeapDay: EntryDateParts = {
            startYear: 1900,
            startMonth: 2,
            startDay: 29,
        }
        const april31: EntryDateParts = {
            endYear: 1917,
            endMonth: 4,
            endDay: 31,
        }
        expect(dayProblem(noLeapDay, 'start')).toBe(
            'Den 29.2.1900 gibt es nicht.'
        )
        expect(dayProblem(april31, 'end')).toBe('Den 31.4.1917 gibt es nicht.')
    })

    it('reads only its own side', () => {
        const brokenEnd: EntryDateParts = {
            ...hitlerStalinPakt,
            endYear: 1941,
            endDay: 22,
        }
        expect(dayProblem(brokenEnd, 'start')).toBeUndefined()
        expect(dayProblem(brokenEnd, 'end')).toMatch(/Monat/)
    })
})

describe('endYearProblem', () => {
    it('requires an end year when an end month or day is set', () => {
        const monthOnly: EntryDateParts = { startYear: 1914, endMonth: 11 }
        const dayOnly: EntryDateParts = { startYear: 1914, endDay: 11 }
        expect(endYearProblem(monthOnly)).toMatch(/Jahr/)
        expect(endYearProblem(dayOnly)).toMatch(/Jahr/)
    })

    it('accepts no end, and an end with a year', () => {
        const noEnd: EntryDateParts = { startYear: 1914 }
        const ended: EntryDateParts = { startYear: 1914, endYear: 1918 }
        expect(endYearProblem(noEnd)).toBeUndefined()
        expect(endYearProblem(ended)).toBeUndefined()
    })
})

describe('ongoingProblem', () => {
    it('rejects "ongoing" together with any end part', () => {
        const withYear: EntryDateParts = {
            startYear: 2022,
            endYear: 2023,
            ongoing: true,
        }
        const withMonth: EntryDateParts = {
            startYear: 2022,
            endMonth: 3,
            ongoing: true,
        }
        expect(ongoingProblem(withYear)).toMatch(/andauern/)
        expect(ongoingProblem(withMonth)).toMatch(/andauern/)
    })

    it('accepts "ongoing" alone, and an end without it', () => {
        const ongoing: EntryDateParts = { startYear: 2022, ongoing: true }
        const ended: EntryDateParts = {
            startYear: 2022,
            endYear: 2023,
            ongoing: false,
        }
        expect(ongoingProblem(ongoing)).toBeUndefined()
        expect(ongoingProblem(ended)).toBeUndefined()
    })
})

describe('endBeforeStartProblem', () => {
    const russlandfeldzug: EntryDateParts = {
        startYear: 1812,
        startMonth: 6,
        startDay: 24,
    }

    it('compares at the coarser precision, so a year end may lie in the start year', () => {
        const endsIn1812: EntryDateParts = { ...russlandfeldzug, endYear: 1812 }
        const endsInJune: EntryDateParts = {
            ...russlandfeldzug,
            endYear: 1812,
            endMonth: 6,
        }
        expect(endBeforeStartProblem(endsIn1812)).toBeUndefined()
        expect(endBeforeStartProblem(endsInJune)).toBeUndefined()
    })

    it('rejects an end before the start', () => {
        const dayEarlier: EntryDateParts = {
            ...russlandfeldzug,
            endYear: 1812,
            endMonth: 6,
            endDay: 23,
        }
        const yearEarlier: EntryDateParts = {
            ...russlandfeldzug,
            endYear: 1811,
        }
        expect(endBeforeStartProblem(dayEarlier)).toMatch(/vor dem Beginn/)
        expect(endBeforeStartProblem(yearEarlier)).toMatch(/vor dem Beginn/)
    })

    it('leaves incomplete or malformed dates to the other checks', () => {
        const noStart: EntryDateParts = { endYear: 1700 }
        const fractionalYear: EntryDateParts = {
            startYear: 1812.5,
            endYear: 1700,
        }
        expect(endBeforeStartProblem(noStart)).toBeUndefined()
        expect(endBeforeStartProblem(fractionalYear)).toBeUndefined()
    })
})

describe('startAtOf / endAtOf', () => {
    it('derives the start from the first instant of the given unit, in UTC', () => {
        const yearOnly: EntryDateParts = { startYear: 1740 }
        const monthOnly: EntryDateParts = { startYear: 2014, startMonth: 3 }
        expect(startAtOf(yearOnly)).toBe('1740-01-01T00:00:00.000Z')
        expect(startAtOf(monthOnly)).toBe('2014-03-01T00:00:00.000Z')
        expect(startAtOf(hitlerStalinPakt)).toBe('1939-08-23T00:00:00.000Z')
    })

    it('derives the end from the first instant of its unit, missing month or day as 1', () => {
        const yearEnd: EntryDateParts = { startYear: 1914, endYear: 1918 }
        const dayEnd: EntryDateParts = {
            startYear: 1939,
            endYear: 1945,
            endMonth: 5,
            endDay: 8,
        }
        expect(endAtOf(yearEnd)).toBe('1918-01-01T00:00:00.000Z')
        expect(endAtOf(dayEnd)).toBe('1945-05-08T00:00:00.000Z')
    })

    it('keeps years below 100 as given', () => {
        const earlyYear: EntryDateParts = { startYear: 33 }
        expect(startAtOf(earlyYear)).toBe('0033-01-01T00:00:00.000Z')
    })

    it('has no timestamp for a missing start, a point in time, or an ongoing span', () => {
        const draft: EntryDateParts = { startMonth: 3 }
        const ongoing: EntryDateParts = { startYear: 2022, ongoing: true }
        expect(startAtOf(draft)).toBeUndefined()
        expect(endAtOf(hitlerStalinPakt)).toBeUndefined()
        expect(endAtOf(ongoing)).toBeUndefined()
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

describe('datePartsOf', () => {
    it('reads no parts from sibling data that is not an object', () => {
        const text = '1917'
        expect(datePartsOf(null)).toEqual({})
        expect(datePartsOf(text)).toEqual({})
    })
})

describe('datePartsOnSave', () => {
    const stored: EntryDateParts = {
        startYear: 1939,
        startMonth: 9,
        startDay: 1,
        endYear: 1945,
    }

    it('keeps the stored parts when an update sends none, so the timestamps survive', () => {
        const titleOnly = { title: 'Zweiter Weltkrieg' }
        const parts = datePartsOnSave(stored, titleOnly)
        expect(startAtOf(parts)).toBe('1939-09-01T00:00:00.000Z')
        expect(endAtOf(parts)).toBe('1945-01-01T00:00:00.000Z')
    })

    it('lets sent parts override, and a part sent as null clear, the stored one', () => {
        const moved = { startDay: 3, endYear: null }
        const parts = datePartsOnSave(stored, moved)
        expect(startAtOf(parts)).toBe('1939-09-03T00:00:00.000Z')
        expect(endAtOf(parts)).toBeUndefined()
    })

    it('reads only the request on create, when nothing is stored', () => {
        const created = { startYear: 1740 }
        expect(datePartsOnSave(undefined, created)).toEqual(created)
    })
})
