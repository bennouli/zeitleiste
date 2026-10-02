import { expect, test } from '@playwright/test'
import { messages } from '../src/i18n/messages'
import { sampleEntry } from '../src/test/entries'
import {
    expectLoginPage,
    logIn,
    loginPathFor,
    readerAccount,
    STRANGER,
    VISITOR,
} from './reader'
import { timelineRegion } from './timeline'

const POST_ENTRY = sampleEntry('oktoberrevolution')
const OTHER_ENTRY = sampleEntry('kubakrise')
const CONTENT = [
    POST_ENTRY.title,
    POST_ENTRY.summary,
    OTHER_ENTRY.title,
    OTHER_ENTRY.summary,
]
const SITE_PAGES = [
    { path: '/de', lang: 'de' },
    { path: '/en', lang: 'en' },
    { path: `/de/post/${POST_ENTRY.id}`, lang: 'de' },
    { path: `/en/post/${POST_ENTRY.id}?quelle=alt`, lang: 'en' },
    { path: '/de/gibt-es-nicht', lang: 'de' },
] as const
const FORGED_SESSION = { Cookie: 'payload-token=forged' }
const RSC_REQUEST = { ...FORGED_SESSION, RSC: '1' }
const UNKNOWN_INVITATION = '/einladung/unbekannt'
const NO_REDIRECTS = { maxRedirects: 0 }
const WRONG_CREDENTIALS = [
    {
        name: 'a wrong password',
        credentials: () => ({ ...readerAccount(), password: 'wrong-pass-1' }),
    },
    { name: 'an unknown address', credentials: () => STRANGER },
]

test.use({ storageState: VISITOR })

test('a visitor who opens a post is sent to the login page and, after logging in, sees that post', async ({
    page,
}) => {
    const postPath = `/de/post/${POST_ENTRY.id}`
    await page.goto(postPath)
    await expect(page).toHaveURL(loginPathFor('de', postPath))
    await expectLoginPage(page, 'de')

    await logIn(page, readerAccount())

    await page.waitForURL(postPath)
    await expect(
        page.getByRole('article').getByRole('heading', {
            level: 2,
            name: POST_ENTRY.title,
        })
    ).toBeVisible()
})

test('the login page of each language keeps the requested path', async ({
    page,
}) => {
    const englishPath = `/en/post/${POST_ENTRY.id}?quelle=alt`
    await page.goto(englishPath)
    await expect(page).toHaveURL(loginPathFor('en', englishPath))
    await expectLoginPage(page, 'en')

    await logIn(page, readerAccount(), 'en')

    await page.waitForURL(englishPath)
    await expect(page.getByRole('article')).toBeVisible()
})

for (const { name, credentials } of WRONG_CREDENTIALS) {
    test(`${name} shows an error and no content`, async ({ page }) => {
        const wrongCredentials = credentials()
        await page.goto('/de/login')

        await logIn(page, wrongCredentials)

        await expect(
            page
                .getByRole('alert')
                .filter({ hasText: messages.de.login.invalid })
        ).toBeVisible()
        await expect(page).toHaveURL('/de/login')
        await expect(timelineRegion(page)).toHaveCount(0)
        const shown = await page.content()
        for (const text of CONTENT) expect(shown).not.toContain(text)
    })
}

for (const { path, lang } of SITE_PAGES) {
    test(`a visitor gets no entries or posts from ${path}, only the way to the login page`, async ({
        request,
    }) => {
        const plain = await request.get(path, NO_REDIRECTS)
        const forged = await request.get(path, {
            ...NO_REDIRECTS,
            headers: FORGED_SESSION,
        })
        const rsc = await request.get(path, {
            ...NO_REDIRECTS,
            headers: RSC_REQUEST,
        })

        for (const response of [plain, forged]) {
            expect(response.status()).toBe(307)
            expect(response.headers().location).toBe(loginPathFor(lang, path))
        }
        for (const response of [plain, forged, rsc]) {
            const body = await response.text()
            for (const text of CONTENT) expect(body).not.toContain(text)
        }
    })
}

test('the login page itself shows a visitor no entries', async ({ page }) => {
    await page.goto(loginPathFor('de', `/de/post/${POST_ENTRY.id}`))
    await expectLoginPage(page, 'de')
    const shown = await page.content()
    for (const text of CONTENT) expect(shown).not.toContain(text)
})

test('an invited user reaches the invitation without logging in', async ({
    page,
}) => {
    await page.goto(UNKNOWN_INVITATION)
    await expect(page).toHaveURL(UNKNOWN_INVITATION)
    await expect(
        page.getByRole('heading', {
            level: 1,
            name: messages.de.invitation.heading,
        })
    ).toBeVisible()
})

test('a redirect to another host lands on the start page after login', async ({
    page,
}) => {
    await page.goto(
        `/de/login?${new URLSearchParams({ redirect: 'https://example.com/de' })}`
    )

    await logIn(page, readerAccount())

    await page.waitForURL('/de')
    await expect(timelineRegion(page)).toBeVisible()
})
