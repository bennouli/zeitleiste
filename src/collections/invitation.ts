import { isInvitationCurrent } from '@/lib/invitation'
import { Data, Effect, Exit, Schema } from 'effect'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import { invitationEmail } from './authEmails'

export const ACCEPTING_INVITATION = 'acceptingInvitation'

class InvitationTokenFailed extends Data.TaggedError('InvitationTokenFailed')<{
    readonly cause: unknown
}> {}

class InvitationMailFailed extends Data.TaggedError('InvitationMailFailed')<{
    readonly cause: unknown
}> {}

const ResetToken = Schema.NonEmptyString

export const sendInvitation = Effect.fn('sendInvitation')(function* (
    req: PayloadRequest,
    email: string
) {
    const token = yield* Effect.tryPromise({
        try: () =>
            req.payload.forgotPassword({
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
        serverURL: req.payload.config.serverURL,
        token,
    })
    yield* Effect.tryPromise({
        try: () => req.payload.sendEmail({ to: email, ...message }),
        catch: (cause) => new InvitationMailFailed({ cause }),
    })
})

class InvitationUserMissing extends Data.TaggedError('InvitationUserMissing')<{
    readonly id: unknown
}> {}

class InvitationAlreadyAccepted extends Data.TaggedError(
    'InvitationAlreadyAccepted'
)<{ readonly id: number }> {}

class InvitationStoreFailed extends Data.TaggedError('InvitationStoreFailed')<{
    readonly cause: unknown
}> {}

const UserId = Schema.FiniteFromString

export const resendInvitation = Effect.fn('resendInvitation')(function* (
    req: PayloadRequest,
    rawId: unknown
) {
    const id = yield* Schema.decodeUnknownEffect(UserId)(rawId).pipe(
        Effect.mapError(() => new InvitationUserMissing({ id: rawId }))
    )
    const invitee = yield* Effect.tryPromise({
        try: () =>
            req.payload.findByID({
                collection: 'users',
                id,
                disableErrors: true,
                req,
            }),
        catch: (cause) => new InvitationStoreFailed({ cause }),
    })
    if (!invitee) return yield* new InvitationUserMissing({ id })
    if (invitee.invitationAcceptedAt)
        return yield* new InvitationAlreadyAccepted({ id })
    yield* Effect.tryPromise({
        try: () =>
            req.payload.update({
                collection: 'users',
                id,
                data: { invitedAt: new Date().toISOString() },
                req,
            }),
        catch: (cause) => new InvitationStoreFailed({ cause }),
    })
    yield* sendInvitation(req, invitee.email)
})

export class InvitationUnusable extends Data.TaggedError('InvitationUnusable')<{
    readonly cause?: unknown
}> {}

export class InvitationAcceptFailed extends Data.TaggedError(
    'InvitationAcceptFailed'
)<{ readonly cause: unknown }> {}

export type InvitationAcceptance = {
    readonly token: string
    readonly password: string
    readonly now: Date
}

export const acceptInvitation = Effect.fn('acceptInvitation')(function* (
    payload: Payload,
    { token, password, now }: InvitationAcceptance
) {
    yield* Effect.acquireUseRelease(
        beginTransaction(payload),
        (transactionID) =>
            Effect.gen(function* () {
                const req = { transactionID }
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
            }),
        (transactionID, exit) =>
            Effect.promise(() =>
                Exit.isSuccess(exit)
                    ? payload.db.commitTransaction(transactionID)
                    : payload.db.rollbackTransaction(transactionID)
            )
    )
})

const beginTransaction = (payload: Payload) =>
    Effect.tryPromise({
        try: () => payload.db.beginTransaction(),
        catch: (cause) => new InvitationAcceptFailed({ cause }),
    }).pipe(
        Effect.flatMap((transactionID) =>
            transactionID === null
                ? Effect.fail(
                      new InvitationAcceptFailed({
                          cause: 'The database adapter has no transactions',
                      })
                  )
                : Effect.succeed(transactionID)
        )
    )

const isRejectedToken = (cause: unknown) =>
    cause instanceof APIError && cause.status === 403

const OpenInvitee = Schema.Struct({
    id: Schema.Number,
    invitedAt: Schema.DateFromString,
    invitationAcceptedAt: Schema.optional(Schema.Null),
})
