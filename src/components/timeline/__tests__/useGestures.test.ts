import { MS_PER_YEAR } from '@/lib/time'
import type { Bounds } from '@/lib/viewport'
import { act, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useGestures, type GestureHandlers } from '../useGestures'
import { useViewport } from '../useViewport'

const Y2000 = Date.UTC(2000, 0, 1)
const BOUNDS: Bounds = { min: Y2000 - 200 * MS_PER_YEAR, max: Y2000 }
const INITIAL_VIEWPORT = {
    start: Y2000 - 150 * MS_PER_YEAR,
    end: Y2000 - 50 * MS_PER_YEAR,
}
const WIDTH = 1000

function useViewportGestures() {
    const containerRef = useRef<HTMLElement>(null)
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
})
