import type { CollectionConfig } from 'payload'
import { postEditor } from './editors'
import { ownerField } from './ownership'
import { revalidatePostChange, revalidatePostDelete } from './revalidate'
import { ownedAccess } from './userAccess'

export const Posts: CollectionConfig = {
    slug: 'posts',
    labels: { singular: 'Beitrag', plural: 'Beiträge' },
    admin: {
        defaultColumns: ['id', 'entry', 'updatedAt'],
    },
    access: ownedAccess(false),
    hooks: {
        afterChange: [revalidatePostChange],
        afterDelete: [revalidatePostDelete],
    },
    fields: [
        ownerField,
        {
            name: 'body',
            type: 'richText',
            label: 'Text',
            required: true,
            editor: postEditor,
        },
        {
            name: 'entry',
            type: 'join',
            label: 'Eintrag',
            collection: 'entries',
            on: 'post',
            admin: { allowCreate: false },
        },
    ],
}
