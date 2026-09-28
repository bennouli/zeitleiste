import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettled } from '../useSettled'

const DELAY_MS = 500
const UNMEASURED = 0
const MEASURED = 800
const COLLAPSED = 400

beforeEach(() => {
    vi.useFakeTimers()
})
afterEach(() => {
    vi.useRealTimers()
})

function renderSettled() {
    return renderHook(({ value }) => useSettled(value, DELAY_MS), {
        initialProps: { value: UNMEASURED },
    })
}

describe('useSettled', () => {
    it('applies the first change away from the initial value at once', () => {
        const { result, rerender } = renderSettled()

        rerender({ value: MEASURED })

        expect(result.current).toBe(MEASURED)
    })

    it('debounces every later change by the delay', () => {
        const { result, rerender } = renderSettled()
        rerender({ value: MEASURED })

        rerender({ value: COLLAPSED })

        expect(result.current).toBe(MEASURED)
        act(() => {
            vi.advanceTimersByTime(DELAY_MS - 1)
        })
        expect(result.current).toBe(MEASURED)
        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(result.current).toBe(COLLAPSED)
    })

    it('restarts the delay while the value keeps changing', () => {
        const { result, rerender } = renderSettled()
        rerender({ value: MEASURED })
        const tweenFrame = (MEASURED + COLLAPSED) / 2

        rerender({ value: tweenFrame })
        act(() => {
            vi.advanceTimersByTime(DELAY_MS - 1)
        })
        rerender({ value: COLLAPSED })
        act(() => {
            vi.advanceTimersByTime(DELAY_MS - 1)
        })

        expect(result.current).toBe(MEASURED)
        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(result.current).toBe(COLLAPSED)
    })
})
