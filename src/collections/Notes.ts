import type { CollectionConfig } from 'payload'
import { noteEditor } from './editors'
import { ownerField } from './ownership'
import { ownedAccess } from './userAccess'

export const Notes: CollectionConfig = {
    slug: 'notes',
    labels: { singular: 'Notiz', plural: 'Notizen' },
    admin: {
        defaultColumns: ['id', 'updatedAt'],
    },
    access: ownedAccess(false),
    fields: [
        ownerField,
        {
            name: 'body',
            type: 'richText',
            label: 'Text',
            required: true,
            editor: noteEditor,
        },
    ],
}
