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

export type NotesState = {
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

const NOT_SIGNED_IN: NotesState = {
    signedIn: false,
    notes: [],
    failure: null,
    create: async () => false,
    update: async () => false,
    remove: async () => false,
}

const NotesContext = createContext<NotesState>(NOT_SIGNED_IN)

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
            (currentLoad) => {
                if (!isWanted) return
                setNotesLoad(currentLoad)
                if (currentLoad.signedIn && currentLoad.loadFailed)
                    setFailure('load')
            },
            () => isWanted && setFailure('load')
        )
        return () => {
            isWanted = false
        }
    }, [actions])

    const applyChange = useCallback(async (change: Promise<NoteChange>) => {
        const noteChange = await change.catch((): NoteChange => ({
            stored: false,
        }))
        setFailure(noteChange.stored ? null : 'save')
        if (noteChange.stored)
            setNotesLoad((currentLoad) =>
                currentLoad.signedIn
                    ? {
                          ...currentLoad,
                          notes: withNote(currentLoad.notes, noteChange.note),
                      }
                    : currentLoad
            )
        return noteChange.stored
    }, [])

    const remove = useCallback(
        async (id: number) => {
            const { deleted } = await actions
                .deleteNote(id)
                .catch(() => ({ deleted: false }))
            setFailure(deleted ? null : 'delete')
            if (deleted)
                setNotesLoad((currentLoad) =>
                    currentLoad.signedIn
                        ? {
                              ...currentLoad,
                              notes: withoutNote(currentLoad.notes, id),
                          }
                        : currentLoad
                )
            return deleted
        },
        [actions]
    )

    const notesState = useMemo(
        (): NotesState => ({
            signedIn: notesLoad.signedIn,
            notes: notesLoad.signedIn ? notesLoad.notes : [],
            failure,
            create: (body) => applyChange(actions.createNote(body)),
            update: (id, body) => applyChange(actions.updateNote(id, body)),
            remove,
        }),
        [notesLoad, failure, actions, applyChange, remove]
    )

    return <NotesContext value={notesState}>{children}</NotesContext>
}

export function useNotes(): NotesState {
    return useContext(NotesContext)
}
