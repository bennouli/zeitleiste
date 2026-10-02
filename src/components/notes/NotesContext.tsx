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
    { signedIn: false } | { signedIn: true; notes: NoteView[] }

export type NoteChange = { stored: true; note: NoteView } | { stored: false }

/** The server actions behind the notes; plain data in, plain data out. */
export type NotesActions = {
    listNotes: () => Promise<NotesLoad>
    createNote: (body: NoteBody) => Promise<NoteChange>
    updateNote: (id: number, body: NoteBody) => Promise<NoteChange>
    deleteNote: (id: number) => Promise<{ deleted: boolean }>
}

export type Notes = {
    signedIn: boolean
    /** Most recently changed first. */
    notes: NoteView[]
    /** The last change failed. */
    failed: boolean
    /** Each resolves to whether the change was stored. */
    create: (body: NoteBody) => Promise<boolean>
    update: (id: number, body: NoteBody) => Promise<boolean>
    remove: (id: number) => Promise<boolean>
}

const NOT_SIGNED_IN: Notes = {
    signedIn: false,
    notes: [],
    failed: false,
    create: async () => false,
    update: async () => false,
    remove: async () => false,
}

const NotesContext = createContext<Notes>(NOT_SIGNED_IN)

/** Loads the signed-in user's notes once the page is interactive, so pages stay static. */
export function NotesProvider({
    actions,
    children,
}: {
    actions: NotesActions
    children: ReactNode
}) {
    const [load, setLoad] = useState<NotesLoad>({ signedIn: false })
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let current = true
        actions.listNotes().then(
            (loaded) => current && setLoad(loaded),
            () => current && setFailed(true)
        )
        return () => {
            current = false
        }
    }, [actions])

    const applyChange = useCallback(async (change: Promise<NoteChange>) => {
        const result = await change.catch((): NoteChange => ({ stored: false }))
        setFailed(!result.stored)
        if (result.stored)
            setLoad((loaded) =>
                loaded.signedIn
                    ? { ...loaded, notes: withNote(loaded.notes, result.note) }
                    : loaded
            )
        return result.stored
    }, [])

    const remove = useCallback(
        async (id: number) => {
            const { deleted } = await actions
                .deleteNote(id)
                .catch(() => ({ deleted: false }))
            setFailed(!deleted)
            if (deleted)
                setLoad((loaded) =>
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
            signedIn: load.signedIn,
            notes: load.signedIn ? load.notes : [],
            failed,
            create: (body) => applyChange(actions.createNote(body)),
            update: (id, body) => applyChange(actions.updateNote(id, body)),
            remove,
        }),
        [load, failed, actions, applyChange, remove]
    )

    return <NotesContext value={notes}>{children}</NotesContext>
}

export function useNotes(): Notes {
    return useContext(NotesContext)
}
