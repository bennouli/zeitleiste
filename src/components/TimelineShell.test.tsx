import type { TimelineProps } from '@/components/timeline/Timeline'
import { entries } from '@/data/entries'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { Post } from './post/Post'
import { TimelineShell } from './TimelineShell'

const nav = vi.hoisted(() => ({ pathname: '/', push: vi.fn() }))

vi.mock('next/navigation', () => ({
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: nav.push }),
}))

vi.mock('@/components/timeline/Timeline', () => ({
    Timeline: ({
        entries,
        collapsed,
        focusEntryId,
        onOpenEntry,
    }: TimelineProps) => (
        <section
            role="region"
            aria-label="Zeitleiste"
            tabIndex={0}
            data-testid="timeline"
            data-collapsed={String(collapsed)}
            data-focus={focusEntryId ?? ''}
        >
            {/* Keyed by `collapsed`: like the real timeline's relayout, opening a post replaces the cards. */}
            {entries.map((e) => (
                <div key={`${e.id}:${collapsed}`} data-entry-id={e.id}>
                    <button type="button" onClick={() => onOpenEntry(e.id)}>
                        {e.title}
                    </button>
                </div>
            ))}
        </section>
    ),
}))

const okt = entries.find((e) => e.id === 'oktoberrevolution')!
const otherPost = entries.find((e) => e.post && e.id !== 'oktoberrevolution')!
const noPost = entries.find((e) => !e.post)!

function renderAt(pathname: string, withPost = pathname !== '/') {
    nav.pathname = pathname
    return render(
        <TimelineShell entries={entries}>
            {withPost ? <Post entry={okt} /> : null}
        </TimelineShell>
    )
}

function stubPostTop(top: number) {
    const original = Element.prototype.getBoundingClientRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
            return this.id === 'post'
                ? ({ top } as DOMRect)
                : original.call(this)
        }
    )
}

function stubReducedMotion(matches: boolean) {
    window.matchMedia = vi.fn(() => ({ matches }) as MediaQueryList)
}

