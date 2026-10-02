'use client'

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'

export const NOTES_ASIDE_ID = 'notes'

export type NotesOverlay = {
    /** The notes cover the page below the `lg` breakpoint. */
    open: boolean
    openOverlay: (opener: HTMLElement) => void
    /** `restoreFocus` sends focus back to the opener once the page is interactive again. */
    closeOverlay: (restoreFocus: boolean) => void
    /** The element the last close asked to focus, if any; cleared once taken. */
    takeFocusAfterClose: () => HTMLElement | null
}

const NO_OVERLAY: NotesOverlay = {
    open: false,
    openOverlay: () => {},
    closeOverlay: () => {},
    takeFocusAfterClose: () => null,
}

const NotesOverlayContext = createContext<NotesOverlay>(NO_OVERLAY)

export function NotesOverlayProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false)
    const opener = useRef<HTMLElement | null>(null)
    const focusAfterClose = useRef<HTMLElement | null>(null)

    const openOverlay = useCallback((openerEl: HTMLElement) => {
        opener.current = openerEl
        setOpen(true)
    }, [])

    const closeOverlay = useCallback((restoreFocus: boolean) => {
        focusAfterClose.current = restoreFocus ? opener.current : null
        setOpen(false)
    }, [])

    const takeFocusAfterClose = useCallback(() => {
        const focusTarget = focusAfterClose.current
        focusAfterClose.current = null
        return focusTarget
    }, [])

    const overlay = useMemo(
        () => ({ open, openOverlay, closeOverlay, takeFocusAfterClose }),
        [open, openOverlay, closeOverlay, takeFocusAfterClose]
    )

    return <NotesOverlayContext value={overlay}>{children}</NotesOverlayContext>
}

export function useNotesOverlay(): NotesOverlay {
    return useContext(NotesOverlayContext)
}
