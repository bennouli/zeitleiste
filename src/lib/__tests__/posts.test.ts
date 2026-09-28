import { entries } from '@/data/entries'
import { describe, expect, it } from 'vitest'
import type { Entry } from '../entry'
import { findEntry, postHref, postSlugs, slugFromPathname } from '../posts'

const base = {
    summary: 's',
    start: { year: 1900 },
    region: 'russia',
    category: 'event',
    importance: 1,
} as const
const sample: Entry[] = [
    { ...base, id: 'a', title: 'A', post: { body: 'x' } },
    { ...base, id: 'b', title: 'B' },
    { ...base, id: 'c', title: 'C', post: { body: 'y' } },
]

describe('postSlugs', () => {
    it('lists only entries with a post, in order', () => {
        expect(postSlugs(sample)).toEqual(['a', 'c'])
    })

    it('covers the sample data posts', () => {
        expect(postSlugs(entries)).toContain('oktoberrevolution')
        expect(postSlugs(entries)).toHaveLength(
            entries.filter((e) => e.post).length
        )
    })
})

describe('findEntry', () => {
    it('finds an entry with a post', () => {
        expect(findEntry(sample, 'c')?.title).toBe('C')
    })

    it('ignores entries without a post and unknown slugs', () => {
        expect(findEntry(sample, 'b')).toBeUndefined()
        expect(findEntry(sample, 'zzz')).toBeUndefined()
    })
})

describe('slugFromPathname', () => {
    it.each([
        ['/post/x', 'x'],
        ['/post/x/', 'x'],
        ['/de/post/x', 'x'],
        ['/post/oktoberrevolution', 'oktoberrevolution'],
        ['/post/a%20b', 'a b'],
    ])('%s → %s', (path, slug) => {
        expect(slugFromPathname(path)).toBe(slug)
    })

    it.each([
        '/',
        '/post/',
        '/post',
        '/other',
        '/other/x',
        '/post/x/y',
        '/a/b/post/x',
        '',
        '/post/%E0',
    ])('%s → null', (path) => {
        expect(slugFromPathname(path)).toBeNull()
    })

    it('handles a missing pathname', () => {
        expect(slugFromPathname(null)).toBeNull()
    })
})

describe('postHref', () => {
    it('builds the post address and round-trips', () => {
        expect(postHref('oktoberrevolution')).toBe('/post/oktoberrevolution')
        expect(slugFromPathname(postHref('a b'))).toBe('a b')
    })
})
