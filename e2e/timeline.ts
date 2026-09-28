import { expect, type Locator, type Page } from '@playwright/test'

const MAX_TABS = 120

export type Focused = {
    name: string
    role: string | null
    /** Entries the focused element stands for: its card, stack, marker or span bar. */
    ids: string[]
    t: number | null
    inPoints: boolean
    inSpans: boolean
    outline: string
}

export function timelineRegion(page: Page): Locator {
    return page.getByRole('region', { name: 'Zeitleiste' })
}

export async function ready(page: Page, path = '/') {
    await page.goto(path)
    await expect(timelineRegion(page)).toHaveAttribute('data-view-start', /\d/)
}

export function focused(page: Page): Promise<Focused> {
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
            inPoints: el.closest('[data-layer="points"]') !== null,
            inSpans: el.closest('[data-layer="spans"]') !== null,
            outline: `${style.outlineStyle} ${style.outlineWidth}`,
        }
    })
}

export async function tabUntil(
    page: Page,
    isDone: (f: Focused) => boolean | Promise<boolean>
): Promise<Focused | null> {
    let f: Focused | null = null
    for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press('Tab')
        f = await focused(page)
        if (await isDone(f)) break
    }
    return f
}
