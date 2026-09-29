import {
    expect,
    test,
    type APIRequestContext,
    type Page,
} from '@playwright/test'
import type { Payload } from 'payload'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const emailFor = (name: string) => `e2e-${name}-${RUN}@example.test`

const ADMIN = { email: emailFor('admin'), password: 'admin-pass-1' }
const EDITOR = { email: emailFor('editor'), password: 'editor-pass-1' }
const UNUSABLE =
    'Die Einladung ist abgelaufen oder wurde schon verwendet. Bitte um eine neue Einladung.'
const ACCEPTED = 'Dein Passwort ist gespeichert. Du kannst dich jetzt anmelden.'
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000

let payload: Payload

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
    const acceptedAt = new Date().toISOString()
    await payload.create({
        collection: 'users',
        data: { ...ADMIN, role: 'admin', invitationAcceptedAt: acceptedAt },
    })
    await payload.create({
        collection: 'users',
        data: { ...EDITOR, role: 'editor', invitationAcceptedAt: acceptedAt },
    })
})

test.afterAll(async () => {
    await payload.delete({
        collection: 'users',
        where: { email: { like: `-${RUN}@example.test` } },
    })
})

async function userByEmail(email: string) {
    const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
    })
    const [user] = docs
    if (!user) throw new Error(`no user ${email}`)
    return user
}

async function freshToken(email: string): Promise<string> {
    const token = await payload.forgotPassword({
        collection: 'users',
        data: { email },
        disableEmail: true,
    })
    if (!token) throw new Error(`no token for ${email}`)
    return token
}

async function apiLogin(
    request: APIRequestContext,
    credentials: { email: string; password: string }
) {
    return request.post('/api/users/login', { data: credentials })
}

async function jwtFor(
    request: APIRequestContext,
    credentials: { email: string; password: string }
): Promise<string> {
    const res = await apiLogin(request, credentials)
    expect(res.status()).toBe(200)
    return (await res.json()).token
}

async function adminLogin(page: Page, credentials = ADMIN) {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByLabel('Password').fill(credentials.password)
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForURL(/\/admin$/)
}

async function setInvitationPassword(
    page: Page,
    token: string,
    password: string
) {
    await page.goto(`/einladung/${token}`)
    await page.getByLabel('Passwort', { exact: true }).fill(password)
    await page.getByLabel('Passwort wiederholen').fill(password)
    await page.getByRole('button', { name: 'Passwort festlegen' }).click()
}

test('an admin invites an editor, who sets a password through the link and logs in', async ({
    page,
    browser,
    request,
}) => {
    const invitee = { email: emailFor('invitee'), password: 'invitee-pass-1' }
    await adminLogin(page)
    await page.goto('/admin/collections/users/create')
    await page.getByLabel('Email').fill(invitee.email)
    await page.getByLabel('New Password').fill('throwaway-pass')
    await page.getByLabel('Confirm Password').fill('throwaway-pass')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/admin\/collections\/users\/\d+$/)

    const invited = await userByEmail(invitee.email)
    expect(invited.role).toBe('editor')
    expect(invited.invitedAt).toBeTruthy()
    expect(invited.invitationAcceptedAt).toBeFalsy()

    await page.getByRole('button', { name: 'Einladung erneut senden' }).click()
    await expect(
        page.getByText('Die Einladung wurde erneut verschickt.')
    ).toBeVisible()

    const throwaway = { email: invitee.email, password: 'throwaway-pass' }
    expect((await apiLogin(request, throwaway)).status()).toBe(401)

    const token = await freshToken(invitee.email)
    const inviteePage = await (await browser.newContext()).newPage()
    await setInvitationPassword(inviteePage, token, invitee.password)
    await expect(inviteePage.getByText(ACCEPTED)).toBeVisible()

    expect((await apiLogin(request, invitee)).status()).toBe(200)
    await adminLogin(inviteePage, invitee)

    await setInvitationPassword(inviteePage, token, 'another-pass-1')
    await expect(inviteePage.getByText(UNUSABLE)).toBeVisible()
    expect((await apiLogin(request, invitee)).status()).toBe(200)
})

