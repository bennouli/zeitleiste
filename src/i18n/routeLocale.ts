import { Option, Schema } from 'effect'
import { notFound } from 'next/navigation'
import { DEFAULT_LOCALE, Locale } from './locales'

const decodeLocale = Schema.decodeUnknownOption(Locale)

/** The locale in a page's `[lang]` segment; a 404 for anything else. */
export function routeLocale(lang: string): Locale {
    return Option.getOrElse(decodeLocale(lang), () => notFound())
}

/**
 * The locale of the document around a `[lang]` route: German where the segment
 * names no locale, so the page's own 404 still renders inside the site.
 */
export function documentLocale(lang: string): Locale {
    return Option.getOrElse(decodeLocale(lang), () => DEFAULT_LOCALE)
}
