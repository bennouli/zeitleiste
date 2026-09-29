import { Cause, Effect, Exit, Schema } from 'effect'
import {
    APIError,
    AuthenticationError,
    type CollectionAfterChangeHook,
    type CollectionBeforeChangeHook,
    type CollectionBeforeLoginHook,
    type PayloadHandler,
} from 'payload'
import {
    ACCEPTING_INVITATION,
    resendInvitation,
    sendInvitation,
} from './invitation'
import { hasNoUsers, isAdmin } from './userAccess'

const INVITATION_FAILED = 'Die Einladung konnte nicht verschickt werden.'

const InvitationState = Schema.Struct({
    invitationAcceptedAt: Schema.optional(Schema.NullOr(Schema.String)),
})

const Invitee = Schema.Struct({
    email: Schema.String,
    invitationAcceptedAt: Schema.optional(Schema.NullOr(Schema.String)),
})

const isAccepted = (value: unknown) =>
    Boolean(
        Schema.decodeUnknownSync(InvitationState)(value).invitationAcceptedAt
    )

export const requireAcceptedInvitation: CollectionBeforeLoginHook = ({
    context,
    req,
    user,
}) => {
    if (!isAccepted(user) && context[ACCEPTING_INVITATION] !== true)
        throw new AuthenticationError(req.t)
    return user
}

export const stampInvitation: CollectionBeforeChangeHook = async ({
    data,
    operation,
    req,
}) => {
    if (operation !== 'create') return data
    const now = new Date().toISOString()
    if (await hasNoUsers(req))
        return { ...data, role: 'admin', invitationAcceptedAt: now }
    return isAccepted(data) ? data : { ...data, invitedAt: now }
}

export const inviteNewUser: CollectionAfterChangeHook = async ({
    doc,
    operation,
    req,
}) => {
    if (operation !== 'create') return doc
    const invitee = Schema.decodeUnknownSync(Invitee)(doc)
    if (invitee.invitationAcceptedAt) return doc
    const exit = await Effect.runPromiseExit(
        sendInvitation(req.payload, req, invitee.email)
    )
    if (Exit.isFailure(exit)) {
        req.payload.logger.error(
            { err: Cause.squash(exit.cause) },
            INVITATION_FAILED
        )
        throw new APIError(INVITATION_FAILED, 500, undefined, true)
    }
    return doc
}

const RESEND_STATUS: Partial<Record<string, number>> = {
    InvitationUserMissing: 404,
    InvitationAlreadyAccepted: 409,
}

export const resendInvitationEndpoint: PayloadHandler = async (req) => {
    if (!isAdmin(req.user))
        return Response.json({ error: 'forbidden' }, { status: 403 })
    const failed = (err: unknown) => {
        req.payload.logger.error({ err }, INVITATION_FAILED)
        return Response.json({ error: INVITATION_FAILED }, { status: 500 })
    }
    const exit = await Effect.runPromiseExit(
        resendInvitation(req.payload, req.routeParams?.id, new Date()).pipe(
            Effect.match({
                onSuccess: () => Response.json({ message: 'sent' }),
                onFailure: (error) => {
                    const status = RESEND_STATUS[error._tag]
                    return status === undefined
                        ? failed(error)
                        : Response.json({ error: error._tag }, { status })
                },
            })
        )
    )
    return Exit.isSuccess(exit) ? exit.value : failed(Cause.squash(exit.cause))
}
