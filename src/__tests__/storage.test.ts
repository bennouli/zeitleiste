import { describe, expect, it } from 'vitest'
import { mediaStorage } from '../storage'

describe('mediaStorage', () => {
    it('stores in Vercel Blob when a store is connected', () => {
        const env = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x', VERCEL: '1' }
        expect(mediaStorage(env)).toEqual({
            blobToken: 'vercel_blob_rw_x',
            canStoreUploads: true,
        })
    })

    it('stores on the local disk outside Vercel', () => {
        const env = { BLOB_READ_WRITE_TOKEN: ' ' }
        expect(mediaStorage(env)).toEqual({
            blobToken: undefined,
            canStoreUploads: true,
        })
    })

    it('cannot store uploads on Vercel without a store', () => {
        const env = { VERCEL: '1' }
        expect(mediaStorage(env).canStoreUploads).toBe(false)
    })
})
