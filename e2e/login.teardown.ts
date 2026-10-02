import { expect, test as teardown } from '@playwright/test'
import { localPayload, QUIET } from './payload'
import { readerAccount } from './reader'

teardown('the reader is deleted with everything they own', async () => {
    const payload = await localPayload()
    const { errors } = await payload.delete({
        collection: 'users',
        where: { email: { equals: readerAccount().email } },
        context: QUIET,
    })
    expect(errors).toEqual([])
})
