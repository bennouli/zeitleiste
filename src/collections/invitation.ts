import { isInvitationCurrent } from '@/lib/invitation'
import { Data, Effect, Schema } from 'effect'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import { invitationEmail } from './authEmails'

export const ACCEPTING_INVITATION = 'acceptingInvitation'

type LocalRequest = Partial<PayloadRequest>

class InvitationTokenFailed extends Data.TaggedError('InvitationTokenFailed')<{
    readonly cause: unknown
}> {}

class InvitationMailFailed extends Data.TaggedError('InvitationMailFailed')<{
    readonly cause: unknown
}> {}

class InvitationStoreFailed extends Data.TaggedError('InvitationStoreFailed')<{
    readonly cause: unknown
}> {}

class InvitationUserMissing extends Data.TaggedError('InvitationUserMissing')<{
    readonly id: unknown
}> {}

class InvitationAlreadyAccepted extends Data.TaggedError(
    'InvitationAlreadyAccepted'
)<{ readonly id: number }> {}

export class InvitationUnusable extends Data.TaggedError('InvitationUnusable')<{
    readonly cause?: unknown
}> {}

export class InvitationAcceptFailed extends Data.TaggedError(
    'InvitationAcceptFailed'
)<{ readonly cause: unknown }> {}

const ResetToken = Schema.NonEmptyString

export const sendInvitation = Effect.fn('sendInvitation')(function* (
    payload: Payload,
    req: LocalRequest,
    email: string
) {
    const token = yield* Effect.tryPromise({
        try: () =>
            payload.forgotPassword({
                collection: 'users',
                data: { email },
                disableEmail: true,
                req,
            }),
        catch: (cause) => new InvitationTokenFailed({ cause }),
    }).pipe(
        Effect.flatMap((issued) =>
            Schema.decodeUnknownEffect(ResetToken)(issued).pipe(
                Effect.mapError((cause) => new InvitationTokenFailed({ cause }))
            )
        )
    )
    const message = invitationEmail({
        serverURL: payload.config.serverURL,
        token,
    })
    yield* Effect.tryPromise({
        try: () => payload.sendEmail({ to: email, ...message }),
        catch: (cause) => new InvitationMailFailed({ cause }),
    })
})

const UserId = Schema.FiniteFromString

export const resendInvitation = Effect.fn('resendInvitation')(function* (
    payload: Payload,
    rawId: unknown,
    now: Date
) {
    const id = yield* Schema.decodeUnknownEffect(UserId)(rawId).pipe(
        Effect.mapError(() => new InvitationUserMissing({ id: rawId }))
    )
    const invitee = yield* Effect.tryPromise({
        try: () =>
            payload.findByID({ collection: 'users', id, disableErrors: true }),
        catch: (cause) => new InvitationStoreFailed({ cause }),
    })
    if (!invitee) return yield* new InvitationUserMissing({ id })
    if (invitee.invitationAcceptedAt)
        return yield* new InvitationAlreadyAccepted({ id })
    yield* inTransaction(payload, (req) =>
        Effect.gen(function* () {
            yield* Effect.tryPromise({
                try: () =>
                    payload.update({
                        collection: 'users',
                        id,
                        data: { invitedAt: now.toISOString() },
                        req,
                    }),
                catch: (cause) => new InvitationStoreFailed({ cause }),
            })
            yield* sendInvitation(payload, req, invitee.email)
        })
    ).pipe(
        Effect.catchTag('TransactionFailed', ({ cause }) =>
            Effect.fail(new InvitationStoreFailed({ cause }))
        )
    )
})

export type InvitationAcceptance = {
    readonly token: string
    readonly password: string
    readonly now: Date
}

export const acceptInvitation = Effect.fn('acceptInvitation')(function* (
    payload: Payload,
    { token, password, now }: InvitationAcceptance
) {
    yield* inTransaction(payload, (req) =>
        Effect.gen(function* () {
            const { user } = yield* Effect.tryPromise({
                try: () =>
                    payload.resetPassword({
                        collection: 'users',
                        data: { token, password },
                        context: { [ACCEPTING_INVITATION]: true },
                        overrideAccess: true,
                        req,
                    }),
                catch: (cause) =>
                    isRejectedToken(cause)
                        ? new InvitationUnusable({ cause })
                        : new InvitationAcceptFailed({ cause }),
            })
            const invitee = yield* Schema.decodeUnknownEffect(OpenInvitee)(
                user
            ).pipe(Effect.mapError(() => new InvitationUnusable({})))
            if (!isInvitationCurrent(invitee.invitedAt, now))
                return yield* new InvitationUnusable({})
            yield* Effect.tryPromise({
                try: () =>
                    payload.update({
                        collection: 'users',
                        id: invitee.id,
                        data: { invitationAcceptedAt: now.toISOString() },
                        req,
                    }),
                catch: (cause) => new InvitationAcceptFailed({ cause }),
            })
        })
    ).pipe(
        Effect.catchTag('TransactionFailed', ({ cause }) =>
            Effect.fail(new InvitationAcceptFailed({ cause }))
        )
    )
})

class TransactionFailed extends Data.TaggedError('TransactionFailed')<{
    readonly cause: unknown
}> {}

type TransactionRequest = { readonly transactionID: string | number }

const inTransaction = <A, E>(
    payload: Payload,
    use: (req: TransactionRequest) => Effect.Effect<A, E>
) =>
    Effect.gen(function* () {
        const transactionID = yield* Effect.tryPromise({
            try: () => payload.db.beginTransaction(),
            catch: (cause) => new TransactionFailed({ cause }),
        })
        if (transactionID === null)
            return yield* new TransactionFailed({
                cause: 'The database adapter has no transactions',
            })
        const value = yield* use({ transactionID }).pipe(
            Effect.onError(() =>
                Effect.tryPromise(() =>
                    payload.db.rollbackTransaction(transactionID)
                ).pipe(Effect.ignore)
            )
        )
        yield* Effect.tryPromise({
            try: () => payload.db.commitTransaction(transactionID),
            catch: (cause) => new TransactionFailed({ cause }),
        })
        return value
    })

const isRejectedToken = (cause: unknown) =>
    cause instanceof APIError && cause.status === 403

const OpenInvitee = Schema.Struct({
    id: Schema.Number,
    invitedAt: Schema.DateFromString,
    invitationAcceptedAt: Schema.optional(Schema.Null),
})
