import { de } from '@/i18n/de'
import { en } from '@/i18n/en'

type Grammar = (...args: unknown[]) => unknown

const SAMPLE_ARGUMENTS = [
    [1, 'ARG'],
    [2, 'ARG'],
] as const
const ARGUMENT = /\d+|ARG/
const EDGE_NON_LETTERS = /^[^\p{L}]+|[^\p{L}]+$/gu

/**
 * Every text of the German dictionary that the English one words differently: a string leaf whole,
 * a function leaf as the fixed words around its arguments ('Gruppe mit', 'Einträgen').
 */
export function germanOnlyTexts(): string[] {
    return [...new Set(differingTexts(de, en))]
}

/** Whether `text` occurs in `haystack` as whole words, ignoring case (small caps render uppercase). */
export function containsText(haystack: string, text: string): boolean {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'iu').test(haystack)
}

function differingTexts(german: unknown, english: unknown): string[] {
    if (typeof german === 'string') return german === english ? [] : [german]
    if (isGrammar(german) && isGrammar(english)) {
        const englishPhrases = phrasesOf(english)
        return phrasesOf(german).filter(
            (phrase) => !englishPhrases.includes(phrase)
        )
    }
    if (isRecord(german) && isRecord(english))
        return Object.keys(german).flatMap((key) =>
            differingTexts(german[key], english[key])
        )
    return []
}

function phrasesOf(grammar: Grammar): string[] {
    return SAMPLE_ARGUMENTS.flatMap((args) =>
        String(grammar(...args))
            .split(ARGUMENT)
            .map((part) => part.replace(EDGE_NON_LETTERS, ''))
            .filter((part) => part !== '')
    )
}

function isGrammar(value: unknown): value is Grammar {
    return typeof value === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
