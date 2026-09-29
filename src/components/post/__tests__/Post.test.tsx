import { PostContext } from '@/components/PostContext'
import { expectNoAxeViolations } from '@/test/axe'
import { sampleEntry } from '@/test/entries'
import { inLocale } from '@/test/i18n'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Post } from '../Post'

const okt = sampleEntry('oktoberrevolution')

describe('Post', () => {
    it('shows title, long date, type, tags, summary and the four body paragraphs', () => {
        render(<Post entry={okt} />)
        expect(
            screen.getByRole('heading', { level: 2, name: 'Oktoberrevolution' })
        ).toBeInTheDocument()
        expect(screen.getByText('7. November 1917')).toBeInTheDocument()
        expect(screen.getByText('Revolution').closest('p')).toHaveTextContent(
            '7. November 1917 · , Revolution · , Russland'
        )
        expect(screen.getByText(okt.summary)).toBeInTheDocument()
        expect(
            screen.getByText(/^Im Herbst 1917 war die Provisorische Regierung/)
        ).toHaveClass('text-body')
        expect(
            screen.getAllByText(/./, { selector: 'p.text-body' })
        ).toHaveLength(4)
    })

    it('has a heading that can receive focus programmatically but is not in the tab order', () => {
        render(<Post entry={okt} />)
        const heading = screen.getByRole('heading', {
            level: 2,
            name: okt.title,
        })
        expect(heading).toHaveAttribute('tabindex', '-1')
        heading.focus()
        expect(heading).toHaveFocus()
        expect(heading).toHaveClass('focus-visible:outline-2')
    })

    it('calls close from the context', async () => {
        const close = vi.fn()
        render(
            <PostContext value={{ close }}>
                <Post entry={okt} />
            </PostContext>
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Beitrag schließen' })
        )
        expect(close).toHaveBeenCalledOnce()
    })

    it('has no detectable accessibility violations', async () => {
        const { container } = render(<Post entry={okt} />)
        await expectNoAxeViolations(container)
    })

    it('shows the date and type and names the close button in English', () => {
        const english = inLocale('en')
        render(<Post entry={okt} />, { wrapper: english })
        expect(screen.getByText('7 November 1917')).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: 'Close post' })
        ).toHaveAttribute('title', 'Close')
    })
})
