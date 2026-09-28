'use client'

import { prefersReducedMotion } from '@/lib/dom'
import { easeOutCubic } from '@/lib/easing'
import {
    canZoomIn as canZoomInVp,
    canZoomOut as canZoomOutVp,
    clampViewport,
    initialViewport,
    interpolateViewport,
    panBy as panByVp,
    pinch as pinchVp,
    stepMomentum,
    viewportEquals,
    ZOOM_STEP_FACTOR,
    zoomAround,
    zoomTo,
    type Bounds,
    type Viewport,
} from '@/lib/viewport'
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { ANIMATION_MS } from './constants'

// useLayoutEffect warns during SSR; refs only matter on the client.
const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect

export type UseViewportOptions = {
    bounds: Bounds
    width: number
    /** Defaults to initialViewport(bounds). */
    initial?: Viewport
}

export type ViewportControls = {
    viewport: Viewport
    isAnimating: boolean
    /** True while a drag/pinch, momentum or animation runs. */
    isGesturing: boolean
    canZoomIn: boolean
    canZoomOut: boolean
    /** Increments each time the viewport settles after a gesture, momentum or animation. */
    gestureEnd: number
    zoomIn: () => void
    zoomOut: () => void
    /** Animated (instant with reduced motion or `animate: false`). */
    zoomToTime: (
        centerT: number,
        spanMs: number,
        opts?: { animate?: boolean }
    ) => void
    /** Animated pan by dx px (keyboard). */
    panStep: (dx: number) => void
    /** Immediate pan during a drag. */
    panBy: (dx: number) => void
    /** Immediate pinch; x positions relative to the container. */
    pinch: (
        prev: readonly [number, number],
        next: readonly [number, number]
    ) => void
    /** Marks the start of a drag/pinch (stops animations). */
    beginGesture: () => void
    /** Ends a drag/pinch without momentum. */
    endGesture: () => void
    /** Ends a drag with momentum; px/ms. Without motion (reduced) it ends immediately. */
    startMomentum: (velocityPxPerMs: number) => void
    /** Stops any running animation or momentum where it is. */
    cancelAnimation: () => void
}

