import { existsSync } from 'node:fs'
import type { Payload } from 'payload'

const PORT = 3100

/** Local API against the database in `.env.local`, for setup the UI cannot reach (tokens that only travel by email). Production mode, so it never pushes this branch's schema into the shared dev database. */
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
