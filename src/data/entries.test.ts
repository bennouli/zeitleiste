import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compareHDate } from '../lib/time'
import { validateEntry } from '../lib/validate-entry'
import { entries } from './entries'

const GREGORIAN_NOTE =
    '// All dates are Gregorian, including Russian dates before 1918 (Julian dates converted).'

describe('sample entries', () => {
    it('has between 25 and 30 entries', () => {
        expect(entries.length).toBeGreaterThanOrEqual(25)
        expect(entries.length).toBeLessThanOrEqual(30)
    })

    it('every entry is valid', () => {
        const failures = entries
            .map((e) => ({ id: e.id, problems: validateEntry(e) }))
            .filter((r) => r.problems.length > 0)
        expect(failures).toEqual([])
    })

    it('ids are unique', () => {
        const ids = entries.map((e) => e.id)
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
        expect(duplicates).toEqual([])
    })

    it('starts with the Great Northern War in 1700', () => {
        const first = entries[0]!
        expect(first.id).toBe('grosser-nordischer-krieg')
        expect(first.start.year).toBe(1700)
        expect(first.end).toMatchObject({ year: 1721 })
        expect(first.region).toBe('russia')
        expect(first.category).toBe('war')
        expect(first.importance).toBe(3)
    })

    it('the earliest entry starts in 1700', () => {
        expect(Math.min(...entries.map((e) => e.start.year))).toBe(1700)
    })

    it('is sorted chronologically by start', () => {
        const outOfOrder = entries
            .slice(1)
            .filter((e, i) => compareHDate(entries[i]!.start, e.start) > 0)
            .map((e) => e.id)
        expect(outOfOrder).toEqual([])
    })

    it('has at least one ongoing entry', () => {
        expect(entries.some((e) => e.end === 'ongoing')).toBe(true)
    })

    it('has at least five entries starting between 1914 and 1922', () => {
        const crowded = entries.filter(
            (e) => e.start.year >= 1914 && e.start.year <= 1922
        )
        expect(crowded.length).toBeGreaterThanOrEqual(5)
    })

    it('has exactly three entries with a post of 3–5 paragraphs', () => {
        const withPost = entries.filter((e) => e.post !== undefined)
        expect(withPost).toHaveLength(3)
        for (const e of withPost) {
            const paragraphs = e
                .post!.body.split(/\n\s*\n/)
                .filter((p) => p.trim().length > 0)
            expect(paragraphs.length, e.id).toBeGreaterThanOrEqual(3)
            expect(paragraphs.length, e.id).toBeLessThanOrEqual(5)
        }
    })

    it('states at the top of the file that all dates are Gregorian', () => {
        const file = join(dirname(fileURLToPath(import.meta.url)), 'entries.ts')
        const head = readFileSync(file, 'utf8')
            .split('\n')
            .slice(0, 5)
            .join('\n')
        expect(head).toContain(GREGORIAN_NOTE)
    })
})

describe('validateEntry', () => {
    const valid = {
        id: 'beispiel',
        title: 'Beispiel',
        summary: 'Ein Beispiel.',
        start: { year: 1900, month: 2, day: 28 },
        region: 'west',
        category: 'event',
        importance: 1,
    }

    it('accepts a valid entry', () => {
        expect(validateEntry(valid)).toEqual([])
        expect(validateEntry({ ...valid, end: 'ongoing' })).toEqual([])
        expect(
            validateEntry({
                ...valid,
                start: { year: 1812, month: 6, day: 24 },
                end: { year: 1812 },
            })
        ).toEqual([])
        expect(
            validateEntry({
                ...valid,
                start: { year: 2000, month: 2, day: 29 },
            })
        ).toEqual([])
    })

    it('rejects invalid entries', () => {
        expect(validateEntry(null)).not.toEqual([])
        expect(validateEntry({ ...valid, id: 'Groß' })).not.toEqual([])
        expect(validateEntry({ ...valid, id: 'a--b' })).not.toEqual([])
        expect(validateEntry({ ...valid, title: ' ' })).not.toEqual([])
        expect(
            validateEntry({
                ...valid,
                start: { year: 1900, month: 2, day: 29 },
            })
        ).not.toEqual([])
        expect(
            validateEntry({
                ...valid,
                start: { year: 1962, month: 2, day: 30 },
            })
        ).not.toEqual([])
        expect(
            validateEntry({ ...valid, start: { year: 1962, day: 3 } })
        ).not.toEqual([])
        expect(
            validateEntry({ ...valid, start: { year: 1962, month: 13 } })
        ).not.toEqual([])
        expect(
            validateEntry({ ...valid, start: { year: 1962.5 } })
        ).not.toEqual([])
        expect(validateEntry({ ...valid, end: { year: 1899 } })).not.toEqual([])
        expect(
            validateEntry({ ...valid, end: { year: 1900, month: 2, day: 1 } })
        ).not.toEqual([])
        expect(validateEntry({ ...valid, region: 'asia' })).not.toEqual([])
        expect(validateEntry({ ...valid, category: 'culture' })).not.toEqual([])
        expect(validateEntry({ ...valid, importance: 4 })).not.toEqual([])
        expect(validateEntry({ ...valid, post: { body: '' } })).not.toEqual([])
    })
})
