'use client'

import type { LinkedEntry, NoteBodyInput, NoteView } from '@/lib/noteSchema'
import { useEffect, useRef, useState } from 'react'
import { linkedEntryOf } from './note'
import { useNotes } from './NotesContext'

export type CardMode = 'reading' | 'editing' | 'confirmingDelete' | 'linking'

type CardButton = 'edit' | 'delete' | 'link' | 'unlink'

/** A new object per request, so asking for the same button twice focuses it twice. */
type FocusRequest = { button: CardButton }

/**
 * One note card: what it shows, the step the user is in, and the changes it makes.
 * After every step the focus lands on the button the step belongs to.
 */
export function useNoteCard(note: NoteView, onDeleted: () => void) {
    const { update, remove, link } = useNotes()
    const [mode, setMode] = useState<CardMode>('reading')
    const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
    const editButtonRef = useRef<HTMLButtonElement>(null)
    const deleteButtonRef = useRef<HTMLButtonElement>(null)
    const linkButtonRef = useRef<HTMLButtonElement>(null)
    const unlinkButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (mode !== 'reading' || focusRequest === null) return
        const buttonRefs = {
            edit: editButtonRef,
            delete: deleteButtonRef,
            link: linkButtonRef,
            unlink: unlinkButtonRef,
        }
        buttonRefs[focusRequest.button].current?.focus()
    }, [mode, focusRequest])

    const readAgain = (button: CardButton) => {
        setMode('reading')
        setFocusRequest({ button })
    }

    return {
        mode,
        linkedEntry: linkedEntryOf(note),
        editButtonRef,
        deleteButtonRef,
        linkButtonRef,
        unlinkButtonRef,
        startEditing: () => setMode('editing'),
        startLinking: () => setMode('linking'),
        askToDelete: () => setMode('confirmingDelete'),
        /** Leaves the current step, back on the button that opened it. */
        cancelEditing: () => readAgain('edit'),
        cancelLinking: () => readAgain('link'),
        cancelDelete: () => readAgain('delete'),
        /** Resolves to whether the body was stored. */
        save: async (body: NoteBodyInput) => {
            const isStored = await update(note.id, body)
            if (isStored) readAgain('edit')
            return isStored
        },
        confirmDelete: async () => {
            if (await remove(note.id)) onDeleted()
            else readAgain('delete')
        },
        linkTo: async (entry: LinkedEntry) => {
            if (await link(note.id, entry.id)) readAgain('unlink')
        },
        unlink: async () => {
            if (await link(note.id, null)) readAgain('link')
        },
    }
}
