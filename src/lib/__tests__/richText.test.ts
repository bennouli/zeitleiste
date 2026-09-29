import { describe, expect, it } from 'vitest'
import { paragraphsToLexical } from '../richText'

const textsOf = (text: string) =>
    paragraphsToLexical(text).root.children.map((paragraph) => ({
        type: paragraph.type,
        texts: (paragraph.children as { text: string }[]).map((t) => t.text),
    }))

describe('paragraphsToLexical', () => {
    it('makes one paragraph per blank-line-separated block', () => {
        const text = 'Erster Absatz.\n\nZweiter Absatz.'
        expect(textsOf(text)).toEqual([
            { type: 'paragraph', texts: ['Erster Absatz.'] },
            { type: 'paragraph', texts: ['Zweiter Absatz.'] },
        ])
    })

    it('keeps single line breaks inside a paragraph and trims its edges', () => {
        const text = '  Eine Zeile\nund die nächste.  \n \t\n\nNoch einer.\n'
        expect(textsOf(text)).toEqual([
            { type: 'paragraph', texts: ['Eine Zeile\nund die nächste.'] },
            { type: 'paragraph', texts: ['Noch einer.'] },
        ])
    })

    it('has no paragraphs for blank text', () => {
        const text = ' \n\n  '
        expect(paragraphsToLexical(text).root.children).toEqual([])
    })

    it('wraps the paragraphs in a root node', () => {
        const text = 'Absatz.'
        expect(paragraphsToLexical(text).root).toMatchObject({
            type: 'root',
            version: 1,
        })
    })
})
