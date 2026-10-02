import {
    getRedirectUrl,
    unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'
import { config, proxy } from '../proxy'

const ORIGIN = 'http://localhost:3000'

const requestFor = (path: string) =>
    new NextRequest(`${ORIGIN}${path}`, {
        headers: { 'accept-language': 'en-US' },
    })

describe('proxy', () => {
    it.each([
        ['/', '/en'],
        [
            '/post/oktoberrevolution?quelle=alt',
            '/en/post/oktoberrevolution?quelle=alt',
        ],
    ])('sends %s to the preferred locale', (path, target) => {
        const request = requestFor(path)
        expect(getRedirectUrl(proxy(request))).toBe(`${ORIGIN}${target}`)
    })

    it.each(['/de', '/en/post/x?quelle=alt', '/xx/gibt-es-nicht', '/de/login'])(
        'lets %s through to the site',
        (path) => {
            const request = requestFor(path)
            expect(getRedirectUrl(proxy(request))).toBeNull()
        }
    )

    it.each(['/', '/de', '/en/post/x', '/xx', '/de/login'])(
        'runs on the site page %s',
        (url) => {
            expect(
                unstable_doesMiddlewareMatch({ config, nextConfig, url })
            ).toBe(true)
        }
    )

    it.each([
        '/api/users/login',
        '/admin',
        '/admin/login',
        '/einladung/abc',
        '/_next/static/chunk.js',
        '/favicon.ico',
    ])('leaves %s alone', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(
            false
        )
    })
})
