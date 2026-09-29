import { isLocale, LOCALES, type Locale } from './locales'

/** The start page of the site in this locale. */
export function startHref(locale: Locale): string {
    return `/${locale}`
}

/** Whether the pathname is a start page (`/de`, `/en`). */
export function isStartPath(pathname: string): boolean {
    return LOCALES.some(
        (locale) => pathname.replace(/\/$/, '') === startHref(locale)
    )
}

/**
 * The same address in the target locale: the locale segment is swapped, or put
 * in front when the pathname has none (`/post/x` → `/en/post/x`).
 */
export function switchLocalePath(pathname: string, target: Locale): string {
    const [first = '', ...rest] = pathname.split('/').filter(Boolean)
    const unprefixed = isLocale(first) ? rest : [first, ...rest]
    return [startHref(target), ...unprefixed.filter(Boolean)].join('/')
}
