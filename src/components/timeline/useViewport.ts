'use client'

import { prefersReducedMotion } from '@/lib/dom'
import {
    canZoomIn as canZoomInVp,
    canZoomOut as canZoomOutVp,
    clampViewport,
    initialViewport,
    panBy as panByVp,
    pinch as pinchVp,
    stepMomentum,
    tweenViewport,
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
import { ZOOM_ANIMATION_MS } from './constants'
import { useFrameLoop } from './useFrameLoop'

const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect

const FIRST_MOMENTUM_FRAME_MS = 16

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
    /** Keeps its identity across renders. */
    actions: ViewportActions
}

export type ViewportActions = {
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
    const [storedViewport, setStoredViewport] = useState<Viewport | null>(null)
    const [isAnimating, setIsAnimating] = useState(false)
    const [isInteracting, setIsInteracting] = useState(false)
    const [gestureEnd, setGestureEnd] = useState(0)

    const viewport = useMemo(
        () =>
            clampViewport(
                storedViewport ?? initial ?? initialViewport(bounds),
                bounds
            ),
        [storedViewport, initial, bounds]
    )

    const latest = useRef({ viewport, bounds, width })
    const settledRef = useRef(viewport)
    /** Target of the running animation, so repeated clicks build on it. */
    const targetRef = useRef<Viewport | null>(null)
    const frameLoop = useFrameLoop()

    useIsomorphicLayoutEffect(() => {
        latest.current = { viewport, bounds, width }
    })

    const commit = useCallback((vp: Viewport) => {
        latest.current.viewport = vp
        setStoredViewport(vp)
    }, [])

    const settle = useCallback(() => {
        if (viewportEquals(latest.current.viewport, settledRef.current)) return
        settledRef.current = latest.current.viewport
        setGestureEnd((n) => n + 1)
    }, [])

    const stopMotion = useCallback(() => {
        frameLoop.stop()
        targetRef.current = null
    }, [frameLoop])

    const cancelAnimation = useCallback(() => {
        const wasRunning = frameLoop.isRunning()
        stopMotion()
        if (!wasRunning) return
        setIsAnimating(false)
        setIsInteracting(false)
        settle()
    }, [frameLoop, stopMotion, settle])

    const animateTo = useCallback(
        (target: Viewport, animate = true) => {
            stopMotion()
            const from = latest.current.viewport
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
            let startedAt: number | null = null
            frameLoop.run(
                (now) => {
                    startedAt ??= now
                    const tween = tweenViewport(
                        from,
                        target,
                        now - startedAt,
                        ZOOM_ANIMATION_MS
                    )
                    commit(tween.vp)
                    return tween.done ? 'done' : 'continue'
                },
                () => {
                    targetRef.current = null
                    setIsAnimating(false)
                    settle()
                }
            )
        },
        [frameLoop, commit, settle, stopMotion]
    )

    const animationBase = useCallback(
        () => targetRef.current ?? latest.current.viewport,
        []
    )

    const zoomBy = useCallback(
        (factor: number) => {
            animateTo(
                zoomAround(
                    animationBase(),
                    latest.current.width,
                    latest.current.width / 2,
                    factor,
                    latest.current.bounds
                )
            )
        },
        [animateTo, animationBase]
    )

    const zoomIn = useCallback(() => zoomBy(ZOOM_STEP_FACTOR), [zoomBy])
    const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP_FACTOR), [zoomBy])

    const zoomToTime = useCallback(
        (centerT: number, spanMs: number, opts?: { animate?: boolean }) => {
            animateTo(
                zoomTo(centerT, spanMs, latest.current.bounds),
                opts?.animate ?? true
            )
        },
        [animateTo]
    )

    const panStep = useCallback(
        (dx: number) =>
            animateTo(
                panByVp(
                    animationBase(),
                    latest.current.width,
                    dx,
                    latest.current.bounds
                )
            ),
        [animateTo, animationBase]
    )

    const panBy = useCallback(
        (dx: number) => {
            if (targetRef.current) stopMotion()
            commit(
                panByVp(
                    latest.current.viewport,
                    latest.current.width,
                    dx,
                    latest.current.bounds
                )
            )
        },
        [commit, stopMotion]
    )

    const pinch = useCallback(
        (prev: readonly [number, number], next: readonly [number, number]) => {
            if (targetRef.current) stopMotion()
            commit(
                pinchVp(
                    latest.current.viewport,
                    latest.current.width,
                    prev,
                    next,
                    latest.current.bounds
                )
            )
        },
        [commit, stopMotion]
    )

    const beginGesture = useCallback(() => {
        stopMotion()
        setIsAnimating(false)
        setIsInteracting(true)
    }, [stopMotion])

    const endGesture = useCallback(() => {
        stopMotion()
        setIsInteracting(false)
        settle()
    }, [stopMotion, settle])

    const startMomentum = useCallback(
        (velocityPxPerMs: number) => {
            stopMotion()
            if (
                prefersReducedMotion() ||
                !Number.isFinite(velocityPxPerMs) ||
                velocityPxPerMs === 0
            ) {
                setIsInteracting(false)
                settle()
                return
            }
            setIsInteracting(true)
            let momentum = { vp: latest.current.viewport, velocityPxPerMs }
            let lastFrameAt: number | null = null
            frameLoop.run(
                (now) => {
                    const dt =
                        lastFrameAt === null
                            ? FIRST_MOMENTUM_FRAME_MS
                            : now - lastFrameAt
                    lastFrameAt = now
                    const step = stepMomentum(
                        momentum,
                        dt,
                        latest.current.width,
                        latest.current.bounds
                    )
                    momentum = step.next
                    commit(momentum.vp)
                    return step.done ? 'done' : 'continue'
                },
                () => {
                    setIsInteracting(false)
                    settle()
                }
            )
        },
        [frameLoop, commit, settle, stopMotion]
    )

    const actions = useMemo<ViewportActions>(
        () => ({
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
        }),
        [
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
        ]
    )

    return {
        viewport,
        isAnimating,
        isGesturing: isInteracting || isAnimating,
        canZoomIn: canZoomInVp(viewport),
        canZoomOut: canZoomOutVp(viewport, bounds),
        gestureEnd,
        actions,
    }
}