test('an invitation older than 7 days shows the explanation, and the admin can send it again', async ({
    page,
    request,
}) => {
    const invitee = { email: emailFor('late'), password: 'late-pass-1' }
    const created = await payload.create({
        collection: 'users',
        data: {
            email: invitee.email,
            password: 'throwaway-pass',
            role: 'editor',
        },
    })
    const staleToken = await freshToken(invitee.email)
    const eightDaysAgo = new Date(Date.now() - EIGHT_DAYS_MS).toISOString()
    await payload.update({
        collection: 'users',
        id: created.id,
        data: { invitedAt: eightDaysAgo },
    })

    await setInvitationPassword(page, staleToken, invitee.password)
    await expect(page.getByText(UNUSABLE)).toBeVisible()
    expect((await apiLogin(request, invitee)).status()).toBe(401)

    const adminJwt = await jwtFor(request, ADMIN)
    const resend = await request.post(`/api/users/${created.id}/invite`, {
        headers: { Authorization: `JWT ${adminJwt}` },
    })
    expect(resend.status()).toBe(200)
    const resent = await userByEmail(invitee.email)
    expect(Date.parse(resent.invitedAt ?? '')).toBeGreaterThan(
        Date.parse(eightDaysAgo)
    )

    const token = await freshToken(invitee.email)
    await setInvitationPassword(page, token, invitee.password)
    await expect(page.getByText(ACCEPTED)).toBeVisible()
    expect((await apiLogin(request, invitee)).status()).toBe(200)
})

test('creating a user through the API without an admin login is rejected', async ({
    request,
}) => {
    const stranger = {
        email: emailFor('stranger'),
        password: 'stranger-pass-1',
    }
    const res = await request.post('/api/users', { data: stranger })
    expect([401, 403]).toContain(res.status())
    const { totalDocs } = await payload.count({
        collection: 'users',
        where: { email: { equals: stranger.email } },
    })
    expect(totalDocs).toBe(0)
})

test('editors cannot create, delete or re-invite users, nor make themselves admin', async ({
    request,
}) => {
    const editorJwt = await jwtFor(request, EDITOR)
    const headers = { Authorization: `JWT ${editorJwt}` }
    const recruit = { email: emailFor('recruit'), password: 'recruit-pass-1' }
    const admin = await userByEmail(ADMIN.email)
    const editor = await userByEmail(EDITOR.email)

    const create = await request.post('/api/users', { data: recruit, headers })
    expect(create.status()).toBe(403)

    const remove = await request.delete(`/api/users/${admin.id}`, { headers })
    expect(remove.status()).toBe(403)
    expect((await userByEmail(ADMIN.email)).id).toBe(admin.id)

    const reinvite = await request.post(`/api/users/${admin.id}/invite`, {
        headers,
    })
    expect(reinvite.status()).toBe(403)

    await request.patch(`/api/users/${editor.id}`, {
        data: { role: 'admin' },
        headers,
    })
    expect((await userByEmail(EDITOR.email)).role).toBe('editor')
})

test('the login page leads to a reset request that answers the same for known and unknown addresses', async ({
    page,
    browser,
}) => {
    await page.goto('/admin/login')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.waitForURL(/\/admin\/forgot$/)

    const answerFor = async (email: string) => {
        const requester = await (await browser.newContext()).newPage()
        await requester.goto('/admin/forgot')
        await requester.getByLabel('Email').fill(email)
        const response = requester.waitForResponse((res) =>
            res.url().includes('/api/users/forgot-password')
        )
        await requester.getByRole('button', { name: 'Submit' }).click()
        const answered = await response
        await expect(requester.getByText('Email Sent')).toBeVisible()
        const shown = await requester.locator('body').innerText()
        return {
            status: answered.status(),
            body: await answered.text(),
            shown: shown.replace(/\(\d+:\d+\)/g, ''),
        }
    }

    const known = await answerFor(EDITOR.email)
    const unknown = await answerFor(emailFor('nobody'))
    expect(unknown).toEqual(known)
})

test('a reset link sets a new password once', async ({ page, request }) => {
    const renewed = { email: EDITOR.email, password: 'editor-pass-2' }
    const token = await freshToken(EDITOR.email)

    await page.goto(`/admin/reset/${token}`, { waitUntil: 'networkidle' })
    await page.getByLabel('New Password').fill(renewed.password)
    await page.getByLabel('Confirm Password').fill(renewed.password)
    const response = page.waitForResponse((res) =>
        res.url().includes('/api/users/reset-password')
    )
    await page.getByRole('button', { name: 'Reset Password' }).click()
    const answered = await response
    expect(answered.status(), await answered.text()).toBe(200)
    expect((await apiLogin(request, renewed)).status()).toBe(200)

    const reused = await request.post('/api/users/reset-password', {
        data: { token, password: 'editor-pass-3' },
    })
    expect(reused.status()).toBe(403)
    expect((await apiLogin(request, renewed)).status()).toBe(200)
})

test('a reset link does not let an invitee past the invitation', async ({
    request,
}) => {
    const invitee = { email: emailFor('early'), password: 'early-pass-1' }
    await payload.create({
        collection: 'users',
        data: {
            email: invitee.email,
            password: 'throwaway-pass',
            role: 'editor',
        },
    })
    const token = await freshToken(invitee.email)

    const reset = await request.post('/api/users/reset-password', {
        data: { token, password: invitee.password },
    })
    expect(reset.ok()).toBe(false)
    expect((await apiLogin(request, invitee)).status()).toBe(401)
})
