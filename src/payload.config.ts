import { APP_NAME } from '@/lib/brand'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { Schema } from 'effect'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { Entries } from './collections/Entries'
import { mediaCollection } from './collections/Media'
import { Notes } from './collections/Notes'
import { Posts } from './collections/Posts'
import { Subjects } from './collections/Subjects'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { deploymentOrigins } from './deployment'
import { emailAdapter } from './email'
import { requireOwnerOnDraftedTables } from './ownerRequired'
import { blobStoragePlugin, mediaStorage } from './storage'

const PayloadEnv = Schema.Struct({
    DATABASE_URL: Schema.NonEmptyString,
    PAYLOAD_SECRET: Schema.NonEmptyString,
})

const payloadEnv = Schema.decodeUnknownSync(PayloadEnv)(process.env)
const { serverURL, cookieOrigins } = deploymentOrigins(process.env)
const storage = mediaStorage(process.env)
const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
    serverURL,
    csrf: [...cookieOrigins],
    admin: {
        user: Users.slug,
        meta: { titleSuffix: `– ${APP_NAME}` },
        importMap: {
            baseDir: path.resolve(dirname),
        },
    },
    collections: [
        Users,
        Entries,
        Posts,
        Subjects,
        Tags,
        mediaCollection(storage),
        Notes,
    ],
    editor: lexicalEditor(),
    email: emailAdapter(process.env),
    secret: payloadEnv.PAYLOAD_SECRET,
    typescript: {
        outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
    plugins: [blobStoragePlugin(storage)],
    sharp,
    db: postgresAdapter({
        afterSchemaInit: [requireOwnerOnDraftedTables],
        pool: {
            connectionString: payloadEnv.DATABASE_URL,
        },
    }),
})
