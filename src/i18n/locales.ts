export const LOCALES = ['de', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'de'

export function isLocale(value: string): value is Locale {
    return LOCALES.some((locale) => locale === value)
}

/** Each language's name in that language, for the language switch. */
export const LANGUAGE_NAME: Record<Locale, string> = {
    de: 'Deutsch',
    en: 'English',
}
