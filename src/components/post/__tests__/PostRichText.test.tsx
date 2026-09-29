import type { PostBody } from '@/lib/richText'
import { paragraphsToLexical } from '@/lib/richText'
import { expectNoAxeViolations } from '@/test/axe'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PostRichText } from '../PostRichText'
import everyFormatJson from './everyFormat.json'

const everyFormat = everyFormatJson as PostBody

function withLink(fields: Record<string, unknown>): PostBody {
    return {
        root: {
            ...everyFormat.root,
            children: [
                {
                    type: 'paragraph',
                    version: 1,
                    children: [
                        {
                            type: 'link',
                            version: 3,
                            fields,
                            children: [
                                {
                                    type: 'text',
                                    text: 'Verweis',
                                    format: 0,
                                    version: 1,
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }
}

describe('PostRichText', () => {
    it('renders paragraphs in the body typography, without a wrapper', () => {
        const body = paragraphsToLexical('Erster Absatz.\n\nZweiter Absatz.')
        const { container } = render(<PostRichText body={body} />)
        const paragraphs = container.querySelectorAll(':scope > p')
        expect([...paragraphs].map((p) => p.textContent)).toEqual([
            'Erster Absatz.',
            'Zweiter Absatz.',
        ])
        expect(paragraphs[0]).toHaveClass('text-body', 'text-pretty')
    })

    it('renders the editor headings at their levels below the post title', () => {
        render(<PostRichText body={everyFormat} />)
        expect(
            screen.getByRole('heading', { level: 3, name: 'Vorgeschichte' })
        ).toHaveClass('text-lead')
        expect(
            screen.getByRole('heading', { level: 4, name: 'Unterabschnitt' })
        ).toHaveClass('text-body')
    })

    it('sets bold in the medium weight and italic in the italic face', () => {
        render(<PostRichText body={everyFormat} />)
        const boldWord = screen.getByText('fettem')
        const italicWord = screen.getByText('kursivem')
        expect(boldWord.tagName).toBe('STRONG')
        expect(boldWord).toHaveClass('font-medium')
        expect(italicWord.tagName).toBe('EM')
        expect(italicWord).toHaveClass('font-serif-italic', 'italic')
    })

    it('renders a link with its address', () => {
        render(<PostRichText body={everyFormat} />)
        const link = screen.getByRole('link', { name: 'Verweis' })
        expect(link).toHaveAttribute(
            'href',
            'https://de.wikipedia.org/wiki/Oktoberrevolution'
        )
        expect(link).not.toHaveAttribute('target')
        expect(link).toHaveClass('underline', 'focus-visible:outline-focus')
    })

    it('renders ordered and unordered lists', () => {
        render(<PostRichText body={everyFormat} />)
        const [orderedList, unorderedList] = screen.getAllByRole('list')
        expect(orderedList!.tagName).toBe('OL')
        expect(orderedList).toHaveClass('list-decimal')
        expect(
            within(orderedList!)
                .getAllByRole('listitem')
                .map((li) => li.textContent)
        ).toEqual(['Erstens', 'Zweitens'])
        expect(unorderedList!.tagName).toBe('UL')
        expect(unorderedList).toHaveClass('list-disc')
        expect(within(unorderedList!).getByRole('listitem')).toHaveTextContent(
            'Ein Punkt'
        )
    })

    it('opens a link in a new tab only when the editor asked for it', () => {
        const body = withLink({ url: 'https://example.org', newTab: true })
        render(<PostRichText body={body} />)
        const link = screen.getByRole('link', { name: 'Verweis' })
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders a link without an address as its text', () => {
        const body = withLink({ linkType: 'internal' })
        render(<PostRichText body={body} />)
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByText('Verweis')).toBeInTheDocument()
    })

    it('renders a quote', () => {
        render(<PostRichText body={everyFormat} />)
        expect(screen.getByText('Ein Zitat.').tagName).toBe('BLOCKQUOTE')
    })

    it('has no detectable accessibility violations', async () => {
        const { container } = render(<PostRichText body={everyFormat} />)
        await expectNoAxeViolations(container)
    })
})
