import { INVITATION_VALID_MS } from '@/lib/invitation'
import { Cause, Effect, Exit } from 'effect'
import {
    APIError,
    AuthenticationError,
    type CollectionAfterChangeHook,
    type CollectionBeforeChangeHook,
    type CollectionBeforeLoginHook,
    type CollectionConfig,
    type PayloadHandler,
} from 'payload'
import { forgotPasswordEmail } from './authEmails'
import {
    ACCEPTING_INVITATION,
    resendInvitation,
    sendInvitation,
} from './invitation'
import {
    adminOnly,
    adminOnlyField,
    adminOrFirstUser,
    adminOrSelf,
    hasNoUsers,
    isAdmin,
    loggedIn,
} from './userAccess'

const INVITATION_FAILED = 'Die Einladung konnte nicht verschickt werden.'

const requireAcceptedInvitation: CollectionBeforeLoginHook = ({
    context,
    req,
    user,
}) => {
    if (!user.invitationAcceptedAt && context[ACCEPTING_INVITATION] !== true)
        throw new AuthenticationError(req.t)
    return user
}

const stampInvitation: CollectionBeforeChangeHook = async ({
    data,
    operation,
    req,
}) => {
    if (operation !== 'create') return data
    const now = new Date().toISOString()
    if (await hasNoUsers(req))
        return { ...data, role: 'admin', invitationAcceptedAt: now }
    return data.invitationAcceptedAt ? data : { ...data, invitedAt: now }
}

const inviteNewUser: CollectionAfterChangeHook = async ({
    doc,
    operation,
    req,
}) => {
    if (operation !== 'create' || doc.invitationAcceptedAt) return doc
    const exit = await Effect.runPromiseExit(sendInvitation(req, doc.email))
    if (Exit.isFailure(exit)) {
        req.payload.logger.error(
            { err: Cause.squash(exit.cause) },
            INVITATION_FAILED
        )
        throw new APIError(INVITATION_FAILED, 500, undefined, true)
    }
    return doc
}

const resendInvitationEndpoint: PayloadHandler = async (req) => {
    if (!isAdmin(req.user))
        return Response.json({ error: 'forbidden' }, { status: 403 })
    return Effect.runPromise(
        resendInvitation(req, req.routeParams?.id).pipe(
            Effect.match({
                onSuccess: () => Response.json({ message: 'sent' }),
                onFailure: (error) => {
                    switch (error._tag) {
                        case 'InvitationUserMissing':
                            return Response.json(
                                { error: 'not found' },
                                { status: 404 }
                            )
                        case 'InvitationAlreadyAccepted':
                            return Response.json(
                                { error: 'already accepted' },
                                { status: 409 }
                            )
                        default:
                            req.payload.logger.error(
                                { err: error },
                                INVITATION_FAILED
                            )
                            return Response.json(
                                { error: INVITATION_FAILED },
                                { status: 500 }
                            )
                    }
                },
            })
        )
    )
}

export const Users: CollectionConfig = {
    slug: 'users',
    labels: { singular: 'Benutzer', plural: 'Benutzer' },
    admin: {
        useAsTitle: 'email',
        defaultColumns: ['email', 'role', 'invitationAcceptedAt'],
        components: {
            edit: {
                beforeDocumentControls: [
                    '@/components/admin/ResendInvitationButton#ResendInvitationButton',
                ],
            },
        },
    },
    auth: {
        forgotPassword: {
            expiration: INVITATION_VALID_MS,
            generateEmailSubject: (args) => forgotPasswordEmail(args).subject,
            generateEmailHTML: (args) => forgotPasswordEmail(args).html,
        },
    },
    access: {
        create: adminOrFirstUser,
        read: loggedIn,
        update: adminOrSelf,
        delete: adminOnly,
    },
    hooks: {
        beforeLogin: [requireAcceptedInvitation],
        beforeChange: [stampInvitation],
        afterChange: [inviteNewUser],
    },
    endpoints: [
        {
            path: '/:id/invite',
            method: 'post',
            handler: resendInvitationEndpoint,
        },
    ],
    fields: [
        {
            name: 'role',
            type: 'select',
            label: 'Rolle',
            required: true,
            defaultValue: 'editor',
            saveToJWT: true,
            admin: {
                description:
                    'Das Passwort beim Anlegen ist nur ein Platzhalter: Wer eingeladen wird, legt über den Link in der Einladung ein eigenes fest. Bis dahin ist keine Anmeldung möglich.',
            },
            options: [
                { label: 'Admin', value: 'admin' },
                { label: 'Redaktion', value: 'editor' },
            ],
            access: { create: adminOnlyField, update: adminOnlyField },
        },
        {
            name: 'invitedAt',
            type: 'date',
            label: 'Eingeladen am',
            access: { create: () => false, update: () => false },
            admin: {
                readOnly: true,
                position: 'sidebar',
                date: { pickerAppearance: 'dayAndTime' },
            },
        },
        {
            name: 'invitationAcceptedAt',
            type: 'date',
            label: 'Einladung angenommen am',
            access: { create: () => false, update: () => false },
            admin: {
                readOnly: true,
                position: 'sidebar',
                date: { pickerAppearance: 'dayAndTime' },
            },
        },
    ],
}
