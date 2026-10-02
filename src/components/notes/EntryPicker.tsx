'use client'

import { FOCUS_RING_CLASS } from '@/components/focusRing'
import { useI18n } from '@/components/I18nContext'
import type { Messages } from '@/i18n/messages'
import type { LinkedEntry } from '@/lib/noteSchema'
import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useNotes } from './NotesContext'
import { ICON_BUTTON_CLASS } from './noteStyles'
import { useEntrySearch, type EntrySearchOutcome } from './useEntrySearch'

type EntryPickerProps = {
    /** Names the group, e.g. "Link note to an entry: <note title>". */
    label: string
    onPick: (entry: LinkedEntry) => void
    onCancel: () => void
}

/** Search the entries by title and pick the one to link the note to. */
export function EntryPicker({ label, onPick, onCancel }: EntryPickerProps) {
    const { t } = useI18n()
    const { searchEntries } = useNotes()
    const { query, setQuery, outcome } = useEntrySearch(searchEntries)
    const inputRef = useRef<HTMLInputElement>(null)
    const inputId = useId()
    useEffect(() => inputRef.current?.focus(), [])

    return (
        <div role="group" aria-label={label} className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-label-lg">
                {t.notes.entrySearch}
            </label>
            <input
                ref={inputRef}
                id={inputId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                className={`rounded-sm border border-border bg-surface px-3 py-1 text-note text-fg ${FOCUS_RING_CLASS}`}
            />
            <p role="status" className="text-label-lg text-fg-muted">
                {statusText(outcome, t.notes)}
            </p>
            {outcome.status === 'found' && outcome.entries.length > 0 && (
                <ul className="flex flex-col">
                    {outcome.entries.map((entry) => (
                        <li key={entry.id}>
                            <button
                                type="button"
                                onClick={() => onPick(entry)}
                                className={`w-full cursor-pointer rounded-sm px-2 py-1 text-left text-note text-fg hover:underline ${FOCUS_RING_CLASS}`}
                            >
                                {entry.title}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className={ICON_BUTTON_CLASS}
                >
                    <X aria-hidden size={16} strokeWidth={1.5} />
                    {t.notes.cancel}
                </button>
            </div>
        </div>
    )
}

function statusText(
    outcome: EntrySearchOutcome,
    notesText: Messages['notes']
): string {
    switch (outcome.status) {
        case 'idle':
            return notesText.entrySearchHint
        case 'searching':
            return notesText.entrySearching
        case 'found':
            return outcome.entries.length === 0
                ? notesText.noEntryFound
                : notesText.entriesFound(outcome.entries.length)
        case 'failed':
            return notesText.entrySearchFailed
        case 'signedOut':
            return notesText.failed.signedOut
    }
}
