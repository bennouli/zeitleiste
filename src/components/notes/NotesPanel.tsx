'use client'

import { useI18n } from '@/components/I18nContext'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { useNotes } from './NotesContext'

/** The signed-in user's notes: an editor for a new one, then the list. No chrome. */
export function NotesPanel() {
    const { t } = useI18n()
    const { notes, failed, create } = useNotes()
    return (
        <div className="flex flex-col gap-4">
            <NoteEditor label={t.notes.editorLabel} onSave={create} />
            {failed && (
                <p role="alert" className="text-label-lg">
                    {t.notes.failed}
                </p>
            )}
            <NoteList notes={notes} />
        </div>
    )
}
