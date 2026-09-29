import { Schema } from 'effect'

export const LOCALES = ['de', 'en'] as const

export const Locale = Schema.Literals(LOCALES)
export type Locale = typeof Locale.Type

export const DEFAULT_LOCALE: Locale = 'de'

/** Each language's name in that language, for the language switch. */
export const LANGUAGE_NAME: Record<Locale, string> = {
    de: 'Deutsch',
    en: 'English',
}
