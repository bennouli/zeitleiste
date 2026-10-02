import { test as setup } from '@playwright/test'
import { localPayload } from './payload'
import { logIn, READER_STATE, saveReaderAccount } from './reader'
import { createSampleContent } from './sampleContent'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const READER = {
    email: `e2e-reader-${RUN}@example.test`,
    password: 'reader-pass-1',
}
const SEED_TIMEOUT_MS = 120_000

setup('a reader logs in through the site', async ({ page }) => {
    setup.setTimeout(SEED_TIMEOUT_MS)
    const payload = await localPayload()
    const reader = await payload.create({
        collection: 'users',
        data: {
            ...READER,
            role: 'editor',
            invitationAcceptedAt: new Date().toISOString(),
        },
    })
    saveReaderAccount(READER)
    await createSampleContent(payload, reader.id)

    await page.goto('/de/login')
    await logIn(page, READER)
    await page.waitForURL(/\/de$/)
    await page.context().storageState({ path: READER_STATE })
})