beforeEach(() => {
    nav.push.mockReset()
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

const originalMatchMedia = window.matchMedia

afterEach(() => {
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
})

describe('TimelineShell', () => {
    it('shows the full timeline and no post on /', () => {
        renderAt('/')
        const tl = screen.getByTestId('timeline')
        expect(tl).toHaveAttribute('data-collapsed', 'false')
        expect(tl).toHaveAttribute('data-focus', '')
        expect(screen.queryByRole('article')).not.toBeInTheDocument()
        expect(
            screen.getByRole('heading', { level: 1, name: /Zeitleiste/ })
        ).toBeInTheDocument()
    })

    it('collapses and focuses the timeline on a post address and renders the post', () => {
        renderAt('/post/oktoberrevolution')
        const tl = screen.getByTestId('timeline')
        expect(tl).toHaveAttribute('data-collapsed', 'true')
        expect(tl).toHaveAttribute('data-focus', 'oktoberrevolution')
        expect(screen.getByRole('article')).toBeInTheDocument()
    })

    it('accepts a leading locale segment', () => {
        renderAt('/de/post/oktoberrevolution')
        expect(screen.getByTestId('timeline')).toHaveAttribute(
            'data-focus',
            'oktoberrevolution'
        )
    })

    it.each(['/post/gibt-es-nicht', `/post/${noPost.id}`, '/irgendwas'])(
        'collapses without focus for a 404 page (%s)',
        (path) => {
            renderAt(path, false)
            const tl = screen.getByTestId('timeline')
            expect(tl).toHaveAttribute('data-collapsed', 'true')
            expect(tl).toHaveAttribute('data-focus', '')
        }
    )

    it('opens a post by pushing its address', async () => {
        renderAt('/')
        await userEvent.click(screen.getByRole('button', { name: okt.title }))
        expect(nav.push).toHaveBeenCalledWith('/post/oktoberrevolution', {
            scroll: false,
        })
    })

    it('switches between posts without remounting the timeline', async () => {
        const { rerender } = renderAt('/post/oktoberrevolution')
        const tl = screen.getByTestId('timeline')
        await userEvent.click(
            screen.getByRole('button', { name: otherPost.title })
        )
        expect(nav.push).toHaveBeenCalledWith(`/post/${otherPost.id}`, {
            scroll: false,
        })
        nav.pathname = `/post/${otherPost.id}`
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={otherPost} />
            </TimelineShell>
        )
        expect(screen.getByTestId('timeline')).toBe(tl)
        expect(tl).toHaveAttribute('data-focus', otherPost.id)
    })

    it('ignores entries without a post and the already open one', async () => {
        renderAt('/post/oktoberrevolution')
        await userEvent.click(
            screen.getByRole('button', { name: noPost.title })
        )
        await userEvent.click(screen.getByRole('button', { name: okt.title }))
        expect(nav.push).not.toHaveBeenCalled()
    })

    it('closes on Escape', () => {
        renderAt('/post/oktoberrevolution')
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(nav.push).toHaveBeenCalledWith('/', { scroll: false })
    })

    it('ignores Escape when no post is open', () => {
        renderAt('/')
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(nav.push).not.toHaveBeenCalled()
    })

    it('ignores Escape that something else already handled or while typing', () => {
        renderAt('/post/oktoberrevolution')
        const input = document.createElement('input')
        document.body.append(input)
        fireEvent.keyDown(input, { key: 'Escape' })
        input.remove()
        const handled = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
        })
        handled.preventDefault()
        act(() => {
            window.dispatchEvent(handled)
        })
        expect(nav.push).not.toHaveBeenCalled()
    })

    it('closes with the close button of the post', async () => {
        renderAt('/post/oktoberrevolution')
        await userEvent.click(
            screen.getByRole('button', { name: 'Beitrag schließen' })
        )
        expect(nav.push).toHaveBeenCalledWith('/', { scroll: false })
    })

    it('scrolls the post into view when a post opens', async () => {
        const { rerender } = renderAt('/')
        expect(window.scrollTo).not.toHaveBeenCalled()
        nav.pathname = '/post/oktoberrevolution'
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={okt} />
            </TimelineShell>
        )
        await act(() => new Promise((r) => setTimeout(r, 50)))
        expect(window.scrollTo).toHaveBeenCalled()
    })

    it('scrolls so the post starts at 40% of the viewport (reduced motion: one instant scroll)', async () => {
        stubPostTop(1000)
        stubReducedMotion(true)
        const { rerender } = renderAt('/')
        nav.pathname = '/post/oktoberrevolution'
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={okt} />
            </TimelineShell>
        )
        await act(() => new Promise((r) => setTimeout(r, 50)))
        expect(window.scrollTo).toHaveBeenCalledTimes(1)
        expect(window.scrollTo).toHaveBeenLastCalledWith({
            top: 1000 - window.innerHeight * 0.4,
            behavior: 'auto',
        })
    })

    it('animates the scroll over several frames and lands on the target', async () => {
        stubPostTop(1000)
        stubReducedMotion(false)
        const { rerender } = renderAt('/')
        nav.pathname = '/post/oktoberrevolution'
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={okt} />
            </TimelineShell>
        )
        await act(() => new Promise((r) => setTimeout(r, 800)))
        const calls = vi.mocked(window.scrollTo).mock.calls
        expect(calls.length).toBeGreaterThan(3)
        expect(calls.at(-1)?.[0]).toEqual({
            top: 1000 - window.innerHeight * 0.4,
            behavior: 'auto',
        })
    })

    it('does not scroll on a direct link when the post already starts in view', async () => {
        stubPostTop(window.innerHeight * 0.5)
        renderAt('/post/oktoberrevolution')
        await act(() => new Promise((r) => setTimeout(r, 50)))
        expect(window.scrollTo).not.toHaveBeenCalled()
    })

    it('scrolls on a direct link when the post starts below the fold', async () => {
        stubPostTop(window.innerHeight * 1.2)
        renderAt('/post/oktoberrevolution')
        await act(() => new Promise((r) => setTimeout(r, 50)))
        expect(window.scrollTo).toHaveBeenCalledTimes(1)
    })

    it('returns focus to the opening entry when the post closes', async () => {
        const { rerender } = renderAt('/')
        const opener = screen.getByRole('button', { name: okt.title })
        await userEvent.click(opener)
        nav.pathname = '/post/oktoberrevolution'
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={okt} />
            </TimelineShell>
        )
        screen.getByRole('button', { name: 'Beitrag schließen' }).focus()
        nav.pathname = '/'
        rerender(<TimelineShell entries={entries}>{null}</TimelineShell>)
        // The opening button was replaced by the relayout; focus goes to the same entry's new card.
        expect(opener.isConnected).toBe(false)
        expect(screen.getByRole('button', { name: okt.title })).toHaveFocus()
    })

    it('returns focus to the entry that opened the current post after a direct link and a switch', async () => {
        const { rerender } = renderAt('/post/oktoberrevolution')
        await userEvent.click(
            screen.getByRole('button', { name: otherPost.title })
        )
        nav.pathname = `/post/${otherPost.id}`
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={otherPost} />
            </TimelineShell>
        )
        expect(
            screen.getByRole('heading', { level: 2, name: otherPost.title })
        ).toHaveFocus()
        nav.pathname = '/'
        rerender(<TimelineShell entries={entries}>{null}</TimelineShell>)
        expect(
            screen.getByRole('button', { name: otherPost.title })
        ).toHaveFocus()
    })

    it('falls back to the timeline region when the entry is gone', async () => {
        const { rerender } = renderAt('/')
        await userEvent.click(screen.getByRole('button', { name: okt.title }))
        nav.pathname = '/post/oktoberrevolution'
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={okt} />
            </TimelineShell>
        )
        nav.pathname = '/'
        rerender(
            <TimelineShell entries={entries.filter((e) => e.id !== okt.id)}>
                {null}
            </TimelineShell>
        )
        expect(screen.getByRole('region', { name: 'Zeitleiste' })).toHaveFocus()
    })

    it('moves focus to the post heading when a post opens from the timeline', async () => {
        const { rerender } = renderAt('/')
        await userEvent.click(screen.getByRole('button', { name: okt.title }))
        nav.pathname = '/post/oktoberrevolution'
        rerender(
            <TimelineShell entries={entries}>
                <Post entry={okt} />
            </TimelineShell>
        )
        expect(
            screen.getByRole('heading', { level: 2, name: okt.title })
        ).toHaveFocus()
    })

    it('leaves focus alone on a direct link to a post', () => {
        renderAt('/post/oktoberrevolution')
        expect(document.body).toHaveFocus()
    })

    it('has no detectable accessibility violations', async () => {
        const { container } = renderAt('/post/oktoberrevolution')
        const results = await axe(container, {
            rules: { 'color-contrast': { enabled: false } },
        })
        expect(results).toHaveNoViolations()
    })
})
