import { expect, test, type Page } from '@playwright/test'
import { entries } from '../src/data/entries'
import { containsText, germanOnlyTexts } from '../src/test/germanTexts'
import { openTimeline } from './timeline'

const ENGLISH_PAGES = [
    { path: '/en', title: 'Timeline' },
    {
        path: '/en/post/oktoberrevolution',
        title: 'Oktoberrevolution – Timeline',
    },
] as const

const CONTENT_TEXTS = entries
    .flatMap((entry) => [
        entry.title,
        entry.summary,
        ...entry.tags,
        ...textsIn(entry.post?.body),
    ])
    .toSorted((a, b) => b.length - a.length)

for (const { path, title } of ENGLISH_PAGES) {
    test(`${path} shows no German interface text`, async ({ page }) => {
        await openTimeline(page, path)
        await expect(page).toHaveTitle(title)

        const interfaceTexts = (await pageTexts(page)).map(withoutContent)
        const germanTexts = germanOnlyTexts().filter((german) =>
            interfaceTexts.some((text) => containsText(text, german))
        )

        expect(germanTexts).toEqual([])
    })
}

/** Every text node outside scripts, and every `aria-label` and `title`. */
function pageTexts(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            (node) =>
                node.parentElement?.closest('script, style, template')
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT
        )
        const textNodes: string[] = []
        while (walker.nextNode())
            textNodes.push(walker.currentNode.nodeValue ?? '')
        const attributes = [
            ...document.querySelectorAll('[aria-label], [title]'),
        ].flatMap((el) => [
            el.getAttribute('aria-label') ?? '',
            el.getAttribute('title') ?? '',
        ])
        return [...textNodes, ...attributes]
    })
}

function withoutContent(text: string): string {
    return CONTENT_TEXTS.reduce(
        (remaining, content) => remaining.replaceAll(content, ' '),
        text
    )
}

function textsIn(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(textsIn)
    if (typeof node !== 'object' || node === null) return []
    return Object.entries(node).flatMap(([key, value]) =>
        key === 'text' && typeof value === 'string' ? [value] : textsIn(value)
    )
}
