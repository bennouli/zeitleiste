import type { NotesLoad } from '@/lib/noteSchema'
import { expectNoAxeViolations } from '@/test/axe'
import { inLocale } from '@/test/i18n'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesButton } from '../NotesButton'
import { NotesProvider, type NotesActions } from '../NotesContext'
import { NOTES_ASIDE_ID } from '../NotesOverlayContext'
import { NotesSidebar } from '../NotesSidebar'

const PANEL_TEXT = 'Platzhalter für die Notizen'
const DRAFT_LABEL = 'Entwurf'

vi.mock('../NotesPanel', () => ({
    NotesPanel: () => (
        <label>
            {PANEL_TEXT}
            <input aria-label={DRAFT_LABEL} />
        </label>
    ),
}))

const LOADED: NotesLoad = { notes: [], loadFailed: false }

const ACTIONS: NotesActions = {
    createNote: async () => ({ stored: false, signedOut: false }),
    updateNote: async () => ({ stored: false, signedOut: false }),
    deleteNote: async () => ({ deleted: false, signedOut: false }),
}

afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
})

/** jsdom applies no Tailwind; this answers the aside's `position` as the breakpoint would. */
function stubAsidePosition(position: 'fixed' | 'sticky') {
    const realStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
        const style = realStyle(el, pseudo)
        if (el.id === NOTES_ASIDE_ID)
            Object.defineProperty(style, 'position', { value: position })
        return style
    })
}

function renderPage() {
    return render(
        <NotesProvider initialLoad={LOADED} actions={ACTIONS}>
            <div>
                <main data-testid="page">
                    <NotesButton />
                </main>
                <NotesSidebar />
            </div>
        </NotesProvider>,
        { wrapper: inLocale('de') }
    )
}

const openButton = () => screen.findByRole('button', { name: 'Notizen öffnen' })

async function openOverlay() {
    const button = await openButton()
    await userEvent.click(button)
    return button
}

describe('the notes overlay', () => {
    it('shows no button outside a reader’s notes provider', () => {
        render(<NotesButton />, { wrapper: inLocale('de') })

        expect(
            screen.queryByRole('button', { name: 'Notizen öffnen' })
        ).not.toBeInTheDocument()
    })

    it('opens over an inert page with focus inside', async () => {
        renderPage()
        const button = await openOverlay()

        expect(button).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByTestId('page')).toHaveAttribute('inert')
        expect(
            screen.getByRole('button', { name: 'Notizen schließen' })
        ).toHaveFocus()
    })

    it('closes from its close button and focuses the opener on a live page', async () => {
        renderPage()
        const button = await openOverlay()

        await userEvent.click(
            screen.getByRole('button', { name: 'Notizen schließen' })
        )

        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByTestId('page')).not.toHaveAttribute('inert')
        expect(button).toHaveFocus()
    })

    it('closes on Escape and keeps the key from closing anything else', async () => {
        renderPage()
        const button = await openOverlay()
        const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        })

        act(() => {
            screen.getByLabelText(DRAFT_LABEL).dispatchEvent(escape)
        })

        expect(escape.defaultPrevented).toBe(true)
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(button).toHaveFocus()
    })

    it('keeps the same panel, and its draft, across opening and closing', async () => {
        const draft = 'Kiew 1240'
        renderPage()
        await openButton()
        const input = screen.getByLabelText(DRAFT_LABEL)
        await openOverlay()
        await userEvent.type(input, draft)
        await userEvent.keyboard('{Escape}')

        await openOverlay()

        expect(screen.getByLabelText(DRAFT_LABEL)).toBe(input)
        expect(input).toHaveValue(draft)
    })

    it('stays open when the window is resized and the notes still cover the page', async () => {
        stubAsidePosition('fixed')
        renderPage()
        const button = await openOverlay()
        const resize = new Event('resize')

        fireEvent(window, resize)

        expect(button).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByTestId('page')).toHaveAttribute('inert')
    })

    it('becomes the sidebar again when the window widens, leaving focus where it is', async () => {
        stubAsidePosition('sticky')
        renderPage()
        const button = await openOverlay()
        const input = screen.getByLabelText(DRAFT_LABEL)
        input.focus()
        const resize = new Event('resize')

        fireEvent(window, resize)

        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByTestId('page')).not.toHaveAttribute('inert')
        expect(input).toHaveFocus()
    })

    it('has no axe violations while open', async () => {
        renderPage()
        await openOverlay()
        await expectNoAxeViolations(document.body)
    })
})
