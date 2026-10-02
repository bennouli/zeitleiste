'use client'

import { useI18n } from '@/components/I18nContext'
import type { LinkedEntry, NoteView } from '@/lib/noteSchema'
import { ChevronDown, ChevronUp, Link2, Pencil, Trash2, X } from 'lucide-react'
import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from 'react'
import { EntryPicker } from './EntryPicker'
import { NoteEditor } from './NoteEditor'
import { NoteRichText } from './NoteRichText'
import { BUTTON_CLASS, ICON_BUTTON_CLASS, NOTE_TITLE_CLASS } from './noteStyles'
import { splitTitle } from './noteTitle'
import { useNoteCard } from './useNoteCard'

type NoteListProps = {
    notes: NoteView[]
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
    const {
        mode,
        linkedEntry,
        editButtonRef,
        deleteButtonRef,
        linkButtonRef,
        unlinkButtonRef,
        startEditing,
        startLinking,
        askToDelete,
        cancelEditing,
        cancelLinking,
        cancelDelete,
        save,
        confirmDelete,
        linkTo,
        unlink,
    } = useNoteCard(note, onDeleted)
    const { title, rest } = splitTitle(note.body)
    const shownTitle = title || t.notes.untitled

    if (mode === 'editing')
        return (
            <NoteEditor
                initialBody={note.body}
                label={t.notes.editLabel(shownTitle)}
                onSave={save}
                onCancel={cancelEditing}
            />
        )

    return (
        <article className="flex flex-col gap-1">
            <h3 className={`${NOTE_TITLE_CLASS} break-words`}>{shownTitle}</h3>
            {linkedEntry && (
                <EntryLink
                    entry={linkedEntry}
                    onUnlink={() => void unlink()}
                    unlinkButtonRef={unlinkButtonRef}
                />
            )}
            <ClampedBody>
                <NoteRichText body={rest} />
            </ClampedBody>
            {mode === 'linking' && (
                <EntryPicker
                    label={t.notes.linkLabel(shownTitle)}
                    onPick={(entry) => void linkTo(entry)}
                    onCancel={cancelLinking}
                />
            )}
            {mode === 'confirmingDelete' && (
                <DeleteConfirmation
                    onConfirm={() => void confirmDelete()}
                    onCancel={cancelDelete}
                />
            )}
            {mode === 'reading' && (
                <div className="flex flex-wrap justify-end gap-1">
                    <button
                        ref={editButtonRef}
                        type="button"
                        onClick={startEditing}
                        aria-label={t.notes.editLabel(shownTitle)}
                        className={ICON_BUTTON_CLASS}
                    >
                        <Pencil aria-hidden size={14} strokeWidth={1.5} />
                        {t.notes.edit}
                    </button>
                    {!linkedEntry && (
                        <button
                            ref={linkButtonRef}
                            type="button"
                            onClick={startLinking}
                            aria-label={t.notes.linkLabel(shownTitle)}
                            className={ICON_BUTTON_CLASS}
                        >
                            <Link2 aria-hidden size={14} strokeWidth={1.5} />
                            {t.notes.link}
                        </button>
                    )}
                    <button
                        ref={deleteButtonRef}
                        type="button"
                        onClick={askToDelete}
                        aria-label={t.notes.deleteLabel(shownTitle)}
                        className={ICON_BUTTON_CLASS}
                    >
                        <Trash2 aria-hidden size={14} strokeWidth={1.5} />
                        {t.notes.delete}
                    </button>
                </div>
            )}
        </article>
    )
}

function EntryLink({
    entry,
    onUnlink,
    unlinkButtonRef,
}: {
    entry: LinkedEntry
    onUnlink: () => void
    unlinkButtonRef: RefObject<HTMLButtonElement | null>
}) {
    const { t } = useI18n()
    return (
        <p className="flex items-center gap-1.5 text-label-lg text-fg-muted">
            <Link2 aria-hidden size={14} strokeWidth={1.5} />
            <span className="sr-only">{t.notes.linkedTo(entry.title)}</span>
            <span aria-hidden className="min-w-0 break-words">
                {entry.title}
            </span>
            <button
                ref={unlinkButtonRef}
                type="button"
                onClick={onUnlink}
                aria-label={t.notes.unlinkLabel(entry.title)}
                className={ICON_BUTTON_CLASS}
            >
                <X aria-hidden size={14} strokeWidth={1.5} />
            </button>
        </p>
    )
}

function ClampedBody({ children }: { children: React.ReactNode }) {
    const { t } = useI18n()
    const bodyRef = useRef<HTMLDivElement>(null)
    const bodyId = useId()
    const [expanded, setExpanded] = useState(false)
    const [overflows, setOverflows] = useState(false)

    useLayoutEffect(() => {
        const body = bodyRef.current
        if (!body || expanded) return
        const measure = () =>
            setOverflows(body.scrollHeight > body.clientHeight)
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(body)
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
                    onClick={() => setExpanded((wasExpanded) => !wasExpanded)}
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    className={`self-start ${ICON_BUTTON_CLASS}`}
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
    const questionId = useId()
    useEffect(() => cancelRef.current?.focus(), [])
    return (
        <div
            role="group"
            aria-labelledby={questionId}
            className="flex items-center justify-end gap-2"
        >
            <span id={questionId} className="text-label-lg">
                {t.notes.confirmDelete}
            </span>
            <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className={ICON_BUTTON_CLASS}
            >
                {t.notes.cancel}
            </button>
            <button type="button" onClick={onConfirm} className={BUTTON_CLASS}>
                <Trash2 aria-hidden size={14} strokeWidth={1.5} />
                {t.notes.delete}
            </button>
        </div>
    )
}
