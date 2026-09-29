import { describe, expect, it } from 'vitest'
import { deploymentOrigins } from '../deployment'

describe('deploymentOrigins', () => {
    it('uses SERVER_URL when set', () => {
        const env = {
            SERVER_URL: 'https://zeitleiste.example',
            VERCEL_ENV: 'production',
            VERCEL_PROJECT_PRODUCTION_URL: 'zeitleiste.bennoselig.dev',
        }
        expect(deploymentOrigins(env).serverURL).toBe(
            'https://zeitleiste.example'
        )
    })

    it('uses the production domain in production', () => {
        const env = {
            VERCEL_ENV: 'production',
            VERCEL_PROJECT_PRODUCTION_URL: 'zeitleiste.bennoselig.dev',
            VERCEL_URL: 'zeitleiste-abc123.vercel.app',
        }
        expect(deploymentOrigins(env).serverURL).toBe(
            'https://zeitleiste.bennoselig.dev'
        )
    })

    it('uses the deployment URL in a preview', () => {
        const env = {
            VERCEL_ENV: 'preview',
            VERCEL_PROJECT_PRODUCTION_URL: 'zeitleiste.bennoselig.dev',
            VERCEL_URL: 'zeitleiste-abc123.vercel.app',
        }
        expect(deploymentOrigins(env).serverURL).toBe(
            'https://zeitleiste-abc123.vercel.app'
        )
    })

    it('falls back to localhost:3000', () => {
        const env = { SERVER_URL: ' ' }
        expect(deploymentOrigins(env).serverURL).toBe('http://localhost:3000')
    })

    it('accepts cookies from the deployment and branch URLs too', () => {
        const env = {
            VERCEL_ENV: 'preview',
            VERCEL_URL: 'zeitleiste-abc123.vercel.app',
            VERCEL_BRANCH_URL: 'zeitleiste-git-feature.vercel.app',
        }
        expect(deploymentOrigins(env).cookieOrigins).toEqual([
            'https://zeitleiste-abc123.vercel.app',
            'https://zeitleiste-git-feature.vercel.app',
        ])
    })

    it('rejects a SERVER_URL with a path', () => {
        const env = { SERVER_URL: 'https://zeitleiste.example/admin' }
        expect(() => deploymentOrigins(env)).toThrow(/origin/)
    })

    it('rejects a SERVER_URL with a trailing slash', () => {
        const env = { SERVER_URL: 'https://zeitleiste.example/' }
        expect(() => deploymentOrigins(env)).toThrow(/origin/)
    })
})
