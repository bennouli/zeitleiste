import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { Schema } from 'effect'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { Entries } from './collections/Entries'
import { Posts } from './collections/Posts'
import { Subjects } from './collections/Subjects'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { deploymentOrigins } from './deployment'
import { emailAdapter } from './email'

const PayloadEnv = Schema.Struct({
    DATABASE_URL: Schema.NonEmptyString,
    PAYLOAD_SECRET: Schema.NonEmptyString,
})

const payloadEnv = Schema.decodeUnknownSync(PayloadEnv)(process.env)
const { serverURL, cookieOrigins } = deploymentOrigins(process.env)
const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
    serverURL,
    csrf: [...cookieOrigins],
    admin: {
        user: Users.slug,
        importMap: {
            baseDir: path.resolve(dirname),
        },
    },
    collections: [Users, Entries, Posts, Subjects, Tags],
    localization: {
        locales: ['de', 'en'],
        defaultLocale: 'de',
    },
    editor: lexicalEditor(),
    email: emailAdapter(process.env),
    secret: payloadEnv.PAYLOAD_SECRET,
    typescript: {
        outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
    db: postgresAdapter({
        pool: {
            connectionString: payloadEnv.DATABASE_URL,
        },
    }),
})
