import { inLocale } from '@/test/i18n'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteBody } from '../noteBody'
import { NoteEditor } from '../NoteEditor'
import { splitTitle } from '../noteTitle'
import { noteBody, paragraph, text } from './noteFixtures'

const LABEL = 'Notiz bearbeiten'
const WRITTEN = noteBody(paragraph(text('Kiew 1240')))

function renderEditor(
    onSave: (body: NoteBody) => Promise<boolean>,
    initialBody = WRITTEN
) {
    render(
        <NoteEditor initialBody={initialBody} label={LABEL} onSave={onSave} />,
        { wrapper: inLocale('de') }
    )
    return screen.getByRole('textbox', { name: LABEL })
}

describe('NoteEditor', () => {
    it('saves with Ctrl+Enter', async () => {
        const onSave = vi.fn<(body: NoteBody) => Promise<boolean>>(
            async () => true
        )
        const editable = renderEditor(onSave)

        fireEvent.keyDown(editable, { key: 'Enter', ctrlKey: true })

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
        const savedBody = onSave.mock.lastCall?.[0]
        expect(savedBody && splitTitle(savedBody).title).toBe('Kiew 1240')
    })

    it('saves with Cmd+Enter', async () => {
        const onSave = vi.fn(async () => true)
        const editable = renderEditor(onSave)

        fireEvent.keyDown(editable, { key: 'Enter', metaKey: true })

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    })

    it('does not save on a plain Enter', () => {
        const onSave = vi.fn(async () => true)
        const editable = renderEditor(onSave)

        fireEvent.keyDown(editable, { key: 'Enter' })

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
})
