'use client'

import { FOCUS_RING_CLASS } from '@/components/focusRing'
import { useI18n } from '@/components/I18nContext'
import {
    BOLD_CLASS,
    ITALIC_CLASS,
    LINK_CLASS,
} from '@/components/richTextFormat'
import type { NoteBody } from '@/lib/noteSchema'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import {
    $getRoot,
    CLEAR_EDITOR_COMMAND,
    COMMAND_PRIORITY_HIGH,
    KEY_ENTER_COMMAND,
    type LexicalEditor,
} from 'lexical'
import { Check, X } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useState } from 'react'
import { toEditorBody, toNoteBody, toStoredBody } from './noteBody'
import { NOTE_NODES, NOTE_TRANSFORMERS } from './noteMarkdown'
import {
    BUTTON_CLASS,
    ICON_BUTTON_CLASS,
    NOTE_BULLET_LIST_CLASS,
    NOTE_NUMBER_LIST_CLASS,
    NOTE_QUOTE_CLASS,
    NOTE_SUBHEADING_CLASS,
    NOTE_TITLE_CLASS,
} from './noteStyles'

export type NoteEditorProps = {
    /** The note being edited; a new note starts empty. */
    initialBody?: NoteBody
    label: string
    /** Resolves to whether the note was stored; a new note's editor then empties. */
    onSave: (body: NoteBody) => Promise<boolean>
    onCancel?: () => void
    /** Receives the Lexical editor, so the caller can focus it. */
    editorRef?: RefObject<LexicalEditor | null>
}

const EDITOR_THEME = {
    paragraph: 'text-note',
    heading: {
        h3: NOTE_TITLE_CLASS,
        h4: NOTE_SUBHEADING_CLASS,
    },
    quote: `${NOTE_QUOTE_CLASS} text-note`,
    list: {
        ul: `${NOTE_BULLET_LIST_CLASS} text-note`,
        ol: `${NOTE_NUMBER_LIST_CLASS} text-note`,
    },
    link: LINK_CLASS,
    text: {
        bold: BOLD_CLASS,
        italic: ITALIC_CLASS,
    },
}

/** A rich-text editor without a toolbar: Markdown shortcuts format, Ctrl/Cmd+Enter saves. */
export function NoteEditor({
    initialBody,
    label,
    onSave,
    onCancel,
    editorRef,
}: NoteEditorProps) {
    const initialConfig = {
        namespace: 'note',
        nodes: NOTE_NODES,
        theme: EDITOR_THEME,
        editorState: initialBody
            ? JSON.stringify(toEditorBody(initialBody))
            : undefined,
        onError: (error: Error) => {
            throw error
        },
    }
    return (
        <LexicalComposer initialConfig={initialConfig}>
            {editorRef && <EditorRefPlugin editorRef={editorRef} />}
            {initialBody && <AutoFocusPlugin defaultSelection="rootEnd" />}
            <NoteEditorBody
                label={label}
                onSave={onSave}
                onCancel={onCancel}
                clearsOnSave={initialBody === undefined}
            />
        </LexicalComposer>
    )
}

function NoteEditorBody({
    label,
    onSave,
    onCancel,
    clearsOnSave,
}: Omit<NoteEditorProps, 'initialBody' | 'editorRef'> & {
    clearsOnSave: boolean
}) {
    const { t } = useI18n()
    const [editor] = useLexicalComposerContext()
    const [saving, setSaving] = useState(false)

    const save = useCallback(async () => {
        if (saving || isEditorEmpty(editor)) return
        setSaving(true)
        const isStored = await onSave(
            toStoredBody(toNoteBody(editor.getEditorState().toJSON()))
        )
        setSaving(false)
        if (isStored && clearsOnSave)
            editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)
    }, [editor, onSave, saving, clearsOnSave])

    useEffect(
        () =>
            editor.registerCommand(
                KEY_ENTER_COMMAND,
                (event) => {
                    if (!event || !(event.ctrlKey || event.metaKey))
                        return false
                    event.preventDefault()
                    void save()
                    return true
                },
                COMMAND_PRIORITY_HIGH
            ),
        [editor, save]
    )

    return (
        <div role="group" aria-label={label} className="flex flex-col gap-2">
            <div className="relative">
                <RichTextPlugin
                    contentEditable={
                        <ContentEditable
                            aria-label={t.notes.textLabel}
                            aria-placeholder={t.notes.placeholder}
                            placeholder={
                                <div className="pointer-events-none absolute top-2 left-3 text-note text-fg-muted">
                                    {t.notes.placeholder}
                                </div>
                            }
                            className={`flex min-h-24 flex-col gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-note text-fg ${FOCUS_RING_CLASS}`}
                        />
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                />
            </div>
            <HistoryPlugin />
            <ClearEditorPlugin />
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={NOTE_TRANSFORMERS} />
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className={ICON_BUTTON_CLASS}
                    >
                        <X aria-hidden size={16} strokeWidth={1.5} />
                        {t.notes.cancel}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                    title={t.notes.saveHint}
                    className={BUTTON_CLASS}
                >
                    <Check aria-hidden size={16} strokeWidth={1.5} />
                    {saving ? t.notes.saving : t.notes.save}
                </button>
            </div>
        </div>
    )
}

function isEditorEmpty(editor: LexicalEditor): boolean {
    return editor
        .getEditorState()
        .read(() => $getRoot().getTextContent().trim() === '')
}
