import { expect, type Locator, type Page } from '@playwright/test'

const MAX_TABS = 120

export type Focused = {
    name: string
    role: string | null
    /** Entries the focused element stands for: its card, stack, marker or span bar. */
    ids: string[]
    t: number | null
    inCards: boolean
    inSpans: boolean
    outline: string
}

export function timelineRegion(page: Page): Locator {
    return page.getByRole('region', { name: 'Zeitleiste' })
}

export async function openTimeline(page: Page, path = '/de') {
    await page.goto(path)
    const region = timelineRegion(page)
    await expect(region).toHaveAttribute('data-view-start', /\d/)
    await expect(region.locator('[data-layer="cards"]')).toBeAttached()
}

export function describeFocus(page: Page): Promise<Focused> {
    return page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const holder = el.closest<HTMLElement>(
            '[data-entry-id], [data-span-id], [data-entry-ids]'
        )
        const ids = holder
            ? (
                  holder.dataset.entryId ??
                  holder.dataset.spanId ??
                  holder.dataset.entryIds ??
                  ''
              )
                  .split(' ')
                  .filter(Boolean)
            : []
        const t = el.closest<HTMLElement>('[data-t]')?.dataset.t
        const style = getComputedStyle(el)
        return {
            name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
            role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
            ids,
            t: t === undefined ? null : Number(t),
            inCards: el.closest('[data-layer="cards"]') !== null,
            inSpans: el.closest('[data-layer="spans"]') !== null,
            outline: `${style.outlineStyle} ${style.outlineWidth}`,
        }
    })
}

export async function* tabThrough(page: Page): AsyncGenerator<Focused> {
    for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press('Tab')
        yield await describeFocus(page)
    }
}

export async function tabUntil(
    page: Page,
    isDone: (f: Focused) => boolean
): Promise<Focused | null> {
    let lastFocus: Focused | null = null
    for await (lastFocus of tabThrough(page)) if (isDone(lastFocus)) break
    return lastFocus
}
