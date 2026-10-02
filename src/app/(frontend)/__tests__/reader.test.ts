import { REQUESTED_PATH_HEADER } from '@/i18n/loginPaths'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireReader } from '../reader'

const auth = vi.hoisted(() => vi.fn())
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }))

vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ auth }) }))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.current }))
const redirect = vi.hoisted(() =>
    vi.fn((href: string) => {
        throw new Error(`NEXT_REDIRECT ${href}`)
    })
)

vi.mock('next/navigation', () => ({ redirect }))

const READER = { id: 7, email: 'reader@example.test' }

beforeEach(() => {
    auth.mockReset()
    redirect.mockClear()
    requestHeaders.current = new Headers({
        [REQUESTED_PATH_HEADER]: '/en/post/x?quelle=alt',
    })
})

describe('requireReader', () => {
    it('answers with the user Payload verifies from the request headers', async () => {
        auth.mockResolvedValue({ user: READER })
        await expect(requireReader('en')).resolves.toBe(READER)
        expect(auth).toHaveBeenCalledWith({ headers: requestHeaders.current })
    })

    it('sends a visitor to the login page of the locale, keeping the requested path', async () => {
        auth.mockResolvedValue({ user: null })
        await expect(requireReader('en')).rejects.toThrow(
            'NEXT_REDIRECT /en/login?redirect=%2Fen%2Fpost%2Fx%3Fquelle%3Dalt'
        )
    })

    it('sends a visitor at an unknown locale to the German login page', async () => {
        auth.mockResolvedValue({ user: null })
        requestHeaders.current = new Headers()
        await expect(requireReader('xx')).rejects.toThrow(
            'NEXT_REDIRECT /de/login'
        )
    })

    it('fails instead of treating an unchecked session as a visitor', async () => {
        auth.mockRejectedValue(new Error('database down'))
        await expect(requireReader('de')).rejects.toThrow()
        expect(redirect).not.toHaveBeenCalled()
    })
})
