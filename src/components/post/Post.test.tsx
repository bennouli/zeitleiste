import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { PostContext } from '@/components/TimelineShell'
import { entries } from '@/data/entries'
import { Post } from './Post'

const okt = entries.find((e) => e.id === 'oktoberrevolution')!

describe('Post', () => {
  it('shows title, long date, category, region, summary and all paragraphs', () => {
    render(<Post entry={okt} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Oktoberrevolution' })).toBeInTheDocument()
    expect(screen.getByText('7. November 1917')).toBeInTheDocument()
    expect(screen.getByText(/Revolution/, { selector: 'p.text-fg-muted' })).toHaveTextContent(
      /Revolution.*Russland\/Sowjetunion/,
    )
    expect(screen.getByText(okt.summary)).toBeInTheDocument()
    const paras = okt.post!.body.split(/\n\s*\n/)
    expect(paras).toHaveLength(4)
    for (const p of paras) expect(screen.getByText(p.trim())).toBeInTheDocument()
  })

  it('calls close from the context', async () => {
    const close = vi.fn()
    render(
      <PostContext value={{ close }}>
        <Post entry={okt} />
      </PostContext>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Beitrag schließen' }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<Post entry={okt} />)
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})
