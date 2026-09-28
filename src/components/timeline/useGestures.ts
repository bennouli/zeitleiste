'use client'

import { estimateVelocity } from '@/lib/viewport'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import {
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from 'react'
import { DRAG_THRESHOLD_PX, KEY_PAN_FRACTION } from './constants'
import type { ViewportControls } from './useViewport'

type Actions = Pick<
    ViewportControls,
    | 'panBy'
    | 'pinch'
    | 'beginGesture'
    | 'endGesture'
    | 'startMomentum'
    | 'cancelAnimation'
    | 'zoomIn'
    | 'zoomOut'
    | 'panStep'
>

interface PointerInfo {
    x: number
    type: string
}

export interface GestureHandlers {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
    onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void
    onClickCapture: (e: MouseEvent<HTMLElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

export interface Gestures {
    handlers: GestureHandlers
    /** True while a press has turned into a drag or pinch (for the grabbing cursor). */
    isDragging: boolean
    /** True if the last press became a drag; reset on the next press. */
    wasDrag: () => boolean
}

/** Elements with this attribute (e.g. zoom buttons) never start a drag. */
export const NO_DRAG_ATTR = 'data-no-drag'

/**
 * Pointer drag/pinch and keyboard handling for the timeline container.
 * No wheel listener on purpose: wheel scrolls the page, ctrl+wheel zooms the page.
 */
export function useGestures(
    containerRef: RefObject<HTMLElement | null>,
    actions: Actions,
    width: number
): Gestures {
    const pointers = useRef(new Map<number, PointerInfo>())
    const mode = useRef<'idle' | 'press' | 'drag' | 'pinch'>('idle')
    const startY = useRef(0)
    const startX = useRef(0)
    const lastX = useRef(0)
    const samples = useRef<{ x: number; t: number }[]>([])
    const dragged = useRef(false)
    const [isDragging, setIsDragging] = useState(false)
    const finishRef = useRef<
        (e: PointerEvent<HTMLElement>, cancelled: boolean) => void
    >(() => {})

    const localX = useCallback(
        (clientX: number) =>
            clientX - (containerRef.current?.getBoundingClientRect().left ?? 0),
        [containerRef]
    )

    const capture = useCallback(
        (id: number) => {
            try {
                containerRef.current?.setPointerCapture?.(id)
            } catch {
                // pointer already gone
            }
        },
        [containerRef]
    )

    const pinchPair = useCallback((): [number, number] | null => {
        const list = [...pointers.current.values()]
        if (list.length < 2) return null
        return [list[0]!.x, list[1]!.x]
    }, [])

    const onPointerDown = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            if (e.button !== 0) return
            if (
                e.target instanceof Element &&
                e.target.closest(`[${NO_DRAG_ATTR}]`)
            )
                return
            const x = localX(e.clientX)
            const map = pointers.current
            // Drop state from a press whose release we never saw (released outside the window, lost capture).
            // A primary touch means no other touch is active, so anything left over is stale.
            if (
                map.has(e.pointerId) ||
                (map.size > 0 && (e.pointerType !== 'touch' || e.isPrimary))
            ) {
                map.clear()
                if (mode.current === 'drag' || mode.current === 'pinch')
                    actions.endGesture()
                mode.current = 'idle'
                setIsDragging(false)
            }
            if (map.size === 0) {
                dragged.current = false
                // A press stops a running glide or animation.
                actions.cancelAnimation()
                map.set(e.pointerId, { x, type: e.pointerType })
                mode.current = 'press'
                startX.current = x
                startY.current = e.clientY
                lastX.current = x
                samples.current = [{ x, t: performance.now() }]
                return
            }
            const first = [...map.values()][0]
            if (
                map.size === 1 &&
                e.pointerType === 'touch' &&
                first?.type === 'touch'
            ) {
                map.set(e.pointerId, { x, type: e.pointerType })
                if (mode.current !== 'drag') actions.beginGesture()
                mode.current = 'pinch'
                dragged.current = true
                setIsDragging(true)
                for (const id of map.keys()) capture(id)
            }
        },
        [actions, capture, localX]
    )

    const onPointerMove = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            const map = pointers.current
            const p = map.get(e.pointerId)
            if (!p) return
            if (mode.current === 'idle') return
            if (e.pointerType === 'mouse' && e.buttons === 0) {
                // The button was released without a pointerup reaching us.
                finishRef.current(e, true)
                return
            }
            const x = localX(e.clientX)
            if (mode.current === 'pinch') {
                const prev = pinchPair()
                p.x = x
                const next = pinchPair()
                if (prev && next) actions.pinch(prev, next)
                return
            }
            p.x = x
            if (mode.current === 'press') {
                const dx = Math.abs(x - startX.current)
                const dy = Math.abs(e.clientY - startY.current)
                // Axis lock for touch: a mostly vertical swipe scrolls the page or steps a group stack.
                // The pointer stays known so a second finger can still start a pinch.
                if (
                    e.pointerType === 'touch' &&
                    dy >= DRAG_THRESHOLD_PX &&
                    dy > dx
                ) {
                    mode.current = 'idle'
                    return
                }
                if (dx < DRAG_THRESHOLD_PX) return
                mode.current = 'drag'
                dragged.current = true
                setIsDragging(true)
                actions.beginGesture()
                capture(e.pointerId)
            }
            if (mode.current === 'drag') {
                actions.panBy(x - lastX.current)
                lastX.current = x
                samples.current.push({ x, t: performance.now() })
                if (samples.current.length > 20) samples.current.shift()
            }
        },
        [actions, capture, localX, pinchPair]
    )

    const onLostPointerCapture = useCallback((e: PointerEvent<HTMLElement>) => {
        // Only the container's own capture matters; a card losing its implicit touch capture is normal.
        if (e.target !== e.currentTarget) return
        finishRef.current(e, true)
    }, [])

    const finish = useCallback(
        (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
            const map = pointers.current
            if (!map.has(e.pointerId)) return
            map.delete(e.pointerId)
            try {
                containerRef.current?.releasePointerCapture?.(e.pointerId)
            } catch {
                // not captured
            }
            if (mode.current === 'pinch') {
                const rest = [...map.values()][0]
                if (map.size === 1 && rest) {
                    // One finger left: continue as a drag with it.
                    mode.current = 'drag'
                    lastX.current = rest.x
                    samples.current = [{ x: rest.x, t: performance.now() }]
                    return
                }
                if (map.size > 0) return
                // Lifting the last finger after a pinch: no momentum.
                mode.current = 'idle'
                setTimeout(() => {
                    if (pointers.current.size === 0) dragged.current = false
                }, 0)
                setIsDragging(false)
                actions.endGesture()
                return
            }
            const wasDragging = mode.current === 'drag'
            mode.current = 'idle'
            if (dragged.current) {
                // The click that follows this release must still see the drag; later (keyboard) clicks must not.
                setTimeout(() => {
                    if (pointers.current.size === 0) dragged.current = false
                }, 0)
            }
            setIsDragging(false)
            if (!wasDragging) return
            if (cancelled) {
                actions.endGesture()
                return
            }
            const x = localX(e.clientX)
            samples.current.push({ x, t: performance.now() })
            actions.startMomentum(estimateVelocity(samples.current))
        },
        [actions, containerRef, localX]
    )

    useLayoutEffect(() => {
        finishRef.current = finish
    })

    const onPointerUp = useCallback(
        (e: PointerEvent<HTMLElement>) => finish(e, false),
        [finish]
    )
    const onPointerCancel = useCallback(
        (e: PointerEvent<HTMLElement>) => finish(e, true),
        [finish]
    )

    const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
        if (dragged.current) {
            e.stopPropagation()
            e.preventDefault()
        }
    }, [])

    const onKeyDown = useCallback(
        (e: KeyboardEvent<HTMLElement>) => {
            // Ctrl/Cmd +/- is the browser's page zoom; leave it alone.
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
            // Keys typed into a form control (the prototype <select>s) belong to it.
            const t = e.target
            if (
                t instanceof HTMLElement &&
                (t.isContentEditable ||
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
            )
                return
            dragged.current = false
            const step = Math.max(1, width) * KEY_PAN_FRACTION
            switch (e.key) {
                case '+':
                case '=':
                    actions.zoomIn()
                    break
                case '-':
                    actions.zoomOut()
                    break
                case 'ArrowLeft':
                    actions.panStep(step)
                    break
                case 'ArrowRight':
                    actions.panStep(-step)
                    break
                default:
                    return
            }
            e.preventDefault()
        },
        [actions, width]
    )

    const wasDrag = useCallback(() => dragged.current, [])

    return {
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onLostPointerCapture,
            onClickCapture,
            onKeyDown,
        },
        isDragging,
        wasDrag,
    }
}
