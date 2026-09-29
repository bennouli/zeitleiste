import { Option, Schema } from 'effect'
import { notFound } from 'next/navigation'
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales'

const decodeLocale = Schema.decodeUnknownOption(Schema.Literals(LOCALES))

/** The locale in a page's `[lang]` segment; a 404 for anything else. */
export function routeLocale(lang: string): Locale {
    return Option.getOrElse(decodeLocale(lang), () => notFound())
}

/** The locale in a `[lang]` segment, German for anything else. */
export function documentLocale(lang: string): Locale {
    return Option.getOrElse(decodeLocale(lang), () => DEFAULT_LOCALE)
}
