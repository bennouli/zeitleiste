import { sampleEntry } from '@/test/entries'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EntryLabel } from '../EntryLabel'

const point = sampleEntry('dekabristenaufstand')
const withPost = sampleEntry('oktoberrevolution')

/** Title and date line in visual order, top to bottom. */
function linesTopToBottom(container: HTMLElement): string[] {
    const block = container.firstElementChild as HTMLElement
    const lines = [...block.children].map((el) => el.textContent ?? '')
    return block.classList.contains('flex-col-reverse')
        ? lines.reverse()
        : lines
}

describe('EntryLabel', () => {
    it('sets the title over the date above the axis', () => {
        const { container } = render(<EntryLabel entry={point} side="above" />)
        expect(linesTopToBottom(container)).toEqual([
            point.title,
            '26. Dez. 1825',
        ])
    })

    it('sets the date over the title below the axis', () => {
        const { container } = render(<EntryLabel entry={point} side="below" />)
        expect(linesTopToBottom(container)).toEqual([
            '26. Dez. 1825',
            point.title,
        ])
    })

    it('sets the title in the serif, truncated, and the date in small caps', () => {
        render(<EntryLabel entry={point} side="above" />)
        expect(screen.getByText(point.title)).toHaveClass(
            'font-serif',
            'text-entry',
            'truncate'
        )
        expect(screen.getByText('26. Dez. 1825')).toHaveClass(
            'small-caps',
            'tracking-date',
            'text-fg-muted'
        )
    })

    it('appends an underlined "Beitrag" and a chevron icon in ink for an entry with a post, hidden from screen readers', () => {
        render(<EntryLabel entry={withPost} side="above" />)
        const suffix = screen.getByText('Beitrag')
        expect(suffix).toHaveClass('underline', 'underline-offset-3')
        expect(suffix.parentElement).toHaveClass('font-medium', 'text-fg')
        const chevron = suffix.parentElement!.querySelector('svg')
        expect(chevron).toHaveAttribute('stroke', 'currentColor')
        expect(chevron).toHaveAttribute('aria-hidden', 'true')
        expect(suffix.closest('[aria-hidden="true"]')).not.toBeNull()
        expect(suffix.parentElement).toHaveTextContent(/^Beitrag$/)
    })

    it('shows no suffix without a post', () => {
        render(<EntryLabel entry={point} side="above" />)
        expect(screen.queryByText(/Beitrag/)).toBeNull()
    })
})
