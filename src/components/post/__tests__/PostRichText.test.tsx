import type { PostBody } from '@/lib/richText'
import { paragraphsToLexical } from '@/lib/richText'
import { expectNoAxeViolations } from '@/test/axe'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PostRichText } from '../PostRichText'
import everyFormatJson from './everyFormat.json'

const everyFormat = everyFormatJson as PostBody

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
        const bold = screen.getByText('fettem')
        const italic = screen.getByText('kursivem')
        expect(bold.tagName).toBe('STRONG')
        expect(bold).toHaveClass('font-medium')
        expect(italic.tagName).toBe('EM')
        expect(italic).toHaveClass('font-serif-italic', 'italic')
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
        const [ordered, unordered] = screen.getAllByRole('list')
        expect(ordered!.tagName).toBe('OL')
        expect(ordered).toHaveClass('list-decimal')
        expect(
            within(ordered!)
                .getAllByRole('listitem')
                .map((li) => li.textContent)
        ).toEqual(['Erstens', 'Zweitens'])
        expect(unordered!.tagName).toBe('UL')
        expect(unordered).toHaveClass('list-disc')
        expect(within(unordered!).getByRole('listitem')).toHaveTextContent(
            'Ein Punkt'
        )
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
