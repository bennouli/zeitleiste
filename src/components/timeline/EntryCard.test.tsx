import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { entries } from '@/data/entries'
import type { Entry } from '@/lib/entry'
import { CONNECTOR_MIN_PX, EntryCard, type EntryCardProps } from './EntryCard'

function entry(id: string): Entry {
  const e = entries.find((x) => x.id === id)
  if (!e) throw new Error(`missing sample entry ${id}`)
  return e
}

const point = entry('dekabristenaufstand')
const span = entry('grosser-nordischer-krieg')
const ongoing = entry('russischer-angriffskrieg-gegen-die-ukraine')
const withPost = entry('oktoberrevolution')

function renderCard(props: Partial<EntryCardProps> & { entry: Entry }) {
  const onOpen = vi.fn()
  const utils = render(
    <div className="relative">
      <EntryCard x={40} side="above" level={0} rowHeightPx={72} onOpen={onOpen} {...props} />
    </div>,
  )
  return { ...utils, onOpen }
}

/** The card element: a button (with post) or the focusable note. */
function card(e: Entry): HTMLElement {
  return screen.getByRole(e.post ? 'button' : 'note', { name: new RegExp(`^${e.title}`) })
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
    expect(card(point)).toHaveAccessibleDescription(expect.stringContaining(point.summary))
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
    const el = screen.getByRole('button', { name: 'Oktoberrevolution, 7. Nov. 1917, Beitrag' })
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
    await user.hover(screen.getByRole('tooltip'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
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

  it.each([
    ['west', 'franzoesische-revolution'],
    ['both', 'wiener-kongress'],
  ])('colors card and connector by region (%s)', (region, id) => {
    const e = entry(id)
    renderCard({ entry: e })
    expect(card(e)).toHaveClass(`border-l-${region}`)
    const w = document.querySelector<HTMLElement>(`[data-entry-id="${id}"]`)!
    expect(w.querySelector('[aria-hidden="true"]')).toHaveClass(`bg-${region}`)
  })

  it('raises an open card above highlighted ones', async () => {
    const user = userEvent.setup()
    renderCard({ entry: span, highlighted: true })
    const w = document.querySelector<HTMLElement>(`[data-entry-id="${span.id}"]`)!
    expect(w).toHaveClass('z-20')
    await user.hover(card(span))
    expect(w).toHaveClass('z-30')
  })

  describe('positioning', () => {
    function wrapper(e: Entry) {
      return document.querySelector<HTMLElement>(`[data-entry-id="${e.id}"]`)!
    }
    function connector(e: Entry) {
      return wrapper(e).querySelector<HTMLElement>('[aria-hidden="true"]')!
    }

    it('places a level-1 card above the axis', () => {
      renderCard({ entry: span, x: 123, level: 1, rowHeightPx: 72 })
      const w = wrapper(span)
      expect(w).toHaveClass('absolute')
      expect(w.style.left).toBe('123px')
      expect(w.style.bottom).toBe('72px')
      expect(w.style.top).toBe('')
      expect(connector(span).style.height).toBe(`${72 + CONNECTOR_MIN_PX}px`)
      expect(connector(span).style.bottom).toBe('-72px')
      expect(connector(span)).toHaveClass('bg-russia')
      expect(card(span)).toHaveClass('border-l-russia')
    })

    it('places a card below the axis from the top', () => {
      renderCard({ entry: span, x: 10, side: 'below', level: 2, rowHeightPx: 60 })
      const w = wrapper(span)
      expect(w.style.left).toBe('10px')
      expect(w.style.top).toBe('120px')
      expect(w.style.bottom).toBe('')
      expect(connector(span).style.top).toBe('-120px')
      expect(connector(span).style.height).toBe(`${120 + CONNECTOR_MIN_PX}px`)
    })

    it('puts the tooltip on the side facing the axis', async () => {
      const user = userEvent.setup()
      renderCard({ entry: span, side: 'below' })
      await user.hover(card(span))
      expect(screen.getByRole('tooltip')).toHaveClass('bottom-full')
    })

    it('anchors the right edge with alignEnd', () => {
      renderCard({ entry: span, x: 300, alignEnd: true })
      expect(wrapper(span).style.left).toBe('300px')
      expect(wrapper(span)).toHaveClass('-translate-x-full')
      expect(connector(span)).toHaveClass('right-0')
    })

    it('aligns the tooltip to the right edge with alignEnd', async () => {
      const user = userEvent.setup()
      renderCard({ entry: span, alignEnd: true })
      await user.hover(card(span))
      expect(screen.getByRole('tooltip')).toHaveClass('right-0')
    })

    it('renders inline without absolute positioning or connector', () => {
      renderCard({ entry: span, inline: true })
      expect(document.querySelector('[data-entry-id]')).toBeNull()
      expect(card(span).closest('.absolute')).toBeNull()
    })

    it('marks a highlighted card', () => {
      renderCard({ entry: span, highlighted: true })
      expect(card(span)).toHaveClass('ring-2', 'ring-focus')
    })
  })

  it.each([
    ['with post', withPost],
    ['without post', point],
  ])('has no axe violations (%s, tooltip open)', async (_, e) => {
    const user = userEvent.setup()
    const { container } = renderCard({ entry: e })
    const closed = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(closed).toHaveNoViolations()
    await user.hover(card(e))
    const open = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(open).toHaveNoViolations()
  })
})
