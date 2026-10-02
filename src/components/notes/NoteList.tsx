'use client'

import { useI18n } from '@/components/I18nContext'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { NoteView } from './note'
import { NoteEditor } from './NoteEditor'
import { NoteRichText } from './NoteRichText'
import { useNotes } from './NotesContext'
import { buttonClass, iconButtonClass } from './noteStyles'
import { splitTitle } from './noteTitle'

type CardMode = 'reading' | 'editing' | 'confirmingDelete'

type CardButton = 'edit' | 'delete'

type NoteListProps = {
    notes: NoteView[]
    /** Called once a note is gone, so focus has somewhere to go. */
    onNoteDeleted: () => void
}

/** The user's notes, most recently changed first. */
export function NoteList({ notes, onNoteDeleted }: NoteListProps) {
    return (
        <ul className="flex flex-col divide-y divide-border">
            {notes.map((note) => (
                <li key={note.id} className="py-3">
                    <NoteCard note={note} onDeleted={onNoteDeleted} />
                </li>
            ))}
        </ul>
    )
}

function NoteCard({
    note,
    onDeleted,
}: {
    note: NoteView
    onDeleted: () => void
}) {
    const { t } = useI18n()
    const { update, remove } = useNotes()
    const [mode, setMode] = useState<CardMode>('reading')
    const focusTarget = useRef<CardButton | null>(null)
    const editButtonRef = useRef<HTMLButtonElement>(null)
    const deleteButtonRef = useRef<HTMLButtonElement>(null)
    const { title, rest } = splitTitle(note.body)
    const shownTitle = title || t.notes.untitled

    useEffect(() => {
        if (mode !== 'reading' || focusTarget.current === null) return
        const button =
            focusTarget.current === 'edit' ? editButtonRef : deleteButtonRef
        focusTarget.current = null
        button.current?.focus()
    }, [mode])

    const readAgain = (button: CardButton) => {
        focusTarget.current = button
        setMode('reading')
    }

    const confirmDelete = async () => {
        if (await remove(note.id)) onDeleted()
        else readAgain('delete')
    }

    if (mode === 'editing')
        return (
            <NoteEditor
                initialBody={note.body}
                label={t.notes.editLabel(shownTitle)}
                onSave={async (body) => {
                    const isStored = await update(note.id, body)
                    if (isStored) readAgain('edit')
                    return isStored
                }}
                onCancel={() => readAgain('edit')}
            />
        )

    return (
        <article className="flex flex-col gap-1">
            <h3 className="text-note-title font-medium break-words">
                {shownTitle}
            </h3>
            <ClampedBody>
                <NoteRichText body={rest} />
            </ClampedBody>
            {mode === 'confirmingDelete' ? (
                <DeleteConfirmation
                    onConfirm={() => void confirmDelete()}
                    onCancel={() => readAgain('delete')}
                />
            ) : (
                <div className="flex justify-end gap-1">
                    <button
                        ref={editButtonRef}
                        type="button"
                        onClick={() => setMode('editing')}
                        aria-label={t.notes.editLabel(shownTitle)}
                        className={iconButtonClass}
                    >
                        <Pencil aria-hidden size={14} strokeWidth={1.5} />
                        {t.notes.edit}
                    </button>
                    <button
                        ref={deleteButtonRef}
                        type="button"
                        onClick={() => setMode('confirmingDelete')}
                        aria-label={t.notes.deleteLabel(shownTitle)}
                        className={iconButtonClass}
                    >
                        <Trash2 aria-hidden size={14} strokeWidth={1.5} />
                        {t.notes.delete}
                    </button>
                </div>
            )}
        </article>
    )
}

function ClampedBody({ children }: { children: React.ReactNode }) {
    const { t } = useI18n()
    const bodyRef = useRef<HTMLDivElement>(null)
    const bodyId = useId()
    const [expanded, setExpanded] = useState(false)
    const [overflows, setOverflows] = useState(false)

    useLayoutEffect(() => {
        const el = bodyRef.current
        if (!el || expanded) return
        const measure = () => setOverflows(el.scrollHeight > el.clientHeight)
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
    }, [expanded, children])

    return (
        <>
            <div
                ref={bodyRef}
                id={bodyId}
                className={`space-y-1.5 text-note break-words text-fg-soft ${expanded ? '' : 'line-clamp-12'}`}
                data-clamped={!expanded && overflows ? '' : undefined}
            >
                {children}
            </div>
            {(overflows || expanded) && (
                <button
                    type="button"
                    onClick={() => setExpanded((was) => !was)}
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    className={`self-start ${iconButtonClass}`}
                >
                    {expanded ? (
                        <ChevronUp aria-hidden size={14} strokeWidth={1.5} />
                    ) : (
                        <ChevronDown aria-hidden size={14} strokeWidth={1.5} />
                    )}
                    {expanded ? t.notes.showLess : t.notes.showAll}
                </button>
            )}
        </>
    )
}

function DeleteConfirmation({
    onConfirm,
    onCancel,
}: {
    onConfirm: () => void
    onCancel: () => void
}) {
    const { t } = useI18n()
    const cancelRef = useRef<HTMLButtonElement>(null)
    useEffect(() => cancelRef.current?.focus(), [])
    return (
        <div
            role="group"
            aria-label={t.notes.confirmDelete}
            className="flex items-center justify-end gap-2"
        >
            <span className="text-label-lg">{t.notes.confirmDelete}</span>
            <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className={iconButtonClass}
            >
                {t.notes.cancel}
            </button>
            <button type="button" onClick={onConfirm} className={buttonClass}>
                <Trash2 aria-hidden size={14} strokeWidth={1.5} />
                {t.notes.delete}
            </button>
        </div>
    )
}
