import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { Schema } from 'effect'

export type MediaStorage = {
    readonly blobToken: string | undefined
    readonly canStoreUploads: boolean
}

export const mediaStorage = (env: unknown): MediaStorage => {
    const { BLOB_READ_WRITE_TOKEN, VERCEL } = decodeStorageEnv(env)
    const blobToken = nonBlank(BLOB_READ_WRITE_TOKEN)
    return {
        blobToken,
        canStoreUploads: blobToken !== undefined || !nonBlank(VERCEL),
    }
}

export const blobStoragePlugin = ({ blobToken }: MediaStorage) =>
    vercelBlobStorage({
        enabled: blobToken !== undefined,
        collections: { media: { disablePayloadAccessControl: true } },
        token: blobToken,
        clientUploads: true,
    })

const StorageEnv = Schema.Struct({
    BLOB_READ_WRITE_TOKEN: Schema.optional(Schema.String),
    VERCEL: Schema.optional(Schema.String),
})

const decodeStorageEnv = Schema.decodeUnknownSync(StorageEnv)

const nonBlank = (value: string | undefined) =>
    value === undefined || value.trim() === '' ? undefined : value.trim()
