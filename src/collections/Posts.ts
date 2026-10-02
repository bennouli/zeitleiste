import type { CollectionConfig, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'
import { postEditor } from './editors'
import { ownerField } from './ownership'
import { revalidatePostChange, revalidatePostDelete } from './revalidate'
import { sourceUrlProblem } from './sourceUrl'
import { ownedAccess } from './userAccess'

const webLinkOnly: TextFieldSingleValidation = (value, args) =>
    sourceUrlProblem(value) ?? text(value, args)

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
            name: 'sources',
            type: 'array',
            label: 'Quellen',
            labels: { singular: 'Quelle', plural: 'Quellen' },
            fields: [
                {
                    name: 'title',
                    type: 'text',
                    label: 'Titel',
                    required: true,
                },
                {
                    name: 'url',
                    type: 'text',
                    label: 'Link',
                    required: true,
                    validate: webLinkOnly,
                },
            ],
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
