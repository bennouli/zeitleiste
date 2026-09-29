import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { Schema } from 'effect'
import type Mail from 'nodemailer/lib/mailer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emailAdapter, PRIVATE_UNDER_TESTS } from '../email'

vi.mock('@payloadcms/email-nodemailer', () => ({ nodemailerAdapter: vi.fn() }))

const { EmailEnv } = PRIVATE_UNDER_TESTS
const decodeEmailEnv = Schema.decodeUnknownSync(EmailEnv)

const smtpEnv = {
    SMTP_HOST: 'smtp.tem.scaleway.com',
    SMTP_PORT: '587',
    SMTP_USER: 'project-id',
    SMTP_PASS: 'secret-sentinel',
}
const defaultSender = { name: 'Liniya', address: 'noreply@bennoselig.dev' }

afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(nodemailerAdapter).mockClear()
})

describe('EmailEnv', () => {
    it('decodes a full SMTP set with the default sender', () => {
        expect(decodeEmailEnv(smtpEnv)).toEqual({
            sender: defaultSender,
            smtp: {
                host: 'smtp.tem.scaleway.com',
                port: 587,
                user: 'project-id',
                pass: 'secret-sentinel',
            },
        })
    })

    it('decodes no SMTP settings to no SMTP', () => {
        const env = {}
        expect(decodeEmailEnv(env)).toEqual({ sender: defaultSender })
    })

    it('treats empty values as unset', () => {
        const env = {
            EMAIL_FROM: '',
            SMTP_HOST: '',
            SMTP_PORT: '',
            SMTP_USER: '',
            SMTP_PASS: ' ',
        }
        expect(decodeEmailEnv(env)).toEqual({ sender: defaultSender })
    })

    it.each(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'])(
        'rejects a set without %s',
        (key) => {
            const env = { ...smtpEnv, [key]: '' }
            expect(() => decodeEmailEnv(env)).toThrow(`missing ${key}`)
        }
    )

    it('never echoes a value in the error', () => {
        const env = {
            SMTP_HOST: 'smtp.tem.scaleway.com',
            SMTP_PASS: 'secret-sentinel',
        }
        expect(() => decodeEmailEnv(env)).toThrow(
            'missing SMTP_PORT, SMTP_USER'
        )
        expect(() => decodeEmailEnv(env)).not.toThrow('secret-sentinel')
    })

    it.each(['0', '65536', '58.7', 'abc'])('rejects SMTP_PORT %s', (port) => {
        const env = { ...smtpEnv, SMTP_PORT: port }
        expect(() => decodeEmailEnv(env)).toThrow()
    })

    it('parses EMAIL_FROM into name and address', () => {
        const env = {
            EMAIL_FROM: 'Liniya Staging <staging@bennoselig.dev>',
        }
        expect(decodeEmailEnv(env).sender).toEqual({
            name: 'Liniya Staging',
            address: 'staging@bennoselig.dev',
        })
    })

    it.each([
        'noreply@bennoselig.dev',
        'Liniya <noreply>',
        '<noreply@bennoselig.dev>',
    ])('rejects EMAIL_FROM %s', (sender) => {
        const env = { EMAIL_FROM: sender }
        expect(() => decodeEmailEnv(env)).toThrow('Expected a sender')
    })
})

describe('emailAdapter', () => {
    it('sends over SMTP with STARTTLS when SMTP is configured', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        emailAdapter(smtpEnv)
        expect(nodemailerAdapter).toHaveBeenCalledWith({
            defaultFromName: 'Liniya',
            defaultFromAddress: 'noreply@bennoselig.dev',
            transportOptions: {
                host: 'smtp.tem.scaleway.com',
                port: 587,
                secure: false,
                requireTLS: true,
                auth: { user: 'project-id', pass: 'secret-sentinel' },
            },
        })
        expect(warn).not.toHaveBeenCalled()
    })

    it('warns once when SMTP is not configured', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const env = {}
        emailAdapter(env)
        expect(nodemailerAdapter).toHaveBeenCalledWith(
            expect.objectContaining({
                defaultFromName: 'Liniya',
                defaultFromAddress: 'noreply@bennoselig.dev',
            })
        )
        expect(
            vi.mocked(nodemailerAdapter).mock.calls[0]?.[0]
        ).not.toHaveProperty('transportOptions')
        expect(warn).toHaveBeenCalledExactlyOnceWith(
            'SMTP not configured, emails are printed to the terminal'
        )
    })
})

describe('terminal transport', () => {
    const sendThroughTerminal = async (message: Mail.Options) => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const env = {}
        emailAdapter(env)
        const transport =
            vi.mocked(nodemailerAdapter).mock.calls[0]?.[0]?.transport
        if (transport === undefined)
            throw new Error('no transport handed to the adapter')
        return transport.sendMail(message)
    }

    it('prints recipient, subject and text body', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {})
        const message = {
            from: 'Liniya <noreply@bennoselig.dev>',
            to: 'editor@example.com',
            subject: 'Einladung',
            text: 'Hier ist dein Link',
            html: '<p>ignored</p>',
        }
        const sentInfo = await sendThroughTerminal(message)
        expect(info).toHaveBeenCalledExactlyOnceWith(
            'Email to editor@example.com\nSubject: Einladung\n\nHier ist dein Link'
        )
        expect(sentInfo.envelope.to).toEqual(['editor@example.com'])
        expect(sentInfo.messageId).toMatch(/^<.+>$/)
    })

    it('prints the html body when there is no text', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {})
        const message = {
            from: 'Liniya <noreply@bennoselig.dev>',
            to: 'editor@example.com',
            subject: 'Reset',
            html: '<a href="/admin/reset/token">Reset</a>',
        }
        await sendThroughTerminal(message)
        expect(info).toHaveBeenCalledExactlyOnceWith(
            'Email to editor@example.com\nSubject: Reset\n\n<a href="/admin/reset/token">Reset</a>'
        )
    })
})
