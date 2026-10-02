import { test as teardown } from '@playwright/test'
import { localPayload } from './payload'
import { readerAccount } from './reader'

teardown('the reader is deleted', async () => {
    const payload = await localPayload()
    await payload.delete({
        collection: 'users',
        where: { email: { equals: readerAccount().email } },
    })
})
