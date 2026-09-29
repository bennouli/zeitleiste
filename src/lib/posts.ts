import type { Locale } from '@/i18n/locales'
import { startHref } from '@/i18n/paths'
import type { Entry } from './entry'

/** Slugs (entry ids) of all entries that have a post. */
export function postSlugs(entries: readonly Entry[]): string[] {
    return entries.filter((e) => e.post !== undefined).map((e) => e.id)
}

/** The entry whose post lives at `slug`; undefined if there is none or it has no post. */
export function findEntry(
    entries: readonly Entry[],
    slug: string
): Entry | undefined {
    return entries.find((e) => e.id === slug && e.post !== undefined)
}

// `/post/<slug>`, optionally behind one leading segment such as a locale (`/de/post/<slug>`).
const POST_PATH = /^(?:\/[^/]+)?\/post\/([^/]+)\/?$/

/** The post slug in a pathname, or null if the pathname is not a post address. */
export function slugFromPathname(
    pathname: string | null | undefined
): string | null {
    if (!pathname) return null
    const m = POST_PATH.exec(pathname)
    if (!m?.[1]) return null
    try {
        return decodeURIComponent(m[1])
    } catch {
        return null
    }
}

/** The address of the post with this slug. */
export function postHref(slug: string, locale: Locale): string {
    return `${startHref(locale)}/post/${encodeURIComponent(slug)}`
}
