import type { Page } from '@playwright/test'

/** The families of a `font-family` value, in order, unquoted. */
export function families(fontFamily: string): string[] {
    return fontFamily.split(',').map((f) => f.trim().replace(/['"]/g, ''))
}

export function firstFamily(fontFamily: string): string {
    return families(fontFamily)[0] ?? ''
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
