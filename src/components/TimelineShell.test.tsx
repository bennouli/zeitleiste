import type { TimelineProps } from '@/components/timeline/Timeline'
import { entries } from '@/data/entries'
import type { Entry } from '@/lib/entry'
import { expectNoAxeViolations } from '@/test/axe'
import { sampleEntry } from '@/test/entries'
import { stubReducedMotion } from '@/test/motion'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const okt = sampleEntry('oktoberrevolution')
const otherPost = entries.find((e) => e.post && e.id !== 'oktoberrevolution')!
const noPost = entries.find((e) => !e.post)!

function shellAt(pathname: string, post: Entry | null, shellEntries: Entry[]) {
    nav.pathname = pathname
    return (
        <TimelineShell entries={shellEntries}>
            {post ? <Post entry={post} /> : null}
        </TimelineShell>
    )
}

function renderAt(
    pathname: string,
    post: Entry | null = pathname === '/' ? null : okt
) {
    const view = render(shellAt(pathname, post, entries))
    const rerenderAt = (
        nextPathname: string,
        nextPost: Entry | null,
        shellEntries = entries
    ) => view.rerender(shellAt(nextPathname, nextPost, shellEntries))
    return { ...view, rerenderAt }
}

function settle(ms: number) {
    return act(() => new Promise((r) => setTimeout(r, ms)))
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

beforeEach(() => {
    nav.push.mockReset()
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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
            renderAt(path, null)
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
        const { rerenderAt } = renderAt('/post/oktoberrevolution')
        const tl = screen.getByTestId('timeline')
        await userEvent.click(
            screen.getByRole('button', { name: otherPost.title })
        )
        expect(nav.push).toHaveBeenCalledWith(`/post/${otherPost.id}`, {
            scroll: false,
        })
        rerenderAt(`/post/${otherPost.id}`, otherPost)
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
        const { rerenderAt } = renderAt('/')
        expect(window.scrollTo).not.toHaveBeenCalled()
        rerenderAt('/post/oktoberrevolution', okt)
        await settle(50)
        expect(window.scrollTo).toHaveBeenCalled()
    })

    it('scrolls so the post starts at 40% of the viewport (reduced motion: one instant scroll)', async () => {
        const postTop = 1000
        stubPostTop(postTop)
        stubReducedMotion(true)
        const { rerenderAt } = renderAt('/')
        rerenderAt('/post/oktoberrevolution', okt)
        await settle(50)
        expect(window.scrollTo).toHaveBeenCalledTimes(1)
        expect(window.scrollTo).toHaveBeenLastCalledWith({
            top: postTop - window.innerHeight * 0.4,
            behavior: 'auto',
        })
    })

    it('animates the scroll over several frames and lands on the target', async () => {
        const postTop = 1000
        stubPostTop(postTop)
        stubReducedMotion(false)
        const { rerenderAt } = renderAt('/')
        rerenderAt('/post/oktoberrevolution', okt)
        await settle(800)
        const calls = vi.mocked(window.scrollTo).mock.calls
        expect(calls.length).toBeGreaterThan(3)
        expect(calls.at(-1)?.[0]).toEqual({
            top: postTop - window.innerHeight * 0.4,
            behavior: 'auto',
        })
    })

    it('does not scroll on a direct link when the post already starts in view', async () => {
        stubPostTop(window.innerHeight * 0.5)
        renderAt('/post/oktoberrevolution')
        await settle(50)
        expect(window.scrollTo).not.toHaveBeenCalled()
    })

    it('scrolls on a direct link when the post starts below the fold', async () => {
        stubPostTop(window.innerHeight * 1.2)
        renderAt('/post/oktoberrevolution')
        await settle(50)
        expect(window.scrollTo).toHaveBeenCalledTimes(1)
    })

    it('returns focus to the opening entry when the post closes', async () => {
        const { rerenderAt } = renderAt('/')
        const opener = screen.getByRole('button', { name: okt.title })
        await userEvent.click(opener)
        rerenderAt('/post/oktoberrevolution', okt)
        screen.getByRole('button', { name: 'Beitrag schließen' }).focus()
        rerenderAt('/', null)
        // The opening button was replaced by the relayout; focus goes to the same entry's new card.
        expect(opener.isConnected).toBe(false)
        expect(screen.getByRole('button', { name: okt.title })).toHaveFocus()
    })

    it('returns focus to the entry that opened the current post after a direct link and a switch', async () => {
        const { rerenderAt } = renderAt('/post/oktoberrevolution')
        await userEvent.click(
            screen.getByRole('button', { name: otherPost.title })
        )
        rerenderAt(`/post/${otherPost.id}`, otherPost)
        expect(
            screen.getByRole('heading', { level: 2, name: otherPost.title })
        ).toHaveFocus()
        rerenderAt('/', null)
        expect(
            screen.getByRole('button', { name: otherPost.title })
        ).toHaveFocus()
    })

    it('falls back to the timeline region when the entry is gone', async () => {
        const { rerenderAt } = renderAt('/')
        await userEvent.click(screen.getByRole('button', { name: okt.title }))
        rerenderAt('/post/oktoberrevolution', okt)
        const entriesWithoutOkt = entries.filter((e) => e.id !== okt.id)
        rerenderAt('/', null, entriesWithoutOkt)
        expect(screen.getByRole('region', { name: 'Zeitleiste' })).toHaveFocus()
    })

    it('moves focus to the post heading when a post opens from the timeline', async () => {
        const { rerenderAt } = renderAt('/')
        await userEvent.click(screen.getByRole('button', { name: okt.title }))
        rerenderAt('/post/oktoberrevolution', okt)
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
        await expectNoAxeViolations(container)
    })
})
