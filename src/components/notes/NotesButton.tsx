'use client'

import { useI18n } from '@/components/I18nContext'
import { NO_DRAG_ATTR } from '@/components/timeline/useGestures'
import { NotebookPen } from 'lucide-react'
import { useNotes } from './NotesContext'
import { NOTES_ASIDE_ID, useNotesOverlay } from './NotesOverlayContext'
import { LARGE_ICON_BUTTON_CLASS } from './noteStyles'

/** The top-bar button that opens the notes over the page, below the breakpoint where the sidebar shows. */
export function NotesButton() {
    const { t } = useI18n()
    const { signedIn } = useNotes()
    const { open, openOverlay } = useNotesOverlay()

    if (!signedIn) return null

    return (
        <button
            type="button"
            aria-label={t.notes.open}
            aria-expanded={open}
            aria-controls={NOTES_ASIDE_ID}
            onClick={(e) => openOverlay(e.currentTarget)}
            title={t.notes.open}
            className={`pointer-events-auto self-center lg:hidden ${LARGE_ICON_BUTTON_CLASS}`}
            {...{ [NO_DRAG_ATTR]: '' }}
        >
            <NotebookPen
                aria-hidden="true"
                className="size-full"
                strokeWidth={1.25}
            />
        </button>
    )
}
