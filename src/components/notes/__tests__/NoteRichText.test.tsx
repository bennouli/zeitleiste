import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { NoteNode } from '../noteBody'
import { NoteRichText } from '../NoteRichText'
import { noteBody, paragraph, text } from './noteFixtures'

function storedLink(url: string): NoteNode {
    return {
        type: 'link',
        version: 3,
        fields: { linkType: 'custom', newTab: false, url },
        children: [text('Verweis')],
    }
}

describe('NoteRichText', () => {
    it('links a web address', () => {
        const body = noteBody(paragraph(storedLink('https://example.org')))

        render(<NoteRichText body={body} />)

        expect(screen.getByRole('link', { name: 'Verweis' })).toHaveAttribute(
            'href',
            'https://example.org'
        )
    })

    it('renders a script address as plain text', () => {
        const body = noteBody(paragraph(storedLink('javascript:alert(1)')))

        render(<NoteRichText body={body} />)

        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByText('Verweis')).toBeInTheDocument()
    })

    it('sets bold and italic like a post', () => {
        const boldItalic = 3
        const body = noteBody(paragraph(text('fett', boldItalic)))

        render(<NoteRichText body={body} />)

        expect(screen.getByText('fett').closest('strong')).toHaveClass(
            'font-medium'
        )
        expect(screen.getByText('fett').closest('em')).toHaveClass(
            'font-serif-italic'
        )
    })
})
