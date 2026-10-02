import { Result, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { NoteBody, NoteId } from '../noteSchema'
import { paragraphsToLexical } from '../richText'

const decodeBody = Schema.decodeUnknownResult(NoteBody)
const decodeId = Schema.decodeUnknownResult(NoteId)

function bodyWith(block: object) {
    const { root } = paragraphsToLexical('Kiew')
    return { root: { ...root, children: [...root.children, block] } }
}

describe('NoteBody', () => {
    it('keeps every field of a node it accepts', () => {
        const body = paragraphsToLexical('Kiew 1240')

        const decoded = decodeBody(body)

        expect(Result.isSuccess(decoded) && decoded.success).toEqual(body)
    })

    it('accepts the blocks noteEditor writes', () => {
        const blocks = ['heading', 'quote', 'list'].map((type) =>
            bodyWith({ type, version: 1, children: [] })
        )

        const decoded = blocks.map((block) => decodeBody(block))

        expect(decoded.every(Result.isSuccess)).toBe(true)
    })

    it('rejects an upload, which notes do not hold', () => {
        const withUpload = bodyWith({
            type: 'upload',
            version: 3,
            relationTo: 'media',
            value: 1,
        })

        expect(Result.isFailure(decodeBody(withUpload))).toBe(true)
    })

    it('rejects an upload nested inside a paragraph', () => {
        const nestedUpload = bodyWith({
            type: 'paragraph',
            version: 1,
            children: [{ type: 'upload', version: 3, value: 1 }],
        })

        expect(Result.isFailure(decodeBody(nestedUpload))).toBe(true)
    })

    it('accepts formatted text, links and line breaks inside a list', () => {
        const linkedList = bodyWith({
            type: 'list',
            version: 1,
            children: [
                {
                    type: 'listitem',
                    version: 1,
                    children: [
                        { type: 'text', version: 1, text: 'Siehe', format: 1 },
                        { type: 'linebreak', version: 1 },
                        {
                            type: 'link',
                            version: 3,
                            fields: { url: 'https://example.org' },
                            children: [],
                        },
                    ],
                },
            ],
        })

        expect(Result.isSuccess(decodeBody(linkedList))).toBe(true)
    })

    it('rejects a value that is not rich text', () => {
        const plainText = { text: 'Kiew' }

        expect(Result.isFailure(decodeBody(plainText))).toBe(true)
    })
})

describe('NoteId', () => {
    it('accepts a positive integer only', () => {
        const ids = [7, 0, -1, 1.5, '7']

        const accepted = ids.map((id) => Result.isSuccess(decodeId(id)))

        expect(accepted).toEqual([true, false, false, false, false])
    })
})
