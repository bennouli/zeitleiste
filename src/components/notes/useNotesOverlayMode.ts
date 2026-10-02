'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import { inertOutside } from './inertOutside'
import { useNotesOverlay } from './NotesOverlayContext'

type OverlayElements = {
    asideRef: RefObject<HTMLElement | null>
    focusOnOpenRef: RefObject<HTMLElement | null>
    focusWhenPanelHidesRef: RefObject<HTMLElement | null>
}

/** While the notes cover the page: the rest is inert, focus is inside, and widening to the sidebar ends the overlay without losing focus. */
export function useNotesOverlayMode({
    asideRef,
    focusOnOpenRef,
    focusWhenPanelHidesRef,
}: OverlayElements) {
    const { open, closeOverlay, takeFocusAfterClose } = useNotesOverlay()
    const wasOpen = useRef(false)

    useLayoutEffect(() => {
        const aside = asideRef.current
        if (!open || !aside) return
        const restoreInteractivity = inertOutside(aside)
        focusOnOpenRef.current?.focus()
        const closeOnceSidebar = () => {
            if (!isOverlay(aside)) closeOverlay(false)
        }
        window.addEventListener('resize', closeOnceSidebar)
        return () => {
            window.removeEventListener('resize', closeOnceSidebar)
            restoreInteractivity()
        }
    }, [open, asideRef, focusOnOpenRef, closeOverlay])

    useLayoutEffect(() => {
        if (open) {
            wasOpen.current = true
            return
        }
        if (!wasOpen.current) return
        wasOpen.current = false
        const focusTarget = takeFocusAfterClose()
        if (focusTarget) focusTarget.focus()
        else if (hasLostFocus()) focusWhenPanelHidesRef.current?.focus()
    }, [open, takeFocusAfterClose, focusWhenPanelHidesRef])
}

function hasLostFocus(): boolean {
    const focused = document.activeElement
    return (
        !focused ||
        focused === document.body ||
        focused.closest('[hidden]') !== null
    )
}

function isOverlay(aside: HTMLElement): boolean {
    return getComputedStyle(aside).position === 'fixed'
}
