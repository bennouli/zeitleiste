import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'
import { messages } from '../src/i18n/messages'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload, QUIET } from './payload'
import {
    expectLoginPage,
    logIn,
    signIn,
    specAccounts,
    VISITOR,
    type Account,
} from './reader'
import { entrySlugsOnTimeline, timelineRegion } from './timeline'

type OwnEntry = {
    slug: string
    title: string
    startYear: number
    postText?: string
}

const accounts = specAccounts('own-timeline')
const RUN = accounts.run
const SHARED_SLUG = `geteilt-${RUN}`
const NOT_FOUND = messages.de.notFound.heading

const A_POST_TEXT = `Beitrag von A ${RUN}`
const B_POST_TEXT = `Beitrag von B ${RUN}`
const A_SHARED: OwnEntry = {
    slug: SHARED_SLUG,
    title: `Eintrag von A ${RUN}`,
    startYear: 1905,
    postText: A_POST_TEXT,
}
const A_OWN: OwnEntry = {
    slug: `nur-a-${RUN}`,
    title: `Nur von A ${RUN}`,
    startYear: 1925,
}
const B_SHARED: OwnEntry = {
    slug: SHARED_SLUG,
    title: `Eintrag von B ${RUN}`,
    startYear: 1905,
    postText: B_POST_TEXT,
}
const B_OWN: OwnEntry = {
    slug: `nur-b-${RUN}`,
    title: `Nur von B ${RUN}`,
    startYear: 1945,
    postText: `Beitrag nur von B ${RUN}`,
}
const B_DRAFT: OwnEntry = {
    slug: `entwurf-b-${RUN}`,
    title: `Entwurf von B ${RUN}`,
    startYear: 1965,
    postText: `Entwurfsbeitrag von B ${RUN}`,
}
const A_SLUGS = [A_OWN.slug, A_SHARED.slug].sort()
const B_SLUGS = [B_OWN.slug, B_SHARED.slug].sort()
const B_TEXTS = [B_SHARED, B_OWN, B_DRAFT].flatMap(({ title, postText }) =>
    postText ? [title, postText] : [title]
)

let payload: Payload
let userA: Account
let userB: Account

test.describe.configure({ mode: 'serial' })
test.use({ storageState: VISITOR })

test.beforeAll(async () => {
    payload = await localPayload()
    userA = await accounts.create(payload, 'a')
    userB = await accounts.create(payload, 'b')
    await Promise.all([
        storeEntry(userA.id, A_SHARED, 'published'),
        storeEntry(userA.id, A_OWN, 'published'),
        storeEntry(userB.id, B_SHARED, 'published'),
        storeEntry(userB.id, B_OWN, 'published'),
        storeEntry(userB.id, B_DRAFT, 'draft'),
    ])
})

test.afterAll(() => accounts.removeAll(payload))

async function storeEntry(
    owner: number,
    { slug, title, startYear, postText }: OwnEntry,
    status: 'published' | 'draft'
) {
    const post =
        postText === undefined
            ? undefined
            : await payload.create({
                  collection: 'posts',
                  data: { owner, body: paragraphsToLexical(postText) },
                  context: QUIET,
              })
    await payload.create({
        collection: 'entries',
        data: {
            owner,
            slug,
            generateSlug: false,
            title,
            summary: `Zusammenfassung ${RUN}`,
            startYear,
            type: 'event',
            post: post?.id,
            _status: status,
        },
        draft: status === 'draft',
        context: QUIET,
    })
}

async function expectOnlyEntriesOf(page: Page, slugs: string[]) {
    await expect(timelineRegion(page)).toHaveAttribute('data-view-start', /\d/)
    await expect.poll(() => entrySlugsOnTimeline(page)).toEqual(slugs)
}

test('logged in as B, the timeline lists only B’s published entries', async ({
    page,
}) => {
    await signIn(page, userB)
    await page.goto('/de')

    await expectOnlyEntriesOf(page, B_SLUGS)
    const html = await page.content()
    expect(html).toContain(B_SHARED.title)
    for (const text of [A_SHARED.title, A_OWN.title, B_DRAFT.title])
        expect(html).not.toContain(text)
})

test('a post of B is not found for A, who reads their own post at the slug both use', async ({
    page,
}) => {
    await signIn(page, userA)

    const foreignPost = await page.goto(`/de/post/${B_OWN.slug}`)
    expect(foreignPost?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()

    const sharedSlugPost = await page.goto(`/de/post/${SHARED_SLUG}`)
    expect(sharedSlugPost?.status()).toBe(200)
    const article = page.getByRole('article')
    await expect(
        article.getByRole('heading', { level: 2, name: A_SHARED.title })
    ).toBeVisible()
    await expect(article.getByText(A_POST_TEXT)).toBeVisible()
    expect(await page.content()).not.toContain(B_POST_TEXT)
})

test('the post of B’s never-published draft is not found, for B either', async ({
    page,
}) => {
    await signIn(page, userB)

    const draftPost = await page.goto(`/de/post/${B_DRAFT.slug}`)

    expect(draftPost?.status()).toBe(404)
})

test('after B logs out and A logs in on the same page, the timeline shows no entry of B', async ({
    page,
}) => {
    await page.goto('/de/login')
    await logIn(page, userB)
    await page.waitForURL(/\/de$/)
    await expectOnlyEntriesOf(page, B_SLUGS)

    const logoutStatus = await page.evaluate(async () => {
        const res = await fetch('/api/users/logout', { method: 'POST' })
        return res.status
    })
    expect(logoutStatus).toBe(200)
    await timelineRegion(page)
        .locator(`[data-layer="cards"] [data-entry-id="${B_OWN.slug}"]`)
        .getByRole('button')
        .click()
    await expectLoginPage(page, 'de')
    await logIn(page, userA)

    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
    await expectOnlyEntriesOf(page, A_SLUGS)
    for (const text of B_TEXTS)
        await expect(page.locator('body')).not.toContainText(text)
})
