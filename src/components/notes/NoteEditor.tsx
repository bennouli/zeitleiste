'use client'

import { useI18n } from '@/components/I18nContext'
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
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
import { useCallback, useEffect, useState } from 'react'
import { type NoteBody, toEditorBody, toStoredBody } from './noteBody'
import { NOTE_NODES, NOTE_TRANSFORMERS } from './noteMarkdown'
import { buttonClass, iconButtonClass } from './noteStyles'

export type NoteEditorProps = {
    /** The note being edited; a new note starts empty. */
    initialBody?: NoteBody
    label: string
    /** Resolves to whether the note was stored; a new note's editor then empties. */
    onSave: (body: NoteBody) => Promise<boolean>
    onCancel?: () => void
}

const EDITOR_THEME = {
    paragraph: 'text-note',
    heading: {
        h3: 'text-note-title font-medium',
        h4: 'text-note font-medium',
    },
    quote: 'border-l-2 border-border pl-3 text-note',
    list: {
        ul: 'list-disc pl-5 text-note',
        ol: 'list-decimal pl-5 text-note',
    },
    link: 'underline decoration-fg-muted underline-offset-2',
    text: {
        bold: 'font-medium',
        italic: 'font-serif-italic italic',
    },
}

/** A rich-text editor without a toolbar: Markdown shortcuts format, Ctrl/Cmd+Enter saves. */
export function NoteEditor({
    initialBody,
    label,
    onSave,
    onCancel,
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
}: Omit<NoteEditorProps, 'initialBody'> & { clearsOnSave: boolean }) {
    const { t } = useI18n()
    const [editor] = useLexicalComposerContext()
    const [saving, setSaving] = useState(false)

    const save = useCallback(async () => {
        if (saving || isEditorEmpty(editor)) return
        setSaving(true)
        const stored = await onSave(toStoredBody(editorBody(editor)))
        setSaving(false)
        if (stored && clearsOnSave)
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
                            aria-label={label}
                            aria-placeholder={t.notes.placeholder}
                            placeholder={
                                <div className="pointer-events-none absolute top-2 left-3 text-note text-fg-muted">
                                    {t.notes.placeholder}
                                </div>
                            }
                            className="flex min-h-24 flex-col gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-note text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
                        className={iconButtonClass}
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
                    className={buttonClass}
                >
                    <Check aria-hidden size={16} strokeWidth={1.5} />
                    {saving ? t.notes.saving : t.notes.save}
                </button>
            </div>
        </div>
    )
}

function editorBody(editor: LexicalEditor): NoteBody {
    const { root } = editor.getEditorState().toJSON()
    return {
        root: { ...root, children: root.children.map((node) => ({ ...node })) },
    }
}

function isEditorEmpty(editor: LexicalEditor): boolean {
    return editor
        .getEditorState()
        .read(() => $getRoot().getTextContent().trim() === '')
}
