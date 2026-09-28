import { easeInOut } from '@/lib/easing'

export type ScrollTiming = {
    durationMs: number
    maxMs: number
    easing?: (progress: number) => number
}

const USER_INPUT_EVENTS = [
    'wheel',
    'touchstart',
    'pointerdown',
    'keydown',
] as const
const SETTLED_FRAMES = 3
const SETTLED_TOLERANCE_PX = 0.5

export function onUserInput(stop: () => void): () => void {
    for (const type of USER_INPUT_EVENTS)
        window.addEventListener(type, stop, { passive: true })
    return () => {
        for (const type of USER_INPUT_EVENTS)
            window.removeEventListener(type, stop)
    }
}

export function animateScroll(
    target: () => number,
    { durationMs, maxMs, easing = easeInOut }: ScrollTiming
): () => void {
    const startY = window.scrollY
    let startTime: number | null = null
    let lastTarget = NaN
    let settledFrames = 0
    let frame = 0
    const cancel = () => {
        window.cancelAnimationFrame(frame)
        removeInputListeners()
    }
    const removeInputListeners = onUserInput(cancel)
    const step = (now: number) => {
        startTime ??= now
        const elapsed = now - startTime
        const targetY = target()
        const progress = Math.min(1, elapsed / durationMs)
        window.scrollTo({
            top: startY + (targetY - startY) * easing(progress),
            behavior: 'auto',
        })
        const targetHeld =
            progress === 1 &&
            Math.abs(targetY - lastTarget) < SETTLED_TOLERANCE_PX
        settledFrames = targetHeld ? settledFrames + 1 : 0
        lastTarget = targetY
        if (settledFrames >= SETTLED_FRAMES || elapsed >= maxMs) cancel()
        else frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return cancel
}
