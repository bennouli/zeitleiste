import type { CollectionConfig } from 'payload'
import { bodyEditor } from './bodyEditor'
import { revalidatePostChange, revalidatePostDelete } from './revalidate'

export const Posts: CollectionConfig = {
    slug: 'posts',
    labels: { singular: 'Beitrag', plural: 'Beiträge' },
    admin: {
        defaultColumns: ['id', 'entry', 'updatedAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user),
    },
    hooks: {
        afterChange: [revalidatePostChange],
        afterDelete: [revalidatePostDelete],
    },
    fields: [
        {
            name: 'body',
            type: 'richText',
            label: 'Text',
            required: true,
            editor: bodyEditor,
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
