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

export const bodyEditor = lexicalEditor({
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
