import { entries } from '@/data/entries'
import { describe, expect, it } from 'vitest'
import type { Entry } from '../entry'
import {
    findEntry,
    isStartPath,
    postHref,
    postSlugs,
    slugFromPathname,
    startHref,
    switchLocalePath,
} from '../posts'
import { paragraphsToLexical } from '../richText'

const base = {
    summary: 's',
    start: { year: 1900 },
    type: 'event',
    tags: [],
} as const
const sample: Entry[] = [
    { ...base, id: 'a', title: 'A', post: { body: paragraphsToLexical('x') } },
    { ...base, id: 'b', title: 'B' },
    { ...base, id: 'c', title: 'C', post: { body: paragraphsToLexical('y') } },
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

describe('startHref', () => {
    it('is the locale prefix', () => {
        expect(startHref('de')).toBe('/de')
        expect(startHref('en')).toBe('/en')
    })
})

describe('postHref', () => {
    it('builds the post address under the locale and round-trips', () => {
        expect(postHref('oktoberrevolution', 'en')).toBe(
            '/en/post/oktoberrevolution'
        )
        expect(slugFromPathname(postHref('a b', 'de'))).toBe('a b')
    })
})

describe('isStartPath', () => {
    it.each(['/de', '/en', '/de/'])('%s is a start page', (pathname) => {
        expect(isStartPath(pathname)).toBe(true)
    })

    it.each(['/', '/xx', '/de/post/a', '/post/a', '/de/gibt-es-nicht'])(
        '%s is not',
        (pathname) => {
            expect(isStartPath(pathname)).toBe(false)
        }
    )
})

describe('switchLocalePath', () => {
    it.each([
        ['/de', 'en', '/en'],
        ['/en/', 'de', '/de'],
        ['/de/post/oktoberrevolution', 'en', '/en/post/oktoberrevolution'],
        ['/en/post/a%20b', 'de', '/de/post/a%20b'],
        ['/de/gibt-es-nicht', 'de', '/de/gibt-es-nicht'],
        ['/', 'en', '/en'],
        ['/post/oktoberrevolution', 'de', '/de/post/oktoberrevolution'],
        ['/xx/gibt-es-nicht', 'en', '/en/xx/gibt-es-nicht'],
    ] as const)('%s → %s: %s', (pathname, target, expected) => {
        expect(switchLocalePath(pathname, target)).toBe(expected)
    })
})
