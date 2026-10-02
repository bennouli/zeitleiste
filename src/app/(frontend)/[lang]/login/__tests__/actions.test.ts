import { AuthenticationError, LockedAuth } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logInAction } from '../actions'

const login = vi.hoisted(() => vi.fn())

vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('@payloadcms/next/auth', () => ({ login }))
vi.mock('next/navigation', () => ({
    redirect: (href: string) => {
        throw new Error(`NEXT_REDIRECT ${href}`)
    },
}))

const CREDENTIALS = { email: 'reader@example.test', password: 'reader-pass-1' }

const formOf = (fields: Record<string, string>) => {
    const formData = new FormData()
    for (const [name, value] of Object.entries(fields))
        formData.set(name, value)
    return formData
}

beforeEach(() => {
    login.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('logInAction', () => {
    it('logs in through Payload and opens the requested site page', async () => {
        login.mockResolvedValue({ user: { id: 1 } })
        const form = formOf(CREDENTIALS)
        await expect(
            logInAction('en', '/en/post/x?quelle=alt', 'idle', form)
        ).rejects.toThrow('NEXT_REDIRECT /en/post/x?quelle=alt')
        expect(login).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'users', ...CREDENTIALS })
        )
    })

    it.each(['https://evil.example/en', '//evil.example', '/de/login', 42])(
        'opens the start page instead of the target %j',
        async (target) => {
            login.mockResolvedValue({ user: { id: 1 } })
            const form = formOf(CREDENTIALS)
            await expect(
                logInAction('en', target, 'idle', form)
            ).rejects.toThrow(/^NEXT_REDIRECT \/en$/)
        }
    )

    it('falls back to the German start page for an unknown locale', async () => {
        login.mockResolvedValue({ user: { id: 1 } })
        const form = formOf(CREDENTIALS)
        await expect(
            logInAction('xx', undefined, 'idle', form)
        ).rejects.toThrow(/^NEXT_REDIRECT \/de$/)
    })

    it.each([
        ['wrong credentials', new AuthenticationError()],
        ['a locked account', new LockedAuth()],
    ])('answers invalid for %s', async (_, error) => {
        login.mockRejectedValue(error)
        const form = formOf(CREDENTIALS)
        await expect(logInAction('de', '/de', 'idle', form)).resolves.toBe(
            'invalid'
        )
    })

    it('answers invalid without asking Payload when a field is empty', async () => {
        const form = formOf({ email: CREDENTIALS.email, password: '' })
        await expect(logInAction('de', '/de', 'idle', form)).resolves.toBe(
            'invalid'
        )
        expect(login).not.toHaveBeenCalled()
    })

    it('answers failed when Payload cannot be reached', async () => {
        login.mockRejectedValue(new Error('database down'))
        const form = formOf(CREDENTIALS)
        await expect(logInAction('de', '/de', 'idle', form)).resolves.toBe(
            'failed'
        )
    })
})
