import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { Schema } from 'effect'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import type { Locale } from '../src/i18n/locales'
import { messages } from '../src/i18n/messages'
import type { User } from '../src/payload-types'

const Credentials = Schema.Struct({
    email: Schema.NonEmptyString,
    password: Schema.NonEmptyString,
})

export type Credentials = typeof Credentials.Type

const decodeCredentials = Schema.decodeUnknownSync(Credentials)

const AUTH_DIR = path.join(import.meta.dirname, '.auth')
const READER_ACCOUNT = path.join(AUTH_DIR, 'reader-account.json')

/** The browser state of the reader every site spec runs as (`playwright.config.ts`). */
export const READER_STATE = path.join(AUTH_DIR, 'reader.json')

/** The browser state of a visitor who is not logged in: `test.use({ storageState: VISITOR })`. */
export const VISITOR = { cookies: [], origins: [] }

/** Credentials no account has; wrong-credential checks use them so the reader's account is never locked. */
export const STRANGER: Credentials = {
    email: 'e2e-stranger@example.test',
    password: 'stranger-pass-1',
}

export function saveReaderAccount(credentials: Credentials) {
    mkdirSync(AUTH_DIR, { recursive: true })
    writeFileSync(READER_ACCOUNT, JSON.stringify(credentials))
}

/** The credentials of the reader the login setup created for this run. */
export function readerAccount(): Credentials {
    return decodeCredentials(JSON.parse(readFileSync(READER_ACCOUNT, 'utf8')))
}

export async function readerId(payload: Payload): Promise<number> {
    const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: readerAccount().email } },
        depth: 0,
        limit: 1,
    })
    const [reader] = docs
    if (!reader) throw new Error('no reader account for this run')
    return reader.id
}

/** Fills and sends the site's login form the page shows. */
export async function logIn(
    page: Page,
    { email, password }: Credentials,
    lang: Locale = 'de'
) {
    const loginText = messages[lang].login
    await page.getByLabel(loginText.email).fill(email)
    await page.getByLabel(loginText.password).fill(password)
    await page.getByRole('button', { name: loginText.submit }).click()
}

/** The login page's address for a requested path, as the site builds it. */
export function loginPathFor(lang: Locale, requestedPath: string) {
    return `/${lang}/login?${new URLSearchParams({ redirect: requestedPath })}`
}

export async function expectLoginPage(page: Page, lang: Locale) {
    await expect(
        page.getByRole('heading', {
            level: 1,
            name: messages[lang].login.heading,
        })
    ).toBeVisible()
}

export type Account = Credentials & { id: number }

/** The users one spec file creates, deleted with everything they own when it is done. */
export function specAccounts(prefix: string) {
    const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ids: number[] = []
    return {
        run,
        async create(
            payload: Payload,
            name: string,
            role: User['role'] = 'editor'
        ): Promise<Account> {
            const credentials = {
                email: `e2e-${prefix}-${name}-${run}@example.test`,
                password: `${name}-pass-1`,
            }
            const user = await payload.create({
                collection: 'users',
                data: {
                    ...credentials,
                    role,
                    invitationAcceptedAt: new Date().toISOString(),
                },
            })
            ids.push(user.id)
            return { ...credentials, id: user.id }
        },
        async removeAll(payload: Payload) {
            const { errors } = await payload.delete({
                collection: 'users',
                where: { id: { in: ids } },
                context: { disableRevalidate: true },
            })
            expect(errors).toEqual([])
        },
    }
}

/** Signs the page's browser context in, as the login form would. */
export async function signIn(page: Page, credentials: Credentials) {
    const res = await page.request.post('/api/users/login', {
        data: credentials,
    })
    expect(res.status()).toBe(200)
}

/** Headers that authenticate a REST request as the given user. */
export async function authHeaders(
    request: APIRequestContext,
    credentials: Credentials
) {
    const res = await request.post('/api/users/login', { data: credentials })
    expect(res.status()).toBe(200)
    const { token } = await res.json()
    return { Authorization: `JWT ${token}` }
}
