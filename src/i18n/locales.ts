import { Schema } from 'effect'

const LOCALES = ['de', 'en'] as const

export const Locale = Schema.Literals(LOCALES)
export type Locale = typeof Locale.Type

export const DEFAULT_LOCALE: Locale = 'de'
