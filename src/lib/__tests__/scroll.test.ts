import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animateScroll, PRIVATE_UNDER_TESTS } from '../scroll'

const { onUserInput } = PRIVATE_UNDER_TESTS

type FrameCallback = (now: number) => void

let pendingFrames: Map<number, FrameCallback>
let nextFrameId: number

function runFrame(now: number) {
    const callbacks = [...pendingFrames.values()]
    pendingFrames.clear()
    for (const callback of callbacks) callback(now)
}

function scrolledTops(): number[] {
    return vi
        .mocked(window.scrollTo)
        .mock.calls.map(([options]) => (options as ScrollToOptions).top!)
}

beforeEach(() => {
    pendingFrames = new Map()
    nextFrameId = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
        const id = nextFrameId++
        pendingFrames.set(id, callback)
        return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        pendingFrames.delete(id)
    })
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('onUserInput', () => {
    it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
        'calls stop on %s',
        (type) => {
            const stop = vi.fn()
            const remove = onUserInput(stop)
            window.dispatchEvent(new Event(type))
            remove()
            expect(stop).toHaveBeenCalledTimes(1)
        }
    )

    it('stops listening once removed', () => {
        const stop = vi.fn()
        const remove = onUserInput(stop)
        remove()
        window.dispatchEvent(new Event('wheel'))
        expect(stop).not.toHaveBeenCalled()
    })
})

describe('animateScroll', () => {
    const timing = { durationMs: 100, maxMs: 1000, easing: (p: number) => p }

    it('eases from the current position to the target over the duration', () => {
        const target = () => 200
        animateScroll(target, timing)
        runFrame(0)
        runFrame(50)
        runFrame(100)
        expect(scrolledTops()).toEqual([0, 100, 200])
    })

    it('stops after the target has held still for three frames at the end', () => {
        const target = () => 200
        animateScroll(target, timing)
        for (const now of [0, 100, 116, 132, 148, 164]) runFrame(now)
        expect(scrolledTops()).toHaveLength(4)
        expect(pendingFrames.size).toBe(0)
    })

    it('follows a moving target past the duration', () => {
        const targets = [100, 150, 200, 200, 200, 200]
        const target = () => targets.shift() ?? 200
        animateScroll(target, timing)
        for (const now of [0, 100, 116, 132, 148, 164, 180]) runFrame(now)
        expect(scrolledTops()).toEqual([0, 150, 200, 200, 200, 200])
        expect(pendingFrames.size).toBe(0)
    })

    it('gives up after maxMs even if the target keeps moving', () => {
        let targetY = 100
        const target = () => (targetY += 10)
        animateScroll(target, timing)
        runFrame(0)
        runFrame(999)
        expect(pendingFrames.size).toBe(1)
        runFrame(1000)
        expect(pendingFrames.size).toBe(0)
    })

    it('uses easeInOut by default', () => {
        const target = () => 200
        const defaultEasingTiming = { durationMs: 100, maxMs: 1000 }
        animateScroll(target, defaultEasingTiming)
        runFrame(0)
        runFrame(25)
        expect(scrolledTops()).toEqual([0, 25])
    })

    it('cancels the pending frame and the input listeners', () => {
        const target = () => 200
        const cancel = animateScroll(target, timing)
        const removeListener = vi.spyOn(window, 'removeEventListener')
        cancel()
        expect(pendingFrames.size).toBe(0)
        expect(removeListener).toHaveBeenCalledTimes(4)
    })

    it('stops on user input', () => {
        const target = () => 200
        animateScroll(target, timing)
        runFrame(0)
        window.dispatchEvent(new Event('wheel'))
        runFrame(50)
        expect(scrolledTops()).toEqual([0])
    })
})
