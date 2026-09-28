import { describe, expect, it } from 'vitest'
import { isSpan, precisionOf, type Entry } from './entry'

const base: Entry = {
    id: 'test',
    title: 'Test',
    summary: 'Test',
    start: { year: 1917 },
    region: 'russia',
    category: 'revolution',
    importance: 1,
}

describe('precisionOf', () => {
    it('returns year when only the year is set', () => {
        expect(precisionOf({ year: 1917 })).toBe('year')
    })
    it('returns month when year and month are set', () => {
        expect(precisionOf({ year: 1917, month: 11 })).toBe('month')
    })
    it('returns day when year, month and day are set', () => {
        expect(precisionOf({ year: 1917, month: 11, day: 7 })).toBe('day')
    })
})

describe('isSpan', () => {
    it('is false for a point in time', () => {
        expect(isSpan(base)).toBe(false)
    })
    it('is true when an end date is set', () => {
        expect(isSpan({ ...base, end: { year: 1922 } })).toBe(true)
    })
    it('is true for an ongoing entry', () => {
        expect(isSpan({ ...base, end: 'ongoing' })).toBe(true)
    })
})
