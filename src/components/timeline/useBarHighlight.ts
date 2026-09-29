'use client'

import { prefersReducedMotion } from '@/lib/dom'
import type { Entry } from '@/lib/entry'
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { BAR_HIGHLIGHT_FADE_MS, BAR_HIGHLIGHT_MS } from './constants'
import { entryRevealDelta } from './entryFocus'
import type { StackReveal } from './GroupStack'

export type BarHighlightPhase = 'on' | 'fading'

type EntryHighlight = {
    id: string
    phase: BarHighlightPhase
    /** One per click, so clicking the same bar again reveals its label again. */
    clickCount: number
}

export type BarHighlightSource = {
    sectionRef: RefObject<HTMLElement | null>
    width: number
    /** True if the last press became a drag; the click is then ignored. */
    wasDrag: () => boolean
    /** Pans by `dxPx` so the label comes into view. */
    onRevealNeeded: (dxPx: number) => void
}

/** What the cards read from the bar highlight. */
export type BarHighlightLookup = {
    /** The ring on entry `id`'s label, if any. */
    phaseOf: (id: string) => BarHighlightPhase | undefined
    /** Whether the highlighted entry is one of `entries` (its item paints on top). */
    isAmong: (entries: Entry[]) => boolean
    /** What a group stack of `entries` must bring into its window, if it holds the highlighted entry. */
    stackRevealOf: (entries: Entry[]) => StackReveal | undefined
}

export type BarHighlight = BarHighlightLookup & {
    /** Click, Enter or Space on the span bar of entry `id`. */
    highlightEntry: (id: string) => void
}

/**
 * A click on a span bar rings its label for `BAR_HIGHLIGHT_MS`, then fades the ring out
 * (at once with reduced motion). A label outside the visible width is panned into view first,
 * and a label hidden in a group stack is stepped into its window.
 */
export function useBarHighlight({
    sectionRef,
    width,
    wasDrag,
    onRevealNeeded,
}: BarHighlightSource): BarHighlight {
    const [highlight, setHighlight] = useState<EntryHighlight | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const clickCountRef = useRef(0)
    useEffect(() => () => clearTimeout(timerRef.current), [])

    const restartTimer = (delayMs: number, onElapsed: () => void) => {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(onElapsed, delayMs)
    }

    const fadeOut = (litHighlight: EntryHighlight) => {
        if (prefersReducedMotion()) return setHighlight(null)
        setHighlight({ ...litHighlight, phase: 'fading' })
        restartTimer(BAR_HIGHLIGHT_FADE_MS, () => setHighlight(null))
    }

    const highlightEntry = (id: string) => {
        if (wasDrag()) return
        const section = sectionRef.current
        const dx = section ? entryRevealDelta(section, id, width) : 0
        if (dx !== 0) onRevealNeeded(dx)
        const litHighlight: EntryHighlight = {
            id,
            phase: 'on',
            clickCount: ++clickCountRef.current,
        }
        setHighlight(litHighlight)
        restartTimer(BAR_HIGHLIGHT_MS, () => fadeOut(litHighlight))
    }

    const phaseOf = (id: string) =>
        highlight?.id === id ? highlight.phase : undefined

    const isAmong = (entries: Entry[]) =>
        entries.some((e) => e.id === highlight?.id)

    const stackRevealOf = (entries: Entry[]): StackReveal | undefined => {
        const index = entries.findIndex((e) => e.id === highlight?.id)
        return highlight && index >= 0
            ? { index, key: highlight.clickCount }
            : undefined
    }

    return { highlightEntry, phaseOf, isAmong, stackRevealOf }
}
