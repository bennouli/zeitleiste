'use server'

import type { LoginStatus } from '@/components/account/LoginForm'
import { DEFAULT_LOCALE, LOCALES } from '@/i18n/locales'
import { sitePagePath } from '@/i18n/loginPaths'
import { startHref } from '@/i18n/paths'
import config from '@/payload.config'
import { login } from '@payloadcms/next/auth'
import { Data, Effect, Option, Schema } from 'effect'
import { redirect } from 'next/navigation'
import { AuthenticationError, LockedAuth } from 'payload'

class CredentialsRejected extends Data.TaggedError('CredentialsRejected') {}

class LoginFailed extends Data.TaggedError('LoginFailed')<{
    readonly cause: unknown
}> {}

const Credentials = Schema.Struct({
    email: Schema.NonEmptyString,
    password: Schema.NonEmptyString,
})

const decodeLocale = Schema.decodeUnknownOption(Schema.Literals(LOCALES))

const STATUS_BY_ERROR = {
    CredentialsRejected: 'invalid',
    LoginFailed: 'failed',
} as const satisfies Record<string, LoginStatus>

/** Logs in through Payload, which sets its auth cookie, then opens `target` if it is a site page. */
export async function logInAction(
    lang: unknown,
    target: unknown,
    _previous: LoginStatus,
    formData: FormData
): Promise<LoginStatus> {
    const program = Schema.decodeUnknownEffect(Credentials)(
        Object.fromEntries(formData)
    ).pipe(
        Effect.mapError(() => new CredentialsRejected()),
        Effect.flatMap(({ email, password }) =>
            Effect.tryPromise({
                try: () =>
                    login({ collection: 'users', config, email, password }),
                catch: (cause) =>
                    isRejection(cause)
                        ? new CredentialsRejected()
                        : new LoginFailed({ cause }),
            })
        ),
        Effect.tapErrorTag('LoginFailed', ({ cause }) =>
            Effect.logError('Logging in failed', cause)
        ),
        Effect.match({
            onSuccess: () => 'loggedIn' as const,
            onFailure: (error) => STATUS_BY_ERROR[error._tag],
        })
    )
    const outcome = await Effect.runPromise(program)
    if (outcome !== 'loggedIn') return outcome
    const locale = Option.getOrElse(decodeLocale(lang), () => DEFAULT_LOCALE)
    redirect(sitePagePath(target) ?? startHref(locale))
}

const isRejection = (cause: unknown) =>
    cause instanceof AuthenticationError || cause instanceof LockedAuth
