import { $convertFromMarkdownString } from '@lexical/markdown'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { render, screen } from '@testing-library/react'
import { createEditor } from 'lexical'
import { describe, expect, it } from 'vitest'
import { toStoredBody, type NoteBody } from '../noteBody'
import { NOTE_NODES, NOTE_TRANSFORMERS } from '../noteMarkdown'

const MARKDOWN = [
    '# Peter der Große',
    '## Reisen',
    'Er reiste **inkognito** nach *Holland*.',
    '- Zaandam',
    '- London',
    '1. Erstens',
    '> Ein Fenster nach Europa',
    'Mehr bei [Wikipedia](https://de.wikipedia.org/wiki/Peter_I.).',
].join('\n\n')

function storedBodyOf(markdown: string): NoteBody {
    const editor = createEditor({
        namespace: 'note-test',
        nodes: NOTE_NODES,
        onError: (error) => {
            throw error
        },
    })
    editor.update(
        () => $convertFromMarkdownString(markdown, NOTE_TRANSFORMERS),
        { discrete: true }
    )
    const { root } = editor.getEditorState().toJSON()
    return toStoredBody({
        root: { ...root, children: root.children.map((node) => ({ ...node })) },
    })
}

describe('a note written in Markdown', () => {
    it('renders through Payload’s own converters with every format', () => {
        const body = storedBodyOf(MARKDOWN)

        render(<RichText data={body} />)

        expect(
            screen.getByRole('heading', { level: 3, name: 'Peter der Große' })
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', { level: 4, name: 'Reisen' })
        ).toBeInTheDocument()
        expect(screen.getByText('inkognito').tagName).toBe('STRONG')
        expect(screen.getByText('Holland').tagName).toBe('EM')
        expect(screen.getAllByRole('list')).toHaveLength(2)
        expect(
            screen.getAllByRole('listitem').map((item) => item.textContent)
        ).toEqual(['Zaandam', 'London', 'Erstens'])
        expect(
            screen.getByText('Ein Fenster nach Europa').closest('blockquote')
        ).not.toBeNull()
        expect(screen.getByRole('link', { name: 'Wikipedia' })).toHaveAttribute(
            'href',
            'https://de.wikipedia.org/wiki/Peter_I.'
        )
    })

    it('stores headings only at the levels a post allows', () => {
        const body = storedBodyOf('# Eins\n\n## Zwei\n\n### Drei')

        const tags = body.root.children
            .filter((node) => node.type === 'heading')
            .map((node) => node.tag)

        expect(tags).toEqual(['h3', 'h4'])
    })
})
