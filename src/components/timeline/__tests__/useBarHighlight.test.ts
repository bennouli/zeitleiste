import { stubReducedMotion } from '@/test/motion'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BAR_HIGHLIGHT_FADE_MS, BAR_HIGHLIGHT_MS } from '../constants'
import { useBarHighlight, type BarHighlightSource } from '../useBarHighlight'

const WIDTH = 1000
const SPAN_ID = 'kalter-krieg'
const OTHER_SPAN_ID = 'kubakrise'
const LABEL_WIDTH = 176

type Rect = { left: number; width: number }

function stubRect(el: HTMLElement, { left, width }: Rect) {
    el.getBoundingClientRect = () =>
        ({ left, width, height: 40, right: left + width }) as DOMRect
}

/** A timeline section whose cards layer holds one label at `labelLeft`, and a span bar for the same entry far off screen. */
function sectionWithLabelAt(labelLeft: number): HTMLElement {
    const section = document.createElement('section')
    section.innerHTML =
        `<div data-layer="cards"><div data-entry-id="${SPAN_ID}"><button></button></div></div>` +
        `<div data-layer="spans"><div data-span-id="${SPAN_ID}" tabindex="0"></div></div>`
    stubRect(section, { left: 0, width: WIDTH })
    stubRect(section.querySelector('button')!, {
        left: labelLeft,
        width: LABEL_WIDTH,
    })
    stubRect(section.querySelector<HTMLElement>('[data-span-id]')!, {
        left: -5000,
        width: 10,
    })
    return section
}

function renderBarHighlight(source: Partial<BarHighlightSource> = {}) {
    const onRevealNeeded = vi.fn()
    const props: BarHighlightSource = {
        sectionRef: { current: sectionWithLabelAt(100) },
        width: WIDTH,
        wasDrag: () => false,
        onRevealNeeded,
        ...source,
    }
    const hook = renderHook(() => useBarHighlight(props))
    return { ...hook, onRevealNeeded }
}

beforeEach(() => {
    vi.useFakeTimers()
    stubReducedMotion(false)
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('useBarHighlight', () => {
    it('rings the label for BAR_HIGHLIGHT_MS, fades it for BAR_HIGHLIGHT_FADE_MS, then clears it', () => {
        const { result } = renderBarHighlight()

        act(() => result.current.highlightEntry(SPAN_ID))

        expect(result.current.highlight).toEqual({ id: SPAN_ID, phase: 'on' })
        act(() => vi.advanceTimersByTime(BAR_HIGHLIGHT_MS - 1))
        expect(result.current.highlight?.phase).toBe('on')
        act(() => vi.advanceTimersByTime(1))
        expect(result.current.highlight).toEqual({
            id: SPAN_ID,
            phase: 'fading',
        })
        act(() => vi.advanceTimersByTime(BAR_HIGHLIGHT_FADE_MS))
        expect(result.current.highlight).toBeNull()
    })

    it('clears the ring without a fade under reduced motion', () => {
        stubReducedMotion(true)
        const { result } = renderBarHighlight()

        act(() => result.current.highlightEntry(SPAN_ID))
        act(() => vi.advanceTimersByTime(BAR_HIGHLIGHT_MS))

        expect(result.current.highlight).toBeNull()
    })

    it('ignores the click that ends a drag', () => {
        const wasDrag = () => true
        const { result, onRevealNeeded } = renderBarHighlight({ wasDrag })

        act(() => result.current.highlightEntry(SPAN_ID))

        expect(result.current.highlight).toBeNull()
        expect(onRevealNeeded).not.toHaveBeenCalled()
    })

    it('restarts the ring when another bar is clicked while one is lit', () => {
        const { result } = renderBarHighlight()
        act(() => result.current.highlightEntry(SPAN_ID))
        act(() => vi.advanceTimersByTime(BAR_HIGHLIGHT_MS - 1))

        act(() => result.current.highlightEntry(OTHER_SPAN_ID))
        act(() => vi.advanceTimersByTime(BAR_HIGHLIGHT_MS - 1))

        expect(result.current.highlight).toEqual({
            id: OTHER_SPAN_ID,
            phase: 'on',
        })
    })

    it('leaves the view alone when the label is on screen', () => {
        const { result, onRevealNeeded } = renderBarHighlight()

        act(() => result.current.highlightEntry(SPAN_ID))

        expect(onRevealNeeded).not.toHaveBeenCalled()
    })

    it('pans an off-screen label into view, measuring the label rather than the bar', () => {
        const offScreenLeft = 1200
        const sectionRef = { current: sectionWithLabelAt(offScreenLeft) }
        const { result, onRevealNeeded } = renderBarHighlight({ sectionRef })

        act(() => result.current.highlightEntry(SPAN_ID))

        expect(onRevealNeeded).toHaveBeenCalledExactlyOnceWith(
            WIDTH - 16 - (offScreenLeft + LABEL_WIDTH)
        )
    })
})
