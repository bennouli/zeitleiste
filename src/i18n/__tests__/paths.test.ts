import { describe, expect, it } from 'vitest'
import { isStartPath, startHref, switchLocalePath } from '../paths'

describe('startHref', () => {
    it('is the locale prefix', () => {
        expect(startHref('de')).toBe('/de')
        expect(startHref('en')).toBe('/en')
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
