import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Payload } from 'payload'
import { localPayload } from './payload'
import {
    expectLoginPage,
    signIn,
    specAccounts,
    VISITOR,
    type Account,
} from './reader'
import { openTimeline, tabUntil, timelineRegion } from './timeline'

const accounts = specAccounts('notes-phone')
const RUN = accounts.run
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1920, height: 1080 }
const TAB_PRESSES = 12

let payload: Payload
let writer: Account

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
    writer = await accounts.create(payload, 'writer')
})

test.afterAll(() => accounts.removeAll(payload))

const notesButton = (page: Page) =>
    page.getByRole('button', { name: 'Notizen öffnen' })

const notesAside = (page: Page) =>
    page.getByRole('complementary', { name: 'Notizen' })

const newNoteEditor = (aside: Locator) =>
    aside
        .getByRole('group', { name: 'Neue Notiz' })
        .getByRole('textbox', { name: 'Text' })

const isInert = (locator: Locator) =>
    locator.evaluate((el) => el.closest('[inert]') !== null)

const focusIsInsideNotesOrNowhere = (page: Page) =>
    page.evaluate(() => {
        const focused = document.activeElement
        return (
            focused === document.body ||
            focused?.closest('aside[aria-label="Notizen"]') !== null
        )
    })

async function storedNoteBodies() {
    const { docs } = await payload.find({
        collection: 'notes',
        where: { owner: { equals: writer.id } },
        depth: 0,
    })
    return docs.map((doc) => JSON.stringify(doc.body))
}

test.describe('signed in on a phone', () => {
    test.use({ viewport: PHONE })

    test.beforeEach(async ({ page }) => {
        await signIn(page, writer)
        await openTimeline(page)
    })

    test('opens the notes from the top bar, saves a note and closes them', async ({
        page,
    }) => {
        const text = `Notiz vom Telefon ${RUN}`
        const button = page.locator('[data-top-bar]').getByRole('button', {
            name: 'Notizen öffnen',
        })
        await button.click()

        const aside = notesAside(page)
        await expect(aside).toBeVisible()
        expect(await aside.boundingBox()).toMatchObject({
            x: 0,
            y: 0,
            width: PHONE.width,
            height: PHONE.height,
        })
        await expect(aside.locator(':focus')).toHaveCount(1)
        await newNoteEditor(aside).fill(text)
        await aside.getByRole('button', { name: 'Sichern' }).click()
        await expect(aside.getByText(text)).toBeVisible()
        await expect
            .poll(async () =>
                (await storedNoteBodies()).some((body) => body.includes(text))
            )
            .toBe(true)

        await aside.getByRole('button', { name: 'Notizen schließen' }).click()
        await expect(aside).toBeHidden()
        await expect(button).toBeFocused()
    })

    test('the timeline works as before once the notes are closed', async ({
        page,
    }) => {
        await notesButton(page).click()
        await page.keyboard.press('Escape')
        await expect(notesAside(page)).toBeHidden()

        const region = timelineRegion(page)
        const viewStart = await region.getAttribute('data-view-start')
        expect(viewStart).not.toBeNull()
        await page
            .getByRole('button', { name: 'Hineinzoomen', exact: true })
            .click()
        await expect(region).not.toHaveAttribute(
            'data-view-start',
            String(viewStart)
        )
    })

    test('the notes open and close by keyboard', async ({ page }) => {
        const button = notesButton(page)
        await expect(button).toBeVisible()
        await tabUntil(page, (f) => f.name === 'Notizen öffnen')
        await expect(button).toBeFocused()

        await page.keyboard.press('Enter')
        const aside = notesAside(page)
        await expect(aside).toBeVisible()
        await expect(aside.locator(':focus')).toHaveCount(1)

        await page.keyboard.press('Escape')
        await expect(aside).toBeHidden()
        await expect(button).toBeFocused()
    })

    test('nothing behind the open notes takes focus', async ({ page }) => {
        await notesButton(page).click()
        await expect(notesAside(page)).toBeVisible()

        expect(await isInert(timelineRegion(page))).toBe(true)
        for (const key of ['Tab', 'Shift+Tab'])
            for (let i = 0; i < TAB_PRESSES; i++) {
                await page.keyboard.press(key)
                expect(await focusIsInsideNotesOrNowhere(page)).toBe(true)
            }
    })

    test('a draft survives closing the notes', async ({ page }) => {
        const draft = `Entwurf ${RUN}`
        await notesButton(page).click()
        const editor = newNoteEditor(notesAside(page))
        await editor.fill(draft)
        await page.keyboard.press('Escape')

        await notesButton(page).click()

        await expect(editor).toHaveText(draft)
    })

    test('widening turns the open notes into the sidebar with the draft and focus kept', async ({
        page,
    }) => {
        const draft = `Vom Telefon ${RUN}`
        await notesButton(page).click()
        const editor = newNoteEditor(notesAside(page))
        await editor.fill(draft)

        await page.setViewportSize(DESKTOP)

        await expect(notesAside(page)).toBeVisible()
        await expect(editor).toHaveText(draft)
        await expect(editor).toBeFocused()
        expect(await isInert(timelineRegion(page))).toBe(false)
        await expect(
            page.getByRole('button', {
                name: 'Notizen öffnen',
                includeHidden: true,
            })
        ).toHaveAttribute('aria-expanded', 'false')
    })

    test('widening to a collapsed sidebar puts focus on its expand button', async ({
        page,
    }) => {
        await page.evaluate(() =>
            window.localStorage.setItem('notes.sidebar', 'collapsed')
        )
        await page.reload()
        await notesButton(page).click()
        await newNoteEditor(notesAside(page)).fill(`Eingeklappt ${RUN}`)

        await page.setViewportSize(DESKTOP)

        await expect(
            notesAside(page).getByRole('button', { name: 'Notizen einblenden' })
        ).toBeFocused()
    })

    test('a draft written in the sidebar is there when the notes open on a phone', async ({
        page,
    }) => {
        const draft = `Vom Desktop ${RUN}`
        await page.setViewportSize(DESKTOP)
        const editor = newNoteEditor(notesAside(page))
        await editor.fill(draft)

        await page.setViewportSize(PHONE)
        await expect(notesAside(page)).toBeHidden()
        await notesButton(page).click()

        await expect(editor).toHaveText(draft)
    })

    test('axe finds no violations with the notes open', async ({ page }) => {
        await notesButton(page).click()
        await expect(notesAside(page)).toBeVisible()
        const { violations } = await new AxeBuilder({ page }).analyze()
        expect(violations.map((v) => v.id)).toEqual([])
    })
})

test('a signed-in user on a wide screen gets the sidebar, not the button', async ({
    page,
}) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page, writer)
    await openTimeline(page)
    await expect(notesAside(page)).toBeVisible()
    await expect(notesButton(page)).toBeHidden()
})

test.describe('a visitor on a phone', () => {
    test.use({ storageState: VISITOR, viewport: PHONE })

    test('is sent to the login page and gets no notes button', async ({
        page,
    }) => {
        await page.goto('/de')

        await expectLoginPage(page, 'de')
        await expect(
            page.getByRole('button', {
                name: 'Notizen öffnen',
                includeHidden: true,
            })
        ).toHaveCount(0)
    })
})
