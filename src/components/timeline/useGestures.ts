'use client'

import { isTypingTarget } from '@/lib/dom'
import {
    clearDrag,
    initialGestureState,
    isGrabbing,
    pointerDown,
    pointerEnd,
    pointerMove,
    wheelIntent,
    type GestureEffect,
    type GestureState,
    type GestureTransition,
    type PointerSample,
} from '@/lib/gesture'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { KEY_PAN_FRACTION } from './constants'
import type { ViewportActions } from './useViewport'

type GestureActions = Pick<
    ViewportActions,
    | 'panBy'
    | 'pinch'
    | 'wheelZoom'
    | 'beginGesture'
    | 'endGesture'
    | 'startMomentum'
    | 'cancelAnimation'
    | 'zoomIn'
    | 'zoomOut'
    | 'panStep'
>

export type GestureHandlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
    onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void
    onClickCapture: (e: MouseEvent<HTMLElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

export type Gestures = {
    handlers: GestureHandlers
    /** True while a press has turned into a drag or pinch (for the grabbing cursor). */
    isDragging: boolean
    /** True if the last press became a drag; reset on the next press. */
    wasDrag: () => boolean
}

/** Elements with this attribute (e.g. zoom buttons) never start a drag. */
export const NO_DRAG_ATTR = 'data-no-drag'

/** Quiet time after the last wheel event before the wheel gesture ends and the layout settles. */
const WHEEL_SETTLE_MS = 150

/** Pointer drag/pinch, wheel zoom/pan and keyboard handling for the timeline container. */
export function useGestures(
    containerRef: RefObject<HTMLElement | null>,
    actions: GestureActions,
    width: number
): Gestures {
    const gesture = useRef<GestureState>(initialGestureState)
    const [isDragging, setIsDragging] = useState(false)
    useWheelGesture(containerRef, actions)

    const toSample = useCallback(
        (e: PointerEvent<HTMLElement>): PointerSample => ({
            id: e.pointerId,
            x:
                e.clientX -
                (containerRef.current?.getBoundingClientRect().left ?? 0),
            y: e.clientY,
            type: e.pointerType,
            isPrimary: e.isPrimary,
            buttons: e.buttons,
            t: performance.now(),
        }),
        [containerRef]
    )

    const applyEffect = useCallback(
        (effect: GestureEffect) => {
            const container = containerRef.current
            switch (effect.type) {
                case 'beginGesture':
                    return actions.beginGesture()
                case 'endGesture':
                    return actions.endGesture()
                case 'cancelAnimation':
                    return actions.cancelAnimation()
                case 'panBy':
                    return actions.panBy(effect.dx)
                case 'pinch':
                    return actions.pinch(effect.prev, effect.next)
                case 'startMomentum':
                    return actions.startMomentum(effect.velocity)
                case 'capture':
                    try {
                        container?.setPointerCapture?.(effect.id)
                    } catch {
                        // pointer already gone
                    }
                    return
                case 'release':
                    try {
                        container?.releasePointerCapture?.(effect.id)
                    } catch {
                        // not captured
                    }
                    return
                case 'clearDragAfterClick':
                    setTimeout(() => {
                        gesture.current = clearDrag(gesture.current)
                    }, 0)
                    return
            }
        },
        [actions, containerRef]
    )

    const dispatch = useCallback(
        ({ state, effects }: GestureTransition) => {
            gesture.current = state
            effects.forEach(applyEffect)
            setIsDragging(isGrabbing(state))
        },
        [applyEffect]
    )

    const onPointerDown = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            if (e.button !== 0) return
            if (
                e.target instanceof Element &&
                e.target.closest(`[${NO_DRAG_ATTR}]`)
            )
                return
            dispatch(pointerDown(gesture.current, toSample(e)))
        },
        [dispatch, toSample]
    )

    const onPointerMove = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            const isTracked = gesture.current.pointers.has(e.pointerId)
            if (isTracked) dispatch(pointerMove(gesture.current, toSample(e)))
        },
        [dispatch, toSample]
    )

    const onPointerUp = useCallback(
        (e: PointerEvent<HTMLElement>) =>
            dispatch(pointerEnd(gesture.current, toSample(e), false)),
        [dispatch, toSample]
    )

    const onPointerCancel = useCallback(
        (e: PointerEvent<HTMLElement>) =>
            dispatch(pointerEnd(gesture.current, toSample(e), true)),
        [dispatch, toSample]
    )

    const onLostPointerCapture = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            const isContainerCapture = e.target === e.currentTarget
            if (!isContainerCapture) return
            dispatch(pointerEnd(gesture.current, toSample(e), true))
        },
        [dispatch, toSample]
    )

    const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
        if (!gesture.current.dragged) return
        e.stopPropagation()
        e.preventDefault()
    }, [])

    const onKeyDown = useCallback(
        (e: KeyboardEvent<HTMLElement>) => {
            const isBrowserShortcut = e.ctrlKey || e.metaKey || e.altKey
            if (e.defaultPrevented || isBrowserShortcut) return
            if (isTypingTarget(e.target)) return
            gesture.current = { ...gesture.current, dragged: false }
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

    const wasDrag = useCallback(() => gesture.current.dragged, [])

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

/**
 * Wheel over the container zooms or pans (see `wheelIntent`). Attached
 * natively: React's `onWheel` is passive and cannot prevent the page scroll.
 */
function useWheelGesture(
    containerRef: RefObject<HTMLElement | null>,
    actions: GestureActions
) {
    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        let settleTimer: ReturnType<typeof setTimeout> | null = null
        const endWheelGesture = () => {
            settleTimer = null
            actions.endGesture()
        }
        const onWheel = (e: WheelEvent) => {
            const intent = wheelIntent(e, container.clientWidth)
            if (intent.type === 'browser') return
            e.preventDefault()
            if (settleTimer === null) actions.beginGesture()
            else clearTimeout(settleTimer)
            if (intent.type === 'pan') actions.panBy(-intent.deltaPx)
            else
                actions.wheelZoom(
                    e.clientX - container.getBoundingClientRect().left,
                    intent.deltaPx
                )
            settleTimer = setTimeout(endWheelGesture, WHEEL_SETTLE_MS)
        }
        container.addEventListener('wheel', onWheel, { passive: false })
        return () => {
            container.removeEventListener('wheel', onWheel)
            if (settleTimer === null) return
            clearTimeout(settleTimer)
            endWheelGesture()
        }
    }, [containerRef, actions])
}

export const PRIVATE_UNDER_TESTS = {
    WHEEL_SETTLE_MS,
}
