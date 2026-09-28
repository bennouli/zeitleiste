import { MS_PER_YEAR } from '@/lib/time'
import type { Bounds } from '@/lib/viewport'
import { act, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    PRIVATE_UNDER_TESTS,
    useGestures,
    type GestureHandlers,
} from '../useGestures'
import { useViewport } from '../useViewport'

const Y2000 = Date.UTC(2000, 0, 1)
const BOUNDS: Bounds = { min: Y2000 - 200 * MS_PER_YEAR, max: Y2000 }
const INITIAL_VIEWPORT = {
    start: Y2000 - 150 * MS_PER_YEAR,
    end: Y2000 - 50 * MS_PER_YEAR,
}
const WIDTH = 1000

const { WHEEL_SETTLE_MS } = PRIVATE_UNDER_TESTS

function useViewportGestures(container: HTMLElement | null = null) {
    const containerRef = useRef<HTMLElement>(container)
    const controls = useViewport({
        bounds: BOUNDS,
        width: WIDTH,
        initial: INITIAL_VIEWPORT,
    })
    const gestures = useGestures(containerRef, controls.actions, WIDTH)
    return { controls, gestures }
}

describe('useGestures', () => {
    it('keeps its handlers across viewport changes', () => {
        const { result } = renderHook(useViewportGestures)
        const initialViewport = result.current.controls.viewport
        const initialHandlers = result.current.gestures.handlers
        act(() => result.current.controls.actions.panBy(100))
        expect(result.current.controls.viewport).not.toEqual(initialViewport)
        const handlerNames = Object.keys(
            initialHandlers
        ) as (keyof GestureHandlers)[]
        handlerNames.forEach((name) =>
            expect(result.current.gestures.handlers[name], name).toBe(
                initialHandlers[name]
            )
        )
    })

    describe('wheel', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })
        afterEach(() => {
            vi.useRealTimers()
        })

        const scroll = () =>
            new WheelEvent('wheel', {
                deltaY: -60,
                clientX: 500,
                cancelable: true,
            })

        it('ends the wheel gesture once the wheel has been quiet for WHEEL_SETTLE_MS', () => {
            const container = document.createElement('div')
            const { result } = renderHook(() => useViewportGestures(container))
            const settledBefore = result.current.controls.gestureEnd
            act(() => {
                container.dispatchEvent(scroll())
            })
            expect(result.current.controls.isGesturing).toBe(true)
            act(() => {
                vi.advanceTimersByTime(WHEEL_SETTLE_MS - 1)
                container.dispatchEvent(scroll())
                vi.advanceTimersByTime(WHEEL_SETTLE_MS - 1)
            })
            expect(result.current.controls.gestureEnd).toBe(settledBefore)
            act(() => {
                vi.advanceTimersByTime(1)
            })
            expect(result.current.controls.isGesturing).toBe(false)
            expect(result.current.controls.gestureEnd).toBe(settledBefore + 1)
        })

        it('stops listening on unmount', () => {
            const container = document.createElement('div')
            const { unmount } = renderHook(() => useViewportGestures(container))
            unmount()
            const lateScroll = scroll()
            container.dispatchEvent(lateScroll)
            expect(lateScroll.defaultPrevented).toBe(false)
        })
    })
})
