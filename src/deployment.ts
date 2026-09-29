import { Schema } from 'effect'

export type Deployment = {
    readonly serverURL: string
    readonly cookieOrigins: readonly string[]
}

export const deploymentOrigins = (env: unknown): Deployment => {
    const {
        SERVER_URL,
        VERCEL_ENV,
        VERCEL_PROJECT_PRODUCTION_URL,
        VERCEL_URL,
        VERCEL_BRANCH_URL,
    } = decodeDeploymentEnv(env)
    const productionOrigin =
        VERCEL_ENV === 'production'
            ? httpsOrigin(VERCEL_PROJECT_PRODUCTION_URL)
            : undefined
    const serverURL = decodeOrigin(
        nonBlank(SERVER_URL) ??
            productionOrigin ??
            httpsOrigin(VERCEL_URL) ??
            LOCAL_ORIGIN
    )
    const deploymentAliases = [VERCEL_URL, VERCEL_BRANCH_URL]
        .map(httpsOrigin)
        .filter((origin) => origin !== undefined)
    return {
        serverURL,
        cookieOrigins: [...new Set([serverURL, ...deploymentAliases])],
    }
}

const LOCAL_ORIGIN = 'http://localhost:3000'

const DeploymentEnv = Schema.Struct({
    SERVER_URL: Schema.optional(Schema.String),
    VERCEL_ENV: Schema.optional(Schema.String),
    VERCEL_PROJECT_PRODUCTION_URL: Schema.optional(Schema.String),
    VERCEL_URL: Schema.optional(Schema.String),
    VERCEL_BRANCH_URL: Schema.optional(Schema.String),
})

const decodeDeploymentEnv = Schema.decodeUnknownSync(DeploymentEnv)

const isOrigin = (value: string) =>
    URL.canParse(value) && new URL(value).origin === value

const Origin = Schema.String.check(
    Schema.makeFilter(
        (value) =>
            isOrigin(value) ||
            `Expected an origin like "https://example.com" (no path, no trailing slash), got "${value}"`
    )
)

const decodeOrigin = Schema.decodeUnknownSync(Origin)

const nonBlank = (value: string | undefined) =>
    value === undefined || value.trim() === '' ? undefined : value.trim()

const httpsOrigin = (host: string | undefined) => {
    const nonBlankHost = nonBlank(host)
    return nonBlankHost === undefined ? undefined : `https://${nonBlankHost}`
}
