import { INVITATION_VALID_MS } from '@/lib/invitation'
import type { CollectionConfig } from 'payload'
import { forgotPasswordEmail } from './authEmails'
import {
    adminOnly,
    adminOnlyField,
    adminOrFirstUser,
    adminOrSelf,
    loggedIn,
} from './userAccess'
import {
    deleteOwnedContent,
    inviteNewUser,
    requireAcceptedInvitation,
    resendInvitationEndpoint,
    stampInvitation,
} from './userHooks'

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
        beforeDelete: [deleteOwnedContent],
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
