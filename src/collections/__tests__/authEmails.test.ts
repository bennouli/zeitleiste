import { describe, expect, it } from 'vitest'
import { forgotPasswordEmail, invitationEmail } from '../authEmails'

describe('invitationEmail', () => {
    it('links to the invitation page', () => {
        const link = {
            serverURL: 'https://zeitleiste.example',
            token: 'abc123',
        }
        const email = invitationEmail(link)
        expect(email.subject).toBe('Einladung zu liniya')
        expect(email.html).toContain(
            'href="https://zeitleiste.example/einladung/abc123"'
        )
    })

    it('escapes the token for the URL', () => {
        const link = { serverURL: 'https://zeitleiste.example', token: 'a/b"c' }
        expect(invitationEmail(link).html).toContain('/einladung/a%2Fb%22c"')
    })
})

describe('forgotPasswordEmail', () => {
    const args = {
        token: 'def456',
        user: { email: 'editor@example.test' },
        req: {
            payload: {
                config: {
                    serverURL: 'https://zeitleiste.example',
                    routes: { admin: '/admin' },
                },
            },
        },
    }

    it('links to the admin reset page', () => {
        expect(forgotPasswordEmail(args).html).toContain(
            'href="https://zeitleiste.example/admin/reset/def456"'
        )
    })

    it('has a German subject', () => {
        expect(forgotPasswordEmail(args).subject).toBe(
            'Neues Passwort für liniya'
        )
    })

    it('refuses to build a link without a token', () => {
        const withoutToken = { ...args, token: undefined }
        expect(() => forgotPasswordEmail(withoutToken)).toThrow()
    })
})
