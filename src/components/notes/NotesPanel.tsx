'use client'

import { useI18n } from '@/components/I18nContext'
import { useRef } from 'react'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { useNotes } from './NotesContext'

/** The signed-in user's notes: an editor for a new one, then the list. No chrome. */
export function NotesPanel() {
    const { t } = useI18n()
    const { notes, failure, create } = useNotes()
    const panelRef = useRef<HTMLDivElement>(null)
    const focusNewNote = () =>
        panelRef.current
            ?.querySelector<HTMLElement>('[contenteditable="true"]')
            ?.focus()
    return (
        <div ref={panelRef} className="flex flex-col gap-4">
            <NoteEditor label={t.notes.editorLabel} onSave={create} />
            {failure && (
                <p role="alert" className="text-label-lg">
                    {t.notes.failed[failure]}
                </p>
            )}
            <NoteList notes={notes} onNoteDeleted={focusNewNote} />
        </div>
    )
}
