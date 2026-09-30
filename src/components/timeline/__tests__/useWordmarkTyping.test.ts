import { APP_NAME } from '@/lib/brand'
import { stubReducedMotion } from '@/test/motion'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WORDMARK_HOLD_MS, WORDMARK_STEP_MS } from '../constants'
import { PRIVATE_UNDER_TESTS, useWordmarkTyping } from '../useWordmarkTyping'

const TYPING_MS = 1500

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    PRIVATE_UNDER_TESTS.forgetTyping()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('useWordmarkTyping', () => {
    it('reads «линия» on mount', () => {
        const { result } = renderHook(useWordmarkTyping)

        expect(result.current).toEqual({
            typed: '',
            untyped: 'линия',
            isTyping: true,
        })
    })

    it('holds «линия» until the hold is over', () => {
        const { result } = renderHook(useWordmarkTyping)

        advance(WORDMARK_HOLD_MS + WORDMARK_STEP_MS - 1)

        expect(result.current.untyped).toBe('линия')
    })

    it('replaces the letters left to right, one per step', () => {
        const { result } = renderHook(useWordmarkTyping)
        const frames: string[] = []

        advance(WORDMARK_HOLD_MS)
        for (let i = 0; i < 5; i++) {
            advance(WORDMARK_STEP_MS)
            frames.push(`${result.current.typed}|${result.current.untyped}`)
        }

        expect(frames).toEqual([
            'l|иния',
            'li|ния',
            'lin|ия',
            'lini|я',
            'liniya|',
        ])
    })

    it('ends on the name exactly 1500 ms after mount without a paint entry', () => {
        const { result } = renderHook(useWordmarkTyping)

        advance(TYPING_MS - 1)
        const frameBeforeEnd = result.current
        advance(1)

        expect(frameBeforeEnd.isTyping).toBe(true)
        expect(result.current).toEqual({
            typed: APP_NAME,
            untyped: '',
            isTyping: false,
        })
    })

    it('counts the 1500 ms from the first paint, before the wordmark mounted', () => {
        const mountDelayMs = 300
        const firstPaint = [
            { startTime: performance.now() - mountDelayMs },
        ] as PerformanceEntryList
        vi.spyOn(performance, 'getEntriesByName').mockReturnValue(firstPaint)
        const { result } = renderHook(useWordmarkTyping)

        advance(TYPING_MS - mountDelayMs - 1)
        const frameBeforeEnd = result.current
        advance(1)

        expect(frameBeforeEnd.isTyping).toBe(true)
        expect(result.current.isTyping).toBe(false)
    })

    it('does not replay when the wordmark mounts again in the same document', () => {
        const first = renderHook(useWordmarkTyping)
        advance(TYPING_MS)
        first.unmount()

        const { result } = renderHook(useWordmarkTyping)

        expect(result.current).toEqual({
            typed: APP_NAME,
            untyped: '',
            isTyping: false,
        })
    })

    it('carries on where it was when the wordmark mounts again mid-way', () => {
        const first = renderHook(useWordmarkTyping)
        advance(WORDMARK_HOLD_MS + 2 * WORDMARK_STEP_MS)
        first.unmount()

        const { result } = renderHook(useWordmarkTyping)
        const frameOnRemount = result.current
        advance(TYPING_MS - WORDMARK_HOLD_MS - 2 * WORDMARK_STEP_MS)

        expect(frameOnRemount.typed).toBe('li')
        expect(result.current.typed).toBe(APP_NAME)
    })

    it('shows the name at once with reduced motion', () => {
        stubReducedMotion(true)
        const { result } = renderHook(useWordmarkTyping)

        advance(0)

        expect(result.current.typed).toBe(APP_NAME)
        expect(result.current.isTyping).toBe(false)
    })
})
