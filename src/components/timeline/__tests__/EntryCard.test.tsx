import type { Entry } from '@/lib/entry'
import { expectNoAxeViolations } from '@/test/axe'
import { sampleEntry } from '@/test/entries'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { CARD_FIRST_ROW_OFFSET_PX } from '../constants'
import {
    EntryCard,
    PRIVATE_UNDER_TESTS,
    type EntryCardProps,
} from '../EntryCard'

const { wrapperStyle } = PRIVATE_UNDER_TESTS

const point = sampleEntry('dekabristenaufstand')
const span = sampleEntry('grosser-nordischer-krieg')
const ongoing = sampleEntry('russischer-angriffskrieg-gegen-die-ukraine')
const withPost = sampleEntry('oktoberrevolution')

function renderCard(props: Partial<EntryCardProps> & { entry: Entry }) {
    const onOpen = vi.fn()
    const utils = render(
        <div className="relative">
            <EntryCard
                x={40}
                side="above"
                level={0}
                rowHeightPx={72}
                onOpen={onOpen}
                {...props}
            />
        </div>
    )
    return { ...utils, onOpen }
}

/** The card element: a button (with post) or the focusable note. */
function card(e: Entry): HTMLElement {
    return screen.getByRole(e.post ? 'button' : 'note', {
        name: new RegExp(`^${e.title}`),
    })
}

async function recordEscapes(interaction: () => Promise<void>) {
    const escapesConsumed: boolean[] = []
    const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') escapesConsumed.push(e.defaultPrevented)
    }
    window.addEventListener('keydown', onKey)
    try {
        await interaction()
    } finally {
        window.removeEventListener('keydown', onKey)
    }
    return escapesConsumed
}

