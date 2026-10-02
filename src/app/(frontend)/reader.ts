import { loginHref, REQUESTED_PATH_HEADER } from '@/i18n/loginPaths'
import { documentLocale } from '@/i18n/routeLocale'
import config from '@/payload.config'
import { Data, Effect } from 'effect'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

class ReaderCheckFailed extends Data.TaggedError('ReaderCheckFailed')<{
    readonly cause: unknown
}> {}

/** The user logged in on this request, verified by Payload; null for a visitor. */
export const currentReader = cache(async () => {
    const requestHeaders = await headers()
    return Effect.runPromise(authenticatedUser(requestHeaders))
})

/**
 * Sends a visitor to the login page of `lang`, keeping the requested path.
 * Called before any site content is loaded.
 */
export const requireReader = cache(async (lang: string) => {
    const reader = await currentReader()
    if (reader !== null) return reader
    const requestedPath = (await headers()).get(REQUESTED_PATH_HEADER)
    redirect(loginHref(documentLocale(lang), requestedPath))
})

const authenticatedUser = Effect.fn('authenticatedUser')(function* (
    requestHeaders: Headers
) {
    const payload = yield* Effect.tryPromise({
        try: () => getPayload({ config }),
        catch: (cause) => new ReaderCheckFailed({ cause }),
    })
    const { user } = yield* Effect.tryPromise({
        try: () => payload.auth({ headers: requestHeaders }),
        catch: (cause) => new ReaderCheckFailed({ cause }),
    })
    return user
})
