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
        const blocks = [
            { type: 'heading', tag: 'h3' },
            { type: 'heading', tag: 'h4' },
            { type: 'quote' },
            { type: 'list', tag: 'ul', listType: 'bullet' },
            { type: 'list', tag: 'ol', listType: 'number' },
        ].map((block) => bodyWith({ ...block, version: 1, children: [] }))

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
            tag: 'ul',
            listType: 'bullet',
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

    it('rejects nodes the renderer cannot draw', () => {
        const unreadable = [
            { type: 'heading', tag: 'h1', version: 1, children: [] },
            {
                type: 'list',
                tag: 'script',
                listType: 'bullet',
                version: 1,
                children: [],
            },
            {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'link', version: 3, children: [] }],
            },
        ].map((block) => bodyWith(block))

        const accepted = unreadable.map((body) =>
            Result.isSuccess(decodeBody(body))
        )

        expect(accepted).toEqual([false, false, false])
    })

    it('rejects nodes without their children or in the wrong place', () => {
        const misplaced = [
            { type: 'paragraph', version: 1 },
            { type: 'paragraph', version: 1, children: 'Kiew' },
            { type: 'text', version: 1, text: 'Kiew' },
            {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'quote', version: 1, children: [] }],
            },
            {
                type: 'list',
                tag: 'ul',
                listType: 'bullet',
                version: 1,
                children: [{ type: 'text', version: 1, text: 'Kiew' }],
            },
        ].map((block) => bodyWith(block))

        const accepted = misplaced.map((body) =>
            Result.isSuccess(decodeBody(body))
        )

        expect(accepted).toEqual([false, false, false, false, false])
    })

    it('rejects a root of another type', () => {
        const { root } = paragraphsToLexical('Kiew')
        const notRoot = { root: { ...root, type: 'paragraph' } }

        expect(Result.isFailure(decodeBody(notRoot))).toBe(true)
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