describe('EntryCard', () => {
    it.each([
        ['point', point, '26. Dez. 1825'],
        ['span', span, '1700–1721'],
        ['ongoing', ongoing, 'seit 24. Feb. 2022'],
        ['point with post', withPost, '7. Nov. 1917'],
    ])('shows title and short date (%s)', (_, e, date) => {
        renderCard({ entry: e })
        const el = card(e)
        expect(el).toHaveTextContent(e.title)
        expect(el).toHaveTextContent(date)
    })

    it('shows the summary, long date and category on hover and hides it on leave', async () => {
        const user = userEvent.setup()
        renderCard({ entry: span })
        expect(screen.queryByRole('tooltip')).toBeNull()
        await user.hover(card(span))
        const tip = screen.getByRole('tooltip')
        expect(tip).toHaveTextContent(span.summary)
        expect(tip).toHaveTextContent('1700 – 10. September 1721')
        expect(tip).toHaveTextContent('Krieg')
        await user.unhover(card(span))
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('shows the tooltip on keyboard focus, hides it on blur and on Escape', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point })
        await user.tab()
        expect(card(point)).toHaveFocus()
        expect(screen.getByRole('tooltip')).toHaveTextContent(point.summary)
        expect(card(point)).toHaveAccessibleDescription(
            expect.stringContaining(point.summary)
        )
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('tooltip')).toBeNull()
        await user.tab({ shift: true })
        await user.tab()
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        await user.tab()
        expect(card(point)).not.toHaveFocus()
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('hides the tooltip after a mouse click once the pointer leaves', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point })
        await user.click(card(point))
        expect(card(point)).toHaveFocus()
        await user.unhover(card(point))
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('renders an entry with a post as a button with a marker that opens the post', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost })
        const el = screen.getByRole('button', {
            name: 'Oktoberrevolution, 7. Nov. 1917, Beitrag',
        })
        expect(el).toHaveTextContent('Beitrag ›')
        await user.click(el)
        expect(onOpen).toHaveBeenCalledExactlyOnceWith('oktoberrevolution')
    })

    it('opens the post with the keyboard', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost })
        await user.tab()
        await user.keyboard('{Enter}')
        expect(onOpen).toHaveBeenCalledWith('oktoberrevolution')
    })

    it('does not open anything for an entry without a post, which stays focusable', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: point })
        expect(screen.queryByRole('button')).toBeNull()
        const el = card(point)
        expect(el).toHaveAttribute('tabindex', '0')
        expect(el).not.toHaveTextContent('Beitrag')
        expect(el).toHaveAccessibleName('Dekabristenaufstand, 26. Dez. 1825')
        await user.click(el)
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('ignores the click after a drag', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost, wasDrag: () => true })
        await user.click(card(withPost))
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('toggles the tooltip on touch taps for an entry without a post', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point })
        const el = card(point)
        await user.pointer({ keys: '[TouchA]', target: el })
        expect(screen.getByRole('tooltip')).toHaveTextContent(point.summary)
        await user.pointer({ keys: '[TouchA]', target: el })
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('opens the post on touch for an entry with a post without showing the tooltip', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost })
        await user.pointer({ keys: '[TouchA]', target: card(withPost) })
        expect(onOpen).toHaveBeenCalledWith('oktoberrevolution')
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('does not toggle the tooltip on a touch drag', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point, wasDrag: () => true })
        await user.pointer({ keys: '[TouchA]', target: card(point) })
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('shows the tooltip on keyboard focus after an earlier press that caused no focus event', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point })
        await user.tab()
        // Press the already focused card: no focus event follows.
        await user.pointer({ keys: '[MouseLeft]', target: card(point) })
        await user.unhover(card(point))
        await user.tab()
        await user.tab({ shift: true })
        expect(card(point)).toHaveFocus()
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('dismisses a hover-opened tooltip with Escape without focus', async () => {
        const user = userEvent.setup()
        renderCard({ entry: span })
        await user.hover(card(span))
        expect(card(span)).not.toHaveFocus()
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('keeps the tooltip open while the pointer moves onto it', async () => {
        const user = userEvent.setup()
        renderCard({ entry: span })
        await user.hover(card(span))
        const tip = screen.getByRole('tooltip')
        // user-event sets no relatedTarget, which React needs to see that the
        // portalled bubble is inside the card's tree; dispatch the pair by hand.
        const mouse = { pointerType: 'mouse', pointerId: 1 }
        act(() => {
            fireEvent.pointerOut(card(span), { ...mouse, relatedTarget: tip })
            fireEvent.pointerOver(tip, { ...mouse, relatedTarget: card(span) })
        })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('renders the open tooltip in a portal on the body, outside clipping ancestors', async () => {
        const user = userEvent.setup()
        const { container } = renderCard({ entry: span, inline: true })
        // Closed: an in-place hidden element keeps aria-describedby resolvable.
        const describedBy = card(span).getAttribute('aria-describedby')!
        expect(
            container.querySelector(`[id="${describedBy}"]`)
        ).toHaveAttribute('hidden')
        await user.hover(card(span))
        const tip = screen.getByRole('tooltip')
        expect(tip.id).toBe(describedBy)
        expect(container).not.toContainElement(tip)
        expect(tip.parentElement).toBe(document.body)
        expect(tip).toHaveClass('fixed')
        // Whether real layout clips it cannot be checked in jsdom.
    })

    it('consumes Escape only when it closes a tooltip', async () => {
        const user = userEvent.setup()
        renderCard({ entry: span })
        const escapesConsumed = await recordEscapes(async () => {
            await user.keyboard('{Escape}')
            await user.hover(card(span))
            await user.keyboard('{Escape}')
            expect(screen.queryByRole('tooltip')).toBeNull()
            // Already dismissed: the next Escape is left to others.
            await user.keyboard('{Escape}')
        })
        expect(escapesConsumed).toEqual([false, true, false])
    })

    it('keeps a keyboard-opened tooltip when the mouse passes over and leaves', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point })
        await user.tab()
        await user.hover(card(point))
        await user.unhover(card(point))
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('does nothing on Enter for an entry without a post', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: point })
        await user.tab()
        await user.keyboard('{Enter}')
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('opens the post with Space', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost })
        await user.tab()
        await user.keyboard(' ')
        expect(onOpen).toHaveBeenCalledWith('oktoberrevolution')
    })

    it('opens the post when wasDrag returns false', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost, wasDrag: () => false })
        await user.click(card(withPost))
        expect(onOpen).toHaveBeenCalledWith('oktoberrevolution')
    })

    it('closes a tapped-open tooltip on a tap elsewhere', async () => {
        const user = userEvent.setup()
        renderCard({ entry: point })
        await user.pointer({ keys: '[TouchA]', target: card(point) })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        await user.pointer({ keys: '[TouchA]', target: document.body })
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('does not keep a tooltip open over an opened post, so Escape reaches the shell', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderCard({ entry: withPost })
        await user.tab()
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        await user.keyboard('{Enter}')
        expect(onOpen).toHaveBeenCalled()
        expect(screen.queryByRole('tooltip')).toBeNull()
        const escapesConsumed = await recordEscapes(() =>
            user.keyboard('{Escape}')
        )
        expect(escapesConsumed).toEqual([false])
    })

    it('leaves Escape in a text field alone', async () => {
        const user = userEvent.setup()
        render(<input aria-label="Suche" />)
        renderCard({ entry: span })
        await user.hover(card(span))
        screen.getByRole('textbox', { name: 'Suche' }).focus()
        const escapesConsumed = await recordEscapes(() =>
            user.keyboard('{Escape}')
        )
        expect(escapesConsumed).toEqual([false])
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    describe('portalled bubble position', () => {
        const rect = (
            left: number,
            top: number,
            width: number,
            height: number
        ) =>
            ({
                left,
                top,
                width,
                height,
                right: left + width,
                bottom: top + height,
                x: left,
                y: top,
                toJSON: () => ({}),
            }) as DOMRect
        function mockLayout(anchor: DOMRect) {
            const root = document.documentElement
            const spies = [
                vi.spyOn(root, 'clientWidth', 'get').mockReturnValue(1000),
                vi.spyOn(root, 'clientHeight', 'get').mockReturnValue(800),
                vi
                    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
                    .mockReturnValue(288),
                vi
                    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
                    .mockReturnValue(100),
                vi
                    .spyOn(Element.prototype, 'getBoundingClientRect')
                    .mockReturnValue(anchor),
            ]
            return () => spies.forEach((s) => s.mockRestore())
        }

        it.each([
            ['above', 'above', rect(100, 400, 176, 56), '100px', '456px'],
            ['below', 'below', rect(500, 400, 176, 56), '500px', '300px'],
            [
                'clamped right',
                'above',
                rect(900, 400, 176, 56),
                '704px',
                '456px',
            ],
            ['clamped left', 'above', rect(-100, 400, 176, 56), '8px', '456px'],
        ] as const)(
            'places it from the anchor (%s)',
            async (_, side, anchor, left, top) => {
                const restore = mockLayout(anchor)
                try {
                    const user = userEvent.setup()
                    renderCard({ entry: span, side })
                    await user.hover(card(span))
                    const tip = screen.getByRole('tooltip')
                    expect(tip.style.left).toBe(left)
                    expect(tip.style.top).toBe(top)
                    expect(tip.style.visibility).toBe('')
                } finally {
                    restore()
                }
            }
        )

        it('hides it while the anchor is inert or outside the visible area', () => {
            const restore = mockLayout(rect(100, 400, 176, 56))
            try {
                const { rerender } = render(
                    <div inert>
                        <EntryCard
                            entry={span}
                            x={0}
                            side="above"
                            level={0}
                            rowHeightPx={72}
                            onOpen={() => {}}
                            inline
                        />
                    </div>
                )
                fireEvent.pointerOver(
                    screen.getByRole('note', { hidden: true }),
                    { pointerType: 'mouse' }
                )
                expect(
                    screen.getByRole('tooltip', { hidden: true }).style
                        .visibility
                ).toBe('hidden')
                rerender(<div />)
            } finally {
                restore()
            }
            const restore2 = mockLayout(rect(-400, 400, 176, 56))
            try {
                renderCard({ entry: span })
                fireEvent.pointerOver(card(span), { pointerType: 'mouse' })
                expect(
                    screen.getByRole('tooltip', { hidden: true }).style
                        .visibility
                ).toBe('hidden')
            } finally {
                restore2()
            }
        })
    })

    it.each([
        ['russia', 'dekabristenaufstand'],
        ['west', 'franzoesische-revolution'],
        ['both', 'wiener-kongress'],
    ])(
        'sets the entry as type on the page colour, without border, shadow or region colour (%s)',
        (_, id) => {
            const e = sampleEntry(id)
            const atRest = { entry: e }
            renderCard(atRest)
            const boxClass = /^(border|bg-|shadow|rounded|ring)/
            const classes = [card(e), ...card(e).querySelectorAll('*')]
                .flatMap((el) => [...el.classList])
                .filter((c) => boxClass.test(c))
            expect(classes).toEqual(['bg-surface'])
            expect(
                document.querySelector('[data-connector]')!.className
            ).not.toMatch(/russia|west|both/)
        }
    )

    it('switches hover states without a transition', () => {
        const postEntry = { entry: withPost }
        renderCard(postEntry)
        expect(card(withPost).className).not.toMatch(/transition|duration/)
    })

    it('raises an open card above highlighted ones', async () => {
        const user = userEvent.setup()
        renderCard({ entry: span, highlighted: true })
        const w = document.querySelector<HTMLElement>(
            `[data-entry-id="${span.id}"]`
        )!
        expect(w).toHaveClass('z-20')
        await user.hover(card(span))
        expect(w).toHaveClass('z-30')
    })

    describe('positioning', () => {
        function wrapper(e: Entry) {
            return document.querySelector<HTMLElement>(
                `[data-entry-id="${e.id}"]`
            )!
        }
        function connector(e: Entry) {
            return wrapper(e).querySelector<HTMLElement>('[data-connector]')!
        }
        function titleOf(e: Entry) {
            return card(e).querySelector<HTMLElement>('.font-serif')!
        }
        function dot(e: Entry) {
            return wrapper(e).querySelector<HTMLElement>('[data-axis-dot]')!
        }

        it('places a level-1 card above the axis, its connector reaching down to the axis', () => {
            const secondRowAbove = {
                entry: span,
                x: 123,
                level: 1,
                rowHeightPx: 72,
            }
            renderCard(secondRowAbove)
            const offset = CARD_FIRST_ROW_OFFSET_PX + 72
            const w = wrapper(span)
            expect(w).toHaveClass('absolute')
            expect(w.style.left).toBe('123px')
            expect(w.style.bottom).toBe(`${offset}px`)
            expect(w.style.top).toBe('')
            expect(connector(span).style.height).toBe(`${offset}px`)
            expect(connector(span).style.bottom).toBe(`-${offset}px`)
            expect(connector(span)).toHaveClass('w-px', 'bg-fg/40')
        })

        it('centres a 7 px dot on the axis line', () => {
            const firstRow = { entry: span, level: 0 }
            renderCard(firstRow)
            const d = dot(span)
            expect(d.style.width).toBe('7px')
            expect(d.style.height).toBe('7px')
            expect(d.style.left).toBe('-3px')
            // Axis line at [0, 1] below the origin: the dot spans [-3, 4].
            expect(d.style.bottom).toBe(`-${CARD_FIRST_ROW_OFFSET_PX + 4}px`)
            expect(d).toHaveClass('rounded-full', 'bg-fg')
        })

        it('places a card below the axis from the top', () => {
            const thirdRowBelow = {
                entry: span,
                x: 10,
                side: 'below',
                level: 2,
                rowHeightPx: 60,
            } as const
            renderCard(thirdRowBelow)
            const offset = CARD_FIRST_ROW_OFFSET_PX + 120
            const w = wrapper(span)
            expect(w.style.left).toBe('10px')
            expect(w.style.top).toBe(`${offset}px`)
            expect(w.style.bottom).toBe('')
            expect(connector(span).style.top).toBe(`-${offset}px`)
            expect(connector(span).style.height).toBe(`${offset}px`)
            expect(dot(span).style.top).toBe(`-${offset + 3}px`)
        })

        it('puts the tooltip on the side facing the axis', async () => {
            const user = userEvent.setup()
            renderCard({ entry: span, side: 'below' })
            await user.hover(card(span))
            expect(screen.getByRole('tooltip')).toHaveAttribute(
                'data-placement',
                'top'
            )
        })

        it('hangs to the right of its anchor with the connector on its left', () => {
            renderCard({ entry: span, x: 300 })
            expect(wrapper(span).style.left).toBe('300px')
            expect(wrapper(span)).not.toHaveClass('-translate-x-full')
            expect(connector(span)).toHaveClass('left-0')
        })

        it('renders inline without absolute positioning, connector or dot', () => {
            const inStack = { entry: span, inline: true }
            renderCard(inStack)
            expect(document.querySelector('[data-entry-id]')).not.toHaveClass(
                'absolute'
            )
            expect(card(span).closest('.absolute')).toBeNull()
            expect(document.querySelector('[data-connector]')).toBeNull()
            expect(document.querySelector('[data-axis-dot]')).toBeNull()
        })

        it('marks the open entry by title weight and underline, a 13 px dot and an ink connector', () => {
            const openEntry = { entry: span, highlighted: true }
            renderCard(openEntry)
            expect(titleOf(span)).toHaveClass(
                'font-medium',
                'underline',
                'underline-offset-4'
            )
            expect(dot(span).style.width).toBe('13px')
            expect(dot(span).style.left).toBe('-6px')
            expect(connector(span)).toHaveClass('bg-fg')
            expect(connector(span)).not.toHaveClass('bg-fg/40')
        })

        it('keeps a closed entry at regular weight without underline', () => {
            const closedEntry = { entry: span }
            renderCard(closedEntry)
            expect(titleOf(span)).toHaveClass('font-normal')
            expect(titleOf(span)).not.toHaveClass('underline')
        })
    })

    it.each([
        ['with post', withPost],
        ['without post', point],
    ])('has no axe violations (%s, tooltip open)', async (_, e) => {
        const user = userEvent.setup()
        const { container } = renderCard({ entry: e })
        await expectNoAxeViolations(container)
        await user.hover(card(e))
        // The open bubble is portalled to the body; the bare fixture has no landmarks.
        const open = await axe(document.body, {
            rules: {
                'color-contrast': { enabled: false },
                region: { enabled: false },
            },
        })
        expect(open).toHaveNoViolations()
    })
})

describe('wrapperStyle', () => {
    it('lifts a card above the axis by the first-row offset plus its level', () => {
        expect(wrapperStyle('above', 2, 72, 40)).toEqual({
            left: 40,
            bottom: CARD_FIRST_ROW_OFFSET_PX + 144,
        })
    })

    it('lowers a card below the axis by the first-row offset plus its level', () => {
        expect(wrapperStyle('below', 1, 60, 10)).toEqual({
            left: 10,
            top: CARD_FIRST_ROW_OFFSET_PX + 60,
        })
    })
})
