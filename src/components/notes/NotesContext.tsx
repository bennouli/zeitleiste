'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import { withNote, withoutNote, type NoteView } from './note'
import type { NoteBody } from './noteBody'

/** What the server hands a page: a visitor gets no notes. */
export type NotesLoad =
    | { signedIn: false }
    | { signedIn: true; notes: NoteView[]; loadFailed: boolean }

export type NoteChange = { stored: true; note: NoteView } | { stored: false }

/** The server actions behind the notes; plain data in, plain data out. */
export type NotesActions = {
    listNotes: () => Promise<NotesLoad>
    createNote: (body: NoteBody) => Promise<NoteChange>
    updateNote: (id: number, body: NoteBody) => Promise<NoteChange>
    deleteNote: (id: number) => Promise<{ deleted: boolean }>
}

export type NotesFailure = 'load' | 'save' | 'delete' | null

export type Notes = {
    signedIn: boolean
    /** Most recently changed first. */
    notes: NoteView[]
    /** What failed last; null once a change succeeds. */
    failure: NotesFailure
    /** Each resolves to whether the change was stored. */
    create: (body: NoteBody) => Promise<boolean>
    update: (id: number, body: NoteBody) => Promise<boolean>
    remove: (id: number) => Promise<boolean>
}

const NOT_SIGNED_IN: Notes = {
    signedIn: false,
    notes: [],
    failure: null,
    create: async () => false,
    update: async () => false,
    remove: async () => false,
}

const NotesContext = createContext<Notes>(NOT_SIGNED_IN)

/** Loads the signed-in user's notes once the page is interactive. */
export function NotesProvider({
    actions,
    children,
}: {
    actions: NotesActions
    children: ReactNode
}) {
    const [notesLoad, setNotesLoad] = useState<NotesLoad>({ signedIn: false })
    const [failure, setFailure] = useState<NotesFailure>(null)

    useEffect(() => {
        let isWanted = true
        actions.listNotes().then(
            (loaded) => {
                if (!isWanted) return
                setNotesLoad(loaded)
                if (loaded.signedIn && loaded.loadFailed) setFailure('load')
            },
            () => isWanted && setFailure('load')
        )
        return () => {
            isWanted = false
        }
    }, [actions])

    const applyChange = useCallback(async (change: Promise<NoteChange>) => {
        const outcome = await change.catch((): NoteChange => ({
            stored: false,
        }))
        setFailure(outcome.stored ? null : 'save')
        if (outcome.stored)
            setNotesLoad((loaded) =>
                loaded.signedIn
                    ? { ...loaded, notes: withNote(loaded.notes, outcome.note) }
                    : loaded
            )
        return outcome.stored
    }, [])

    const remove = useCallback(
        async (id: number) => {
            const { deleted } = await actions
                .deleteNote(id)
                .catch(() => ({ deleted: false }))
            setFailure(deleted ? null : 'delete')
            if (deleted)
                setNotesLoad((loaded) =>
                    loaded.signedIn
                        ? { ...loaded, notes: withoutNote(loaded.notes, id) }
                        : loaded
                )
            return deleted
        },
        [actions]
    )

    const notes = useMemo(
        (): Notes => ({
            signedIn: notesLoad.signedIn,
            notes: notesLoad.signedIn ? notesLoad.notes : [],
            failure,
            create: (body) => applyChange(actions.createNote(body)),
            update: (id, body) => applyChange(actions.updateNote(id, body)),
            remove,
        }),
        [notesLoad, failure, actions, applyChange, remove]
    )

    return <NotesContext value={notes}>{children}</NotesContext>
}

export function useNotes(): Notes {
    return useContext(NotesContext)
}
