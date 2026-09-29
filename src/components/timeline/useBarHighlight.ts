'use client'

import { prefersReducedMotion } from '@/lib/dom'
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { BAR_HIGHLIGHT_FADE_MS, BAR_HIGHLIGHT_MS } from './constants'
import { entryRevealDelta } from './entryFocus'

export type BarHighlightPhase = 'on' | 'fading'

/** The label ringed after a click on its span bar. */
export type EntryHighlight = {
    id: string
    phase: BarHighlightPhase
}

export type BarHighlightSource = {
    sectionRef: RefObject<HTMLElement | null>
    width: number
    /** True if the last press became a drag; the click is then ignored. */
    wasDrag: () => boolean
    /** Pans by `dxPx` so the label comes into view. */
    onRevealNeeded: (dxPx: number) => void
}

export type BarHighlight = {
    highlight: EntryHighlight | null
    highlightEntry: (id: string) => void
}

/**
 * A click on a span bar rings its label for `BAR_HIGHLIGHT_MS`, then fades the ring out
 * (at once with reduced motion). A label outside the visible width is panned into view first.
 */
export function useBarHighlight({
    sectionRef,
    width,
    wasDrag,
    onRevealNeeded,
}: BarHighlightSource): BarHighlight {
    const [highlight, setHighlight] = useState<EntryHighlight | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    useEffect(() => () => clearTimeout(timerRef.current), [])

    const restartTimer = (delayMs: number, onElapsed: () => void) => {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(onElapsed, delayMs)
    }

    const fadeOut = (id: string) => {
        if (prefersReducedMotion()) return setHighlight(null)
        setHighlight({ id, phase: 'fading' })
        restartTimer(BAR_HIGHLIGHT_FADE_MS, () => setHighlight(null))
    }

    const highlightEntry = (id: string) => {
        if (wasDrag()) return
        const section = sectionRef.current
        const dx = section ? entryRevealDelta(section, id, width) : 0
        if (dx !== 0) onRevealNeeded(dx)
        setHighlight({ id, phase: 'on' })
        restartTimer(BAR_HIGHLIGHT_MS, () => fadeOut(id))
    }

    return { highlight, highlightEntry }
}
