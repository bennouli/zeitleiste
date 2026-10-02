import { existsSync } from 'node:fs'
import type { Payload } from 'payload'

const PORT = 3100

/** The context of a write made outside the server, where `revalidatePath` cannot run. */
export const QUIET = { disableRevalidate: true }

/** Production mode, so it never pushes this branch's schema into the shared dev database. */
export async function localPayload(): Promise<Payload> {
    if (existsSync('.env.local')) process.loadEnvFile('.env.local')
    process.env.SERVER_URL = `http://localhost:${PORT}`
    Object.assign(process.env, { NODE_ENV: 'production' })
    const [{ getPayload }, { default: config }] = await Promise.all([
        import('payload'),
        import('../src/payload.config'),
    ])
    return getPayload({ config })
}
