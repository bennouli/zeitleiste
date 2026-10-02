import { describe, expect, it } from 'vitest'
import type { NoteNode } from '../noteBody'
import { toEditorBody, toStoredBody } from '../noteBody'
import { noteBody, paragraph, text } from './noteFixtures'

const editorLink: NoteNode = {
    type: 'link',
    version: 1,
    url: 'https://example.org',
    target: null,
    rel: null,
    title: null,
    children: [text('Verweis')],
}

const storedLink: NoteNode = {
    type: 'link',
    version: 1,
    fields: { linkType: 'custom', newTab: false, url: 'https://example.org' },
    children: [text('Verweis')],
}

describe('toStoredBody', () => {
    it('moves a link target into Payload’s fields', () => {
        const body = noteBody(paragraph(editorLink))

        expect(toStoredBody(body)).toEqual(noteBody(paragraph(storedLink)))
    })

    it('stores a link opening in a new tab as newTab', () => {
        const newTabLink = { ...editorLink, target: '_blank' }
        const body = noteBody(paragraph(newTabLink))

        const [storedParagraph] = toStoredBody(body).root.children

        expect(storedParagraph).toMatchObject({
            children: [{ fields: { newTab: true } }],
        })
    })

    it('leaves everything but links alone', () => {
        const body = noteBody(paragraph(text('fett', 1)))

        expect(toStoredBody(body)).toEqual(body)
    })
})

describe('toEditorBody', () => {
    it('is the inverse of toStoredBody', () => {
        const body = noteBody(paragraph(text('Siehe '), editorLink))

        expect(toEditorBody(toStoredBody(body))).toEqual(body)
    })
})
