import type { NoteBody, NoteNode } from '@/lib/noteSchema'
import { inLocale } from '@/test/i18n'
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteEditor } from '../NoteEditor'
import { splitTitle } from '../noteTitle'
import { noteBody, paragraph, text } from './noteFixtures'

const LABEL = 'Notiz bearbeiten'
const CTRL_ENTER = { key: 'Enter', ctrlKey: true }
const CMD_ENTER = { key: 'Enter', metaKey: true }
const PLAIN_ENTER = { key: 'Enter' }
const WRITTEN = noteBody(paragraph(text('Kiew 1240')))

const adminAutolink: NoteNode = {
    type: 'autolink',
    version: 2,
    fields: { linkType: 'custom', newTab: false, url: 'https://example.org' },
    children: [text('https://example.org')],
}

function renderEditor(
    onSave: (body: NoteBody) => Promise<boolean>,
    initialBody = WRITTEN
) {
    render(
        <NoteEditor initialBody={initialBody} label={LABEL} onSave={onSave} />,
        { wrapper: inLocale('de') }
    )
    return within(screen.getByRole('group', { name: LABEL })).getByRole(
        'textbox',
        { name: 'Text' }
    )
}

describe('NoteEditor', () => {
    it('saves with Ctrl+Enter', async () => {
        const onSave = vi.fn<(body: NoteBody) => Promise<boolean>>(
            async () => true
        )
        const editable = renderEditor(onSave)

        fireEvent.keyDown(editable, CTRL_ENTER)

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
        const savedBody = onSave.mock.lastCall?.[0]
        expect(savedBody && splitTitle(savedBody).title).toBe('Kiew 1240')
    })

    it('saves with Cmd+Enter', async () => {
        const onSave = vi.fn(async () => true)
        const editable = renderEditor(onSave)

        fireEvent.keyDown(editable, CMD_ENTER)

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    })

    it('does not save on a plain Enter', () => {
        const onSave = vi.fn(async () => true)
        const editable = renderEditor(onSave)

        fireEvent.keyDown(editable, PLAIN_ENTER)

        expect(onSave).not.toHaveBeenCalled()
    })

    it('saves with the button', async () => {
        const onSave = vi.fn(async () => true)
        renderEditor(onSave)

        fireEvent.click(screen.getByRole('button', { name: 'Sichern' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    })

    it('does not save an empty note', () => {
        const onSave = vi.fn(async () => true)
        const emptyNote = noteBody(paragraph())
        renderEditor(onSave, emptyNote)

        fireEvent.click(screen.getByRole('button', { name: 'Sichern' }))

        expect(onSave).not.toHaveBeenCalled()
    })

    it('opens a note whose link the admin stored as an autolink', () => {
        const onSave = vi.fn(async () => true)
        const adminNote = noteBody(paragraph(text('Siehe '), adminAutolink))

        const editable = renderEditor(onSave, adminNote)

        expect(editable).toHaveTextContent('Siehe https://example.org')
    })
})