export function useViewport({
    bounds,
    width,
    initial,
}: UseViewportOptions): ViewportControls {
    const [raw, setRaw] = useState<Viewport>(
        () => initial ?? initialViewport(bounds)
    )
    const [isAnimating, setIsAnimating] = useState(false)
    const [gesturing, setGesturing] = useState(false)
    const [gestureEnd, setGestureEnd] = useState(0)

    // Re-clamping on bounds changes is derived, not synced.
    const viewport = useMemo(() => clampViewport(raw, bounds), [raw, bounds])

    const vpRef = useRef(viewport)
    const boundsRef = useRef(bounds)
    const widthRef = useRef(width)
    const settledRef = useRef(viewport)
    const rafRef = useRef<number | null>(null)
    /** Target of the running animation, so repeated clicks build on it. */
    const targetRef = useRef<Viewport | null>(null)

    useIsomorphicLayoutEffect(() => {
        boundsRef.current = bounds
        widthRef.current = width
        vpRef.current = viewport
    })

    const commit = useCallback((vp: Viewport) => {
        vpRef.current = vp
        setRaw(vp)
    }, [])

    const settle = useCallback(() => {
        if (viewportEquals(vpRef.current, settledRef.current)) return
        settledRef.current = vpRef.current
        setGestureEnd((n) => n + 1)
    }, [])

    const stopRaf = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        targetRef.current = null
    }, [])

    const cancelAnimation = useCallback(() => {
        const wasRunning = rafRef.current !== null
        stopRaf()
        if (wasRunning) {
            setIsAnimating(false)
            setGesturing(false)
            settle()
        }
    }, [stopRaf, settle])

    useEffect(() => stopRaf, [stopRaf])

    const animateTo = useCallback(
        (target: Viewport, animate = true) => {
            stopRaf()
            const from = vpRef.current
            if (
                !animate ||
                prefersReducedMotion() ||
                viewportEquals(from, target)
            ) {
                commit(target)
                setIsAnimating(false)
                settle()
                return
            }
            targetRef.current = target
            setIsAnimating(true)
            let t0: number | null = null
            const frame = (now: number) => {
                if (t0 === null) t0 = now
                const p = Math.min(1, (now - t0) / ANIMATION_MS)
                commit(interpolateViewport(from, target, easeOutCubic(p)))
                if (p < 1) {
                    rafRef.current = requestAnimationFrame(frame)
                } else {
                    rafRef.current = null
                    targetRef.current = null
                    commit(target)
                    setIsAnimating(false)
                    settle()
                }
            }
            rafRef.current = requestAnimationFrame(frame)
        },
        [commit, settle, stopRaf]
    )

    const base = useCallback(() => targetRef.current ?? vpRef.current, [])

    const zoomBy = useCallback(
        (factor: number) => {
            const w = widthRef.current
            animateTo(zoomAround(base(), w, w / 2, factor, boundsRef.current))
        },
        [animateTo, base]
    )

    const zoomIn = useCallback(() => zoomBy(ZOOM_STEP_FACTOR), [zoomBy])
    const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP_FACTOR), [zoomBy])

    const zoomToTime = useCallback(
        (centerT: number, spanMs: number, opts?: { animate?: boolean }) => {
            animateTo(
                zoomTo(centerT, spanMs, boundsRef.current),
                opts?.animate ?? true
            )
        },
        [animateTo]
    )

    const panStep = useCallback(
        (dx: number) =>
            animateTo(panByVp(base(), widthRef.current, dx, boundsRef.current)),
        [animateTo, base]
    )

    const panBy = useCallback(
        (dx: number) => {
            if (targetRef.current) stopRaf()
            commit(
                panByVp(vpRef.current, widthRef.current, dx, boundsRef.current)
            )
        },
        [commit, stopRaf]
    )

    const pinch = useCallback(
        (prev: readonly [number, number], next: readonly [number, number]) => {
            if (targetRef.current) stopRaf()
            commit(
                pinchVp(
                    vpRef.current,
                    widthRef.current,
                    prev,
                    next,
                    boundsRef.current
                )
            )
        },
        [commit, stopRaf]
    )

    const beginGesture = useCallback(() => {
        stopRaf()
        setIsAnimating(false)
        setGesturing(true)
    }, [stopRaf])

    const endGesture = useCallback(() => {
        stopRaf()
        setGesturing(false)
        settle()
    }, [stopRaf, settle])

    const startMomentum = useCallback(
        (velocityPxPerMs: number) => {
            stopRaf()
            if (
                prefersReducedMotion() ||
                !Number.isFinite(velocityPxPerMs) ||
                velocityPxPerMs === 0
            ) {
                setGesturing(false)
                settle()
                return
            }
            setGesturing(true)
            let m = { vp: vpRef.current, velocityPxPerMs }
            let last: number | null = null
            const frame = (now: number) => {
                const dt = last === null ? 16 : now - last
                last = now
                const { next, done } = stepMomentum(
                    m,
                    dt,
                    widthRef.current,
                    boundsRef.current
                )
                m = next
                commit(next.vp)
                if (done) {
                    rafRef.current = null
                    setGesturing(false)
                    settle()
                } else {
                    rafRef.current = requestAnimationFrame(frame)
                }
            }
            rafRef.current = requestAnimationFrame(frame)
        },
        [commit, settle, stopRaf]
    )

    return {
        viewport,
        isAnimating,
        isGesturing: gesturing || isAnimating,
        canZoomIn: canZoomInVp(viewport),
        canZoomOut: canZoomOutVp(viewport, bounds),
        gestureEnd,
        zoomIn,
        zoomOut,
        zoomToTime,
        panStep,
        panBy,
        pinch,
        beginGesture,
        endGesture,
        startMomentum,
        cancelAnimation,
    }
}
