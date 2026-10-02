import { test as setup } from '@playwright/test'
import { localPayload } from './payload'
import { logIn, READER_STATE, saveReaderAccount } from './reader'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const READER = {
    email: `e2e-reader-${RUN}@example.test`,
    password: 'reader-pass-1',
}

setup('a reader logs in through the site', async ({ page }) => {
    const payload = await localPayload()
    await payload.create({
        collection: 'users',
        data: {
            ...READER,
            role: 'editor',
            invitationAcceptedAt: new Date().toISOString(),
        },
    })
    saveReaderAccount(READER)

    await page.goto('/de/login')
    await logIn(page, READER)
    await page.waitForURL(/\/de$/)
    await page.context().storageState({ path: READER_STATE })
})
