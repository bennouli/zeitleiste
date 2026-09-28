import type { Page } from '@playwright/test'

export function firstFamily(fontFamily: string): string {
    return (fontFamily.split(',')[0] ?? '').trim().replace(/['"]/g, '')
}

/** The family a `next/font` call registered, read from the CSS variable it sets on `<html>`. */
export async function webFontFamily(
    page: Page,
    cssVariable: string
): Promise<string> {
    const fontStack = await page.evaluate(
        (name) =>
            getComputedStyle(document.documentElement).getPropertyValue(name),
        cssVariable
    )
    return firstFamily(fontStack)
}
