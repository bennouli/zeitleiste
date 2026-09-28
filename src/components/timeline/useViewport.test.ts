import { MS_PER_YEAR } from '@/lib/time'
import {
    MAX_VISIBLE_MS,
    MIN_VISIBLE_MS,
    ZOOM_STEP_FACTOR,
    visibleMs,
    type Bounds,
} from '@/lib/viewport'
import { stubReducedMotion } from '@/test/motion'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANIMATION_MS } from './constants'
import { useViewport } from './useViewport'

const Y2000 = Date.UTC(2000, 0, 1)
const bounds: Bounds = { min: Y2000 - 200 * MS_PER_YEAR, max: Y2000 }
const WIDTH = 1000

function setup(initialSpanYears = 100) {
    const initial = {
        start: Y2000 - 150 * MS_PER_YEAR,
        end: Y2000 - (150 - initialSpanYears) * MS_PER_YEAR,
    }
    return renderHook(() => useViewport({ bounds, width: WIDTH, initial }))
}

function flush(ms = ANIMATION_MS + 100) {
    act(() => {
        vi.advanceTimersByTime(ms)
    })
}

beforeEach(() => {
    vi.useFakeTimers({
        toFake: [
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'performance',
            'setTimeout',
            'clearTimeout',
        ],
    })
    stubReducedMotion(false)
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('useViewport', () => {
    it('zoomIn/zoomOut animate around the center by ZOOM_STEP_FACTOR', () => {
        const { result } = setup()
        const before = result.current.viewport
        const center = (before.start + before.end) / 2
        act(() => result.current.zoomIn())
        expect(result.current.isAnimating).toBe(true)
        expect(result.current.isGesturing).toBe(true)
        act(() => {
            vi.advanceTimersByTime(ANIMATION_MS / 3)
        })
        const mid = visibleMs(result.current.viewport)
        expect(mid).toBeLessThan(visibleMs(before))
        expect(mid).toBeGreaterThan(visibleMs(before) / ZOOM_STEP_FACTOR)
        flush()
        expect(result.current.isAnimating).toBe(false)
        expect(result.current.gestureEnd).toBe(1)
        const after = result.current.viewport
        expect(visibleMs(after)).toBeCloseTo(
            visibleMs(before) / ZOOM_STEP_FACTOR,
            -3
        )
        expect((after.start + after.end) / 2).toBeCloseTo(center, -3)

        act(() => result.current.zoomOut())
        flush()
        expect(visibleMs(result.current.viewport)).toBeCloseTo(
            visibleMs(before),
            -3
        )
        expect(result.current.gestureEnd).toBe(2)
    })

    it('two quick clicks build on the running animation target', () => {
        const { result } = setup()
        const span = visibleMs(result.current.viewport)
        act(() => result.current.zoomIn())
        act(() => {
            vi.advanceTimersByTime(50)
        })
        act(() => result.current.zoomIn())
        flush()
        expect(visibleMs(result.current.viewport)).toBeCloseTo(
            span / ZOOM_STEP_FACTOR ** 2,
            -3
        )
    })

    it('is instant with reduced motion', () => {
        stubReducedMotion(true)
        const { result } = setup()
        const span = visibleMs(result.current.viewport)
        act(() => result.current.zoomIn())
        expect(result.current.isAnimating).toBe(false)
        expect(visibleMs(result.current.viewport)).toBeCloseTo(
            span / ZOOM_STEP_FACTOR,
            -3
        )
    })

    it('disables zoom at the limits', () => {
        stubReducedMotion(true)
        const { result } = setup()
        for (let i = 0; i < 40 && result.current.canZoomIn; i++)
            act(() => result.current.zoomIn())
        expect(result.current.canZoomIn).toBe(false)
        expect(visibleMs(result.current.viewport)).toBeCloseTo(
            MIN_VISIBLE_MS,
            -3
        )
        for (let i = 0; i < 40 && result.current.canZoomOut; i++)
            act(() => result.current.zoomOut())
        expect(result.current.canZoomOut).toBe(false)
        // Bounds are 200 years, below MAX_VISIBLE_MS: zooming out stops at the bounds.
        expect(visibleMs(result.current.viewport)).toBeCloseTo(
            Math.min(MAX_VISIBLE_MS, bounds.max - bounds.min),
            -3
        )
    })

    it('panBy moves immediately; dragging right shows earlier times', () => {
        const { result } = setup()
        const before = result.current.viewport
        act(() => result.current.panBy(100))
        const shift = (visibleMs(before) / WIDTH) * 100
        expect(result.current.viewport.start).toBeCloseTo(
            before.start - shift,
            -3
        )
    })

    it('momentum glides, stops, and signals gestureEnd once', () => {
        const { result } = setup(50)
        const before = result.current.viewport
        act(() => {
            result.current.beginGesture()
            result.current.panBy(-20)
        })
        expect(result.current.isGesturing).toBe(true)
        act(() => result.current.startMomentum(-1))
        expect(result.current.isGesturing).toBe(true)
        expect(result.current.gestureEnd).toBe(0)
        flush(3000)
        expect(result.current.isGesturing).toBe(false)
        expect(result.current.gestureEnd).toBe(1)
        const glided = result.current.viewport.start - before.start
        // Moved further than the 20 px of the drag itself.
        expect(glided).toBeGreaterThan((visibleMs(before) / WIDTH) * 40)
    })

    it('momentum stops at the bounds', () => {
        const { result } = setup(50)
        act(() => result.current.startMomentum(-50))
        flush(5000)
        expect(result.current.viewport.end).toBeCloseTo(bounds.max, -3)
        expect(result.current.isGesturing).toBe(false)
    })

    it('no momentum with reduced motion', () => {
        stubReducedMotion(true)
        const { result } = setup(50)
        const before = result.current.viewport
        act(() => result.current.startMomentum(-1))
        expect(result.current.isGesturing).toBe(false)
        expect(result.current.viewport).toEqual(before)
    })

    it('pinch zooms in when the fingers spread', () => {
        const { result } = setup()
        const span = visibleMs(result.current.viewport)
        act(() => result.current.pinch([400, 600], [300, 700]))
        expect(visibleMs(result.current.viewport)).toBeCloseTo(span / 2, -3)
    })

    it('zoomToTime centers the given time at the given span', () => {
        const { result } = setup()
        const c = Y2000 - 100 * MS_PER_YEAR
        act(() => result.current.zoomToTime(c, 40 * MS_PER_YEAR))
        flush()
        const v = result.current.viewport
        expect(visibleMs(v)).toBeCloseTo(40 * MS_PER_YEAR, -3)
        expect((v.start + v.end) / 2).toBeCloseTo(c, -3)
    })

    it('keeps the returned object across renders without a state change', () => {
        const { result, rerender } = setup()
        const initialControls = result.current
        rerender()
        expect(result.current).toBe(initialControls)
    })

    it('cancelAnimation stops where it is', () => {
        const { result } = setup()
        act(() => result.current.zoomIn())
        act(() => {
            vi.advanceTimersByTime(100)
        })
        act(() => result.current.cancelAnimation())
        const v = result.current.viewport
        flush()
        expect(result.current.viewport).toEqual(v)
        expect(result.current.isAnimating).toBe(false)
    })
})
