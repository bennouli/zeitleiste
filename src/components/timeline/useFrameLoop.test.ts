import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFrameLoop, type FrameStatus } from './useFrameLoop'

const FRAME_MS = 16

beforeEach(() => {
    vi.useFakeTimers({
        toFake: [
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'performance',
        ],
    })
})
afterEach(() => {
    vi.useRealTimers()
})

function advanceFrames(count: number) {
    act(() => {
        vi.advanceTimersByTime(count * FRAME_MS)
    })
}

function frameDoneAfter(callCount: number) {
    let calls = 0
    return vi.fn<(now: number) => FrameStatus>(() =>
        ++calls < callCount ? 'continue' : 'done'
    )
}

describe('useFrameLoop', () => {
    it('calls the frame each animation frame until it returns done, then onDone once', () => {
        const { result } = renderHook(() => useFrameLoop())
        const frame = frameDoneAfter(3)
        const onDone = vi.fn()

        act(() => result.current.run(frame, onDone))
        expect(result.current.isRunning()).toBe(true)
        expect(frame).not.toHaveBeenCalled()

        advanceFrames(10)
        expect(frame).toHaveBeenCalledTimes(3)
        expect(onDone).toHaveBeenCalledTimes(1)
        expect(result.current.isRunning()).toBe(false)
    })

    it('passes the frame timestamp', () => {
        const { result } = renderHook(() => useFrameLoop())
        const frame = frameDoneAfter(2)

        act(() => result.current.run(frame))
        advanceFrames(5)

        const [first, second] = frame.mock.calls.map(([now]) => now)
        expect(second! - first!).toBeCloseTo(FRAME_MS, 0)
    })

    it('stop cancels the loop without calling onDone', () => {
        const { result } = renderHook(() => useFrameLoop())
        const frame = frameDoneAfter(Infinity)
        const onDone = vi.fn()

        act(() => result.current.run(frame, onDone))
        advanceFrames(2)
        const callsBeforeStop = frame.mock.calls.length
        act(() => result.current.stop())
        advanceFrames(5)

        expect(frame).toHaveBeenCalledTimes(callsBeforeStop)
        expect(onDone).not.toHaveBeenCalled()
        expect(result.current.isRunning()).toBe(false)
    })

    it('run replaces a running loop without finishing it', () => {
        const { result } = renderHook(() => useFrameLoop())
        const firstFrame = frameDoneAfter(Infinity)
        const firstOnDone = vi.fn()
        const secondFrame = frameDoneAfter(1)

        act(() => result.current.run(firstFrame, firstOnDone))
        advanceFrames(1)
        const firstCalls = firstFrame.mock.calls.length
        act(() => result.current.run(secondFrame))
        advanceFrames(5)

        expect(firstFrame).toHaveBeenCalledTimes(firstCalls)
        expect(firstOnDone).not.toHaveBeenCalled()
        expect(secondFrame).toHaveBeenCalledTimes(1)
    })

    it('stops on unmount', () => {
        const { result, unmount } = renderHook(() => useFrameLoop())
        const frame = frameDoneAfter(Infinity)

        act(() => result.current.run(frame))
        unmount()
        advanceFrames(5)

        expect(frame).not.toHaveBeenCalled()
    })

    it('keeps its identity across renders', () => {
        const { result, rerender } = renderHook(() => useFrameLoop())
        const initialLoop = result.current

        rerender()

        expect(result.current).toBe(initialLoop)
    })
})
