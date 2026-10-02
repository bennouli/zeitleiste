'use client'

import type {
    NoteBodyInput,
    NoteChange,
    NoteDeletion,
    NotesLoad,
    NoteView,
} from '@/lib/noteSchema'
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import { withNote, withoutNote } from './note'
import { NotesOverlayProvider } from './NotesOverlayContext'

/** The server actions behind the notes; plain data in, plain data out. */
export type NotesActions = {
    createNote: (body: NoteBodyInput) => Promise<NoteChange>
    updateNote: (id: number, body: NoteBodyInput) => Promise<NoteChange>
    deleteNote: (id: number) => Promise<NoteDeletion>
}

export type NotesFailure = 'load' | 'save' | 'delete' | 'signedOut' | null

export type NotesState = {
    signedIn: boolean
    /** Most recently changed first. */
    notes: NoteView[]
    /** What failed last; null once a change succeeds. */
    failure: NotesFailure
    /** Each resolves to whether the change was stored. */
    create: (body: NoteBodyInput) => Promise<boolean>
    update: (id: number, body: NoteBodyInput) => Promise<boolean>
    remove: (id: number) => Promise<boolean>
}

const NOT_SIGNED_IN: NotesState = {
    signedIn: false,
    notes: [],
    failure: null,
    create: async () => false,
    update: async () => false,
    remove: async () => false,
}

const NotesContext = createContext<NotesState>(NOT_SIGNED_IN)

/** The reader's notes, rendered with the page, and the changes made to them. */
export function NotesProvider({
    initialLoad,
    actions,
    children,
}: {
    initialLoad: NotesLoad
    actions: NotesActions
    children: ReactNode
}) {
    const [notes, setNotes] = useState(initialLoad.notes)
    const [failure, setFailure] = useState<NotesFailure>(
        initialLoad.loadFailed ? 'load' : null
    )

    const applyChange = useCallback(async (change: Promise<NoteChange>) => {
        const noteChange = await change.catch((): NoteChange => ({
            stored: false,
            signedOut: false,
        }))
        setFailure(
            failureOf(
                noteChange.stored,
                !noteChange.stored && noteChange.signedOut,
                'save'
            )
        )
        if (noteChange.stored)
            setNotes((currentNotes) => withNote(currentNotes, noteChange.note))
        return noteChange.stored
    }, [])

    const remove = useCallback(
        async (id: number) => {
            const deletion = await actions
                .deleteNote(id)
                .catch((): NoteDeletion => ({
                    deleted: false,
                    signedOut: false,
                }))
            const { deleted } = deletion
            setFailure(failureOf(deleted, deletion.signedOut, 'delete'))
            if (deleted)
                setNotes((currentNotes) => withoutNote(currentNotes, id))
            return deleted
        },
        [actions]
    )

    const notesState = useMemo(
        (): NotesState => ({
            signedIn: true,
            notes,
            failure,
            create: (body) => applyChange(actions.createNote(body)),
            update: (id, body) => applyChange(actions.updateNote(id, body)),
            remove,
        }),
        [notes, failure, actions, applyChange, remove]
    )

    return (
        <NotesContext value={notesState}>
            <NotesOverlayProvider>{children}</NotesOverlayProvider>
        </NotesContext>
    )
}

function failureOf(
    succeeded: boolean,
    signedOut: boolean,
    attempted: 'save' | 'delete'
): NotesFailure {
    if (succeeded) return null
    return signedOut ? 'signedOut' : attempted
}

export function useNotes(): NotesState {
    return useContext(NotesContext)
}
