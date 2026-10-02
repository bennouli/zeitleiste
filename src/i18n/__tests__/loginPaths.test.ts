import { describe, expect, it } from 'vitest'
import { loginHref, sitePagePath } from '../loginPaths'

describe('sitePagePath', () => {
    it.each([
        ['/de', '/de'],
        ['/en/post/oktoberrevolution', '/en/post/oktoberrevolution'],
        ['/de/post/x?quelle=alt#a', '/de/post/x?quelle=alt#a'],
        ['/de/post/../post/x', '/de/post/x'],
    ])('keeps the site page %s', (value, path) => {
        expect(sitePagePath(value)).toBe(path)
    })

    it.each([
        '//evil.example',
        '/\\evil.example',
        '/\t/evil.example',
        '/de/../..//evil.example',
        'https://evil.example/de',
        'javascript:alert(1)',
        '%2F%2Fevil.example',
        '/%2F%2Fevil.example',
        'de/post/x',
        '/admin',
        '/xx/post/x',
        '/de/login',
        '/en/login?redirect=/en',
        '',
    ])('refuses %j', (value) => {
        expect(sitePagePath(value)).toBeUndefined()
    })

    it.each([undefined, null, ['/de', '/en'], 1])(
        'refuses the non-string %j',
        (value) => {
            expect(sitePagePath(value)).toBeUndefined()
        }
    )
})

describe('loginHref', () => {
    it('carries the requested site page', () => {
        expect(loginHref('en', '/en/post/a?b=c')).toBe(
            '/en/login?redirect=%2Fen%2Fpost%2Fa%3Fb%3Dc'
        )
    })

    it('is the bare login page for anything else', () => {
        expect(loginHref('de', null)).toBe('/de/login')
        expect(loginHref('de', '//evil.example')).toBe('/de/login')
    })
})
