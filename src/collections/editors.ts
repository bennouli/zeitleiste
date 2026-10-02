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

const textFeatures = [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h3', 'h4'] }),
    BoldFeature(),
    ItalicFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    LinkFeature({ enabledCollections: [] }),
    BlockquoteFeature(),
]

const toolbarFeatures = [FixedToolbarFeature(), InlineToolbarFeature()]

export const postEditor = lexicalEditor({
    features: [
        ...textFeatures,
        UploadFeature({ enabledCollections: ['media'], maxDepth: 1 }),
        ...toolbarFeatures,
    ],
})

export const noteEditor = lexicalEditor({
    features: [...textFeatures, ...toolbarFeatures],
})
