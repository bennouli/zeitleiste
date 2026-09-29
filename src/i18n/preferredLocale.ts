import { Option, Schema } from 'effect'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

type LanguageRange = { tag: string; q: number }

const Weight = Schema.FiniteFromString.check(
    Schema.isBetween({ minimum: 0, maximum: 1 })
)

/** The site locale an `Accept-Language` header asks for most, or German when it asks for neither. */
export function preferredLocale(acceptLanguage: string | null): Locale {
    const primaryTags = languageRanges(acceptLanguage ?? '')
        .filter((range) => range.q > 0)
        .toSorted((a, b) => b.q - a.q)
        .map((range) => range.tag.split('-')[0] ?? '')
    return primaryTags.find(isLocale) ?? DEFAULT_LOCALE
}

function languageRanges(header: string): LanguageRange[] {
    return header.split(',').map((part) => {
        const [tag = '', ...params] = part.split(';')
        const qParam = params
            .map((param) => param.trim())
            .find((param) => param.startsWith('q='))
        return { tag: tag.trim().toLowerCase(), q: weightOf(qParam) }
    })
}

function weightOf(qParam: string | undefined): number {
    if (qParam === undefined) return 1
    return Option.getOrElse(
        Schema.decodeUnknownOption(Weight)(qParam.slice('q='.length)),
        () => 0
    )
}
