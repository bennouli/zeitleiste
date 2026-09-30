'use client'

import { prefersReducedMotion } from '@/lib/dom'
import { useEffect, useState } from 'react'
import { WORDMARK_HOLD_MS, WORDMARK_STEP_MS } from './constants'

export type WordmarkFrame = {
    /** Latin letters typed so far; the whole name once typing is over. */
    typed: string
    /** Cyrillic letters not yet replaced. */
    untyped: string
    isTyping: boolean
}

/** «линия», each letter with the Latin that replaces it. */
const LETTERS = [
    { cyrillic: 'л', latin: 'l' },
    { cyrillic: 'и', latin: 'i' },
    { cyrillic: 'н', latin: 'n' },
    { cyrillic: 'и', latin: 'i' },
    { cyrillic: 'я', latin: 'ya' },
] as const

const STEPS = LETTERS.map((_, i) => i + 1)

const WORDMARK_TYPING_MS = stepDueMs(LETTERS.length)

/** When this document first painted the wordmark, in `performance.now()` time; the typing plays once per full page load. */
let typingStartedAt: number | null = null

/** The wordmark typing itself from «линия» into its Latin name, once per document. */
export function useWordmarkTyping(): WordmarkFrame {
    const [step, setStep] = useState(() =>
        typingStartedAt === null
            ? 0
            : stepAt(performance.now() - typingStartedAt)
    )

    useEffect(() => {
        typingStartedAt ??=
            firstPaintMs() - (prefersReducedMotion() ? WORDMARK_TYPING_MS : 0)
        const elapsedMs = performance.now() - typingStartedAt
        const timers = STEPS.map((s) =>
            setTimeout(() => setStep(s), Math.max(0, stepDueMs(s) - elapsedMs))
        )
        return () => timers.forEach(clearTimeout)
    }, [])

    return {
        typed: LETTERS.slice(0, step)
            .map((l) => l.latin)
            .join(''),
        untyped: LETTERS.slice(step)
            .map((l) => l.cyrillic)
            .join(''),
        isTyping: step < LETTERS.length,
    }
}

function firstPaintMs(): number {
    return (
        performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
        performance.now()
    )
}

function stepDueMs(step: number): number {
    return WORDMARK_HOLD_MS + step * WORDMARK_STEP_MS
}

function stepAt(elapsedMs: number): number {
    return STEPS.filter((s) => stepDueMs(s) <= elapsedMs).length
}

export const PRIVATE_UNDER_TESTS = {
    forgetTyping: () => {
        typingStartedAt = null
    },
}
