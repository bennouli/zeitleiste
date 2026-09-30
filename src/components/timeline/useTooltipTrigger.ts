'use client'

import { isFocusVisible, isTypingTarget } from '@/lib/dom'
import type { FocusEvent, PointerEvent, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'

const PRESS_FOCUS_WINDOW_MS = 1000

export type TooltipTriggerOptions = {
    tooltipId: string
    /** The element the tooltip belongs to; a tap outside it and the bubble closes a tapped-open tooltip. */
    anchorRef: RefObject<HTMLElement | null>
    /** Touch taps toggle the tooltip through `toggleTouch`. */
    touchToggle?: boolean
}

export function useTooltipTrigger({
    tooltipId,
    anchorRef,
    touchToggle = false,
}: TooltipTriggerOptions) {
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)
    const [touchOpen, setTouchOpen] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const open = (hovered || focused || touchOpen) && !dismissed
    const lastPressAt = useRef<number | null>(null)
    const pressPointerType = useRef<string | null>(null)
    const clickPointerType = useRef<string | null>(null)

    useEffect(() => {
        if (!open) return
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return
            if (isTypingTarget(e.target)) return
            setDismissed(true)
            // This Escape is used up; the shell's window listener must not also close the post.
            e.preventDefault()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    useEffect(() => {
        if (!open || !touchToggle) return
        const onDown = (e: globalThis.PointerEvent) => {
            const target = e.target as Node
            // The open bubble lives in a portal, outside the anchor's DOM.
            if (
                anchorRef.current?.contains(target) ||
                document.getElementById(tooltipId)?.contains(target)
            )
                return
            setTouchOpen(false)
        }
        document.addEventListener('pointerdown', onDown)
        return () => document.removeEventListener('pointerdown', onDown)
    }, [open, touchToggle, anchorRef, tooltipId])

    const triggerProps = {
        onPointerDown: (e: PointerEvent) => {
            lastPressAt.current = e.timeStamp
            pressPointerType.current = e.pointerType
        },
        onPointerCancel: () => {
            lastPressAt.current = null
            pressPointerType.current = null
        },
        onFocus: (e: FocusEvent) => {
            const pressedAt = lastPressAt.current
            lastPressAt.current = null
            if (
                isFocusFromPress(pressedAt, e.timeStamp) ||
                !isFocusVisible(e.currentTarget)
            )
                return
            setFocused(true)
            setDismissed(false)
        },
        onBlur: () => {
            setFocused(false)
            setTouchOpen(false)
        },
        onClickCapture: () => {
            clickPointerType.current = pressPointerType.current
            pressPointerType.current = null
            lastPressAt.current = null
        },
    }

    const hoverProps = {
        onPointerEnter: (e: PointerEvent) => {
            if (e.pointerType === 'touch') return
            setHovered(true)
            setDismissed(false)
        },
        onPointerLeave: (e: PointerEvent) => {
            if (e.pointerType !== 'touch') setHovered(false)
        },
    }

    const dismiss = () => setDismissed(true)

    const toggleTouch = () => {
        if (!touchToggle || clickPointerType.current !== 'touch') return
        setDismissed(false)
        setTouchOpen(!open)
    }

    return { open, triggerProps, hoverProps, dismiss, toggleTouch }
}

function isFocusFromPress(pressedAt: number | null, focusedAt: number) {
    return pressedAt !== null && focusedAt - pressedAt < PRESS_FOCUS_WINDOW_MS
}
