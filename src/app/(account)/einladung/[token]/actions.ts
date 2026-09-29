'use server'

import {
    acceptInvitation,
    InvitationAcceptFailed,
    InvitationUnusable,
} from '@/collections/invitation'
import type { AcceptInvitationStatus } from '@/components/account/AcceptInvitationForm'
import config from '@payload-config'
import { Cause, Data, Effect, Exit, Schema } from 'effect'
import { getPayload } from 'payload'

class PasswordMissing extends Data.TaggedError('PasswordMissing') {}

class PasswordMismatch extends Data.TaggedError('PasswordMismatch') {}

const InvitationToken = Schema.NonEmptyString.check(Schema.isMaxLength(256))

const PasswordForm = Schema.Struct({
    password: Schema.NonEmptyString,
    passwordRepeat: Schema.String,
})

const STATUS_BY_ERROR = {
    PasswordMissing: 'missing',
    PasswordMismatch: 'mismatch',
    InvitationUnusable: 'unusable',
    InvitationAcceptFailed: 'failed',
} as const satisfies Record<string, AcceptInvitationStatus>

export async function acceptInvitationAction(
    token: unknown,
    _previous: AcceptInvitationStatus,
    formData: FormData
): Promise<AcceptInvitationStatus> {
    const program = Effect.gen(function* () {
        const invitationToken = yield* Schema.decodeUnknownEffect(
            InvitationToken
        )(token).pipe(Effect.mapError(() => new InvitationUnusable({})))
        const { password, passwordRepeat } = yield* Schema.decodeUnknownEffect(
            PasswordForm
        )(Object.fromEntries(formData)).pipe(
            Effect.mapError(() => new PasswordMissing())
        )
        if (password !== passwordRepeat) return yield* new PasswordMismatch()
        const payload = yield* Effect.tryPromise({
            try: () => getPayload({ config }),
            catch: (cause) => new InvitationAcceptFailed({ cause }),
        })
        yield* acceptInvitation(payload, {
            token: invitationToken,
            password,
            now: new Date(),
        })
    }).pipe(
        Effect.tapErrorTag('InvitationAcceptFailed', ({ cause }) =>
            Effect.logError('Accepting an invitation failed', cause)
        ),
        Effect.match({
            onSuccess: (): AcceptInvitationStatus => 'accepted',
            onFailure: (error) => STATUS_BY_ERROR[error._tag],
        })
    )
    const exit = await Effect.runPromiseExit(program)
    if (Exit.isSuccess(exit)) return exit.value
    console.error(Cause.pretty(exit.cause))
    return 'failed'
}
