import { describe, expect, it } from 'vitest'
import { splitTitle } from '../noteTitle'
import {
    heading,
    lineBreak,
    list,
    noteBody,
    paragraph,
    text,
} from './noteFixtures'

describe('splitTitle', () => {
    it('takes the first paragraph as the title and keeps the rest', () => {
        const second = paragraph(text('Zweite Zeile'))
        const body = noteBody(paragraph(text('Titel')), second)

        const { title, rest } = splitTitle(body)

        expect(title).toBe('Titel')
        expect(rest.root.children).toEqual([second])
    })

    it('falls back to the next line with text when the first is empty', () => {
        const body = noteBody(
            paragraph(),
            paragraph(text('   ')),
            paragraph(text('Erst hier'))
        )

        expect(splitTitle(body).title).toBe('Erst hier')
    })

    it('ends the title at a line break and keeps the rest of that paragraph', () => {
        const body = noteBody(paragraph(text('Oben'), lineBreak, text('Unten')))

        const { title, rest } = splitTitle(body)

        expect(title).toBe('Oben')
        expect(rest.root.children).toEqual([paragraph(text('Unten'))])
    })

    it('skips an empty line before a line break', () => {
        const body = noteBody(paragraph(lineBreak, text('Nach dem Umbruch')))

        expect(splitTitle(body).title).toBe('Nach dem Umbruch')
    })

    it('joins formatted runs of one line', () => {
        const body = noteBody(
            heading('h3', text('Peter '), text('der Große', 1))
        )

        expect(splitTitle(body)).toEqual({
            title: 'Peter der Große',
            rest: noteBody(),
        })
    })

    it('takes the first list item as the title and keeps the others', () => {
        const body = noteBody(list([text('Eins')], [text('Zwei')]))

        const { title, rest } = splitTitle(body)

        expect(title).toBe('Eins')
        expect(rest.root.children).toEqual([list([text('Zwei')])])
    })

    it('has no title for a note without text', () => {
        const body = noteBody(paragraph(), paragraph())

        expect(splitTitle(body).title).toBe('')
    })
})
