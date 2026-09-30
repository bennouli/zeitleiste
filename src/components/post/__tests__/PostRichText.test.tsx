import type { PostBody } from '@/lib/richText'
import { paragraphsToLexical } from '@/lib/richText'
import type { Media } from '@/payload-types'
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

const ZAR: Media = {
    id: 3,
    url: '/api/media/file/zar.png',
    width: 3200,
    height: 2000,
    alt: 'Zar Nikolaus II. in Uniform',
    caption: 'Der Zar 1913',
    credit: 'Wikimedia Commons',
    sizes: {
        w480: {
            url: '/api/media/file/zar-480x300.png',
            width: 480,
            height: 300,
        },
        w960: {
            url: '/api/media/file/zar-960x600.png',
            width: 960,
            height: 600,
        },
        w1600: {
            url: '/api/media/file/zar-1600x1000.png',
            width: 1600,
            height: 1000,
        },
    },
    updatedAt: '',
    createdAt: '',
}

function withImage(value: Media | number): PostBody {
    return {
        root: {
            ...everyFormat.root,
            children: [
                {
                    type: 'upload',
                    version: 3,
                    format: '',
                    id: 'node-1',
                    relationTo: 'media',
                    value,
                    fields: {},
                },
            ],
        },
    }
}

const COPIES = Object.values(ZAR.sizes!).toSorted(
    (a, b) => a!.width! - b!.width!
)

const copyCovering = (width: number) =>
    (COPIES.find((copy) => copy!.width! >= width) ?? COPIES.at(-1))!.url

function srcsetOf(image: HTMLElement) {
    return image
        .getAttribute('srcset')!
        .split(', ')
        .map((candidate) => {
            const [url, descriptor] = candidate.split(' ')
            return { url, width: parseInt(descriptor!, 10) }
        })
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

    it('renders an image as a figure at its largest copy, sized to the reading column', () => {
        const body = withImage(ZAR)
        render(<PostRichText body={body} />)
        const image = screen.getByRole('img', { name: ZAR.alt! })
        expect(image.closest('figure')).not.toBeNull()
        expect(image).toHaveAttribute('width', '1600')
        expect(image).toHaveAttribute('height', '1000')
        expect(image).toHaveAttribute(
            'sizes',
            '(min-width: 45.25rem) 41.25rem, calc(100vw - 4rem)'
        )
    })

    it("serves every width from the smallest of Payload's copies that covers it", () => {
        const body = withImage(ZAR)
        render(<PostRichText body={body} />)
        const candidates = srcsetOf(screen.getByRole('img'))
        expect(candidates.length).toBeGreaterThan(1)
        expect(
            candidates.every(({ url, width }) => url === copyCovering(width))
        ).toBe(true)
    })

    it('captions an image with its caption and source credit', () => {
        const body = withImage(ZAR)
        render(<PostRichText body={body} />)
        const figure = screen.getByRole('figure')
        expect(within(figure).getByText('Der Zar 1913')).toBeInTheDocument()
        expect(within(figure).getByText('Wikimedia Commons')).toHaveClass(
            'small-caps'
        )
        expect(figure.querySelector('figcaption')).toHaveClass(
            'text-meta',
            'text-fg-muted'
        )
    })

    it('leaves out the caption of an image without caption and credit', () => {
        const body = withImage({ ...ZAR, caption: null, credit: null })
        render(<PostRichText body={body} />)
        expect(
            screen.getByRole('figure').querySelector('figcaption')
        ).toBeNull()
    })

    it('uses the original of an image without copies', () => {
        const body = withImage({ ...ZAR, sizes: {} })
        render(<PostRichText body={body} />)
        const candidates = srcsetOf(screen.getByRole('img'))
        expect(new Set(candidates.map(({ url }) => url))).toEqual(
            new Set([ZAR.url])
        )
        expect(screen.getByRole('img')).toHaveAttribute('width', '3200')
    })

    it('leaves out an image that was deleted', () => {
        const body = withImage(3)
        const { container } = render(<PostRichText body={body} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('has no detectable accessibility violations', async () => {
        const { container } = render(
            <>
                <PostRichText body={everyFormat} />
                <PostRichText body={withImage(ZAR)} />
            </>
        )
        await expectNoAxeViolations(container)
    })
})
