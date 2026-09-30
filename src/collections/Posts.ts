import {
    BlockquoteFeature,
    BoldFeature,
    FixedToolbarFeature,
    HeadingFeature,
    InlineToolbarFeature,
    ItalicFeature,
    lexicalEditor,
    LinkFeature,
    OrderedListFeature,
    ParagraphFeature,
    UnorderedListFeature,
    UploadFeature,
} from '@payloadcms/richtext-lexical'
import type { CollectionConfig } from 'payload'
import { richText } from 'payload/shared'
import { requiredInGerman } from './requiredInGerman'
import { revalidatePostChange, revalidatePostDelete } from './revalidate'

const postEditor = lexicalEditor({
    features: [
        ParagraphFeature(),
        HeadingFeature({ enabledHeadingSizes: ['h3', 'h4'] }),
        BoldFeature(),
        ItalicFeature(),
        UnorderedListFeature(),
        OrderedListFeature(),
        LinkFeature({ enabledCollections: [] }),
        BlockquoteFeature(),
        UploadFeature({ enabledCollections: ['media'], maxDepth: 1 }),
        FixedToolbarFeature(),
        InlineToolbarFeature(),
    ],
})

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
            localized: true,
            validate: requiredInGerman(richText),
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
