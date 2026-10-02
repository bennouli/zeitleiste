'use client'

import { useI18n } from '@/components/I18nContext'
import type { LexicalEditor } from 'lexical'
import { useRef } from 'react'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { useNotes } from './NotesContext'

/** The signed-in user's notes: an editor for a new one, then the list. No chrome. */
export function NotesPanel() {
    const { t } = useI18n()
    const { notes, failure, create } = useNotes()
    const newNoteEditor = useRef<LexicalEditor | null>(null)
    const focusNewNote = () => newNoteEditor.current?.focus()
    return (
        <div className="flex flex-col gap-4">
            <NoteEditor
                label={t.notes.editorLabel}
                onSave={create}
                editorRef={newNoteEditor}
            />
            {failure && (
                <p role="alert" className="text-label-lg">
                    {t.notes.failed[failure]}
                </p>
            )}
            <NoteList notes={notes} onNoteDeleted={focusNewNote} />
        </div>
    )
}
