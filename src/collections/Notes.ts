import type { CollectionConfig, FieldHook } from 'payload'
import { bodyEditor } from './bodyEditor'
import { loggedIn, ownerOnly } from './userAccess'

const stampOwnerOnCreate: FieldHook = ({ operation, req, value }) =>
    operation === 'create' ? req.user?.id : value

export const Notes: CollectionConfig = {
    slug: 'notes',
    labels: { singular: 'Notiz', plural: 'Notizen' },
    admin: {
        defaultColumns: ['id', 'updatedAt'],
    },
    access: {
        create: loggedIn,
        read: ownerOnly,
        update: ownerOnly,
        delete: ownerOnly,
    },
    fields: [
        {
            name: 'owner',
            type: 'relationship',
            label: 'Verfasst von',
            relationTo: 'users',
            required: true,
            defaultValue: ({ user }) => user?.id,
            access: { update: () => false },
            hooks: { beforeValidate: [stampOwnerOnCreate] },
            admin: { readOnly: true, position: 'sidebar' },
        },
        {
            name: 'body',
            type: 'richText',
            label: 'Text',
            required: true,
            editor: bodyEditor,
        },
    ],
}
