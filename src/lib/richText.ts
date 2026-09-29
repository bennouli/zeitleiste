import type { Post as PostDocument } from '@/payload-types'

/** A post body as the admin's rich-text editor stores it. */
export type PostBody = PostDocument['body']

/** Plain text with blank lines between paragraphs, as rich text of those paragraphs. */
export function paragraphsToLexical(text: string): PostBody {
    return {
        root: {
            type: 'root',
            direction: null,
            format: '',
            indent: 0,
            version: 1,
            children: paragraphsOf(text).map(paragraphNode),
        },
    }
}

function paragraphsOf(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
}

function paragraphNode(paragraph: string) {
    return {
        type: 'paragraph',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        textFormat: 0,
        textStyle: '',
        children: [
            {
                type: 'text',
                text: paragraph,
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                version: 1,
            },
        ],
    }
}
