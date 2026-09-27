import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { Entry } from '@/lib/entry'
import { GroupMarker } from './GroupMarker'
import { GROUP_STACK_CONTROLS_HEIGHT_PX, GroupStack, groupStackHeightPx } from './GroupStack'

function makeEntries(n: number): Entry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    title: `Eintrag ${i + 1}`,
    summary: `Zusammenfassung ${i + 1}`,
    start: { year: 1914 + i },
    region: 'russia',
    category: 'event',
    importance: 2,
  }))
}

const SLOT = 100

function setup(props: Partial<React.ComponentProps<typeof GroupStack>> = {}) {
  const renderCard = vi.fn<(entry: Entry, index: number) => React.ReactNode>((entry) => (
    <button type="button" data-testid={`card-${entry.id}`}>
      {entry.title}
    </button>
  ))
  const utils = render(
    <GroupStack
      entries={makeEntries(7)}
      visibleCount={3}
      slotHeightPx={SLOT}
      renderCard={renderCard}
      label="Gruppe: 1914–1920"
      {...props}
    />,
  )
  const group = screen.getByRole('group', { name: 'Gruppe: 1914–1920' })
  const list = within(group).getByRole('list')
  const viewport = list.parentElement!
  return { ...utils, renderCard, group, list, viewport }
}

const translate = (list: HTMLElement) => list.style.transform
const up = () => screen.getByRole('button', { name: 'Einen Eintrag nach oben' })
const down = () => screen.getByRole('button', { name: 'Einen Eintrag nach unten' })

describe('GroupStack', () => {
  it('shows visibleCount slots and renders every entry in order', () => {
    const { viewport, renderCard, list } = setup()
    expect(viewport.style.height).toBe('300px')
    expect(renderCard).toHaveBeenCalledTimes(7)
    expect(renderCard.mock.calls.map(([e, i]) => [e.id, i])).toEqual(
      Array.from({ length: 7 }, (_, i) => [`e${i}`, i]),
    )
    const items = list.querySelectorAll('li')
    expect(items).toHaveLength(7)
    expect(items[0]).toHaveStyle({ height: '100px' })
    // Off-window cards are hidden from focus and assistive tech.
    expect(items[2]).not.toHaveAttribute('inert')
    expect(items[3]).toHaveAttribute('inert')
    expect(items[3]).toHaveAttribute('aria-hidden', 'true')
  })

  it('steps by one with the buttons and disables them at the ends', async () => {
    const user = userEvent.setup()
    const onIndexChange = vi.fn()
    const { list, group } = setup({ onIndexChange })
    expect(screen.getByText('1 von 7')).toHaveAttribute('aria-live', 'polite')
    expect(up()).toBeDisabled()
    expect(down()).toBeEnabled()

    await user.click(down())
    expect(screen.getByText('2 von 7')).toBeInTheDocument()
    expect(translate(list)).toBe('translateY(-100px)')
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
    expect(up()).toBeEnabled()

    await user.click(down())
    await user.click(down())
    await user.click(down())
    expect(screen.getByText('5 von 7')).toBeInTheDocument()
    expect(down()).toBeDisabled()
    expect(group).toHaveFocus()
    expect(onIndexChange).toHaveBeenCalledTimes(4)

    await user.click(up())
    expect(screen.getByText('4 von 7')).toBeInTheDocument()
    expect(onIndexChange).toHaveBeenLastCalledWith(3)
  })

  it('steps with arrow keys and jumps with Home/End', async () => {
    const user = userEvent.setup()
    const { group, list } = setup()
    group.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByText('2 von 7')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(screen.getByText('1 von 7')).toBeInTheDocument()
    await user.keyboard('{End}')
    expect(screen.getByText('5 von 7')).toBeInTheDocument()
    expect(translate(list)).toBe('translateY(-400px)')
    await user.keyboard('{Home}')
    expect(screen.getByText('1 von 7')).toBeInTheDocument()
  })

  it('handles arrow keys from a focused card and prevents page scrolling', () => {
    setup()
    const card = screen.getByTestId('card-e0')
    const ev = createEvent.keyDown(card, { key: 'ArrowDown' })
    fireEvent(card, ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(screen.getByText('2 von 7')).toBeInTheDocument()
  })

  it('leaves keys alone that a card already handled', () => {
    render(
      <GroupStack
        entries={makeEntries(5)}
        visibleCount={1}
        slotHeightPx={SLOT}
        label="Gruppe"
        renderCard={(e) => (
          <button type="button" onKeyDown={(ev) => ev.preventDefault()}>
            {e.title}
          </button>
        )}
      />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: 'Eintrag 1' }), { key: 'ArrowDown' })
    expect(screen.getByText('1 von 5')).toBeInTheDocument()
  })

  it('omits the controls when all entries fit', () => {
    const { viewport, group } = setup({ entries: makeEntries(3) })
    expect(within(group).queryByRole('button', { name: /Einen Eintrag/ })).toBeNull()
    expect(screen.queryByText(/von 3/)).toBeNull()
    expect(viewport.style.height).toBe('300px')
  })

  it('sizes the viewport to the entry count when fewer than visibleCount', () => {
    const { viewport } = setup({ entries: makeEntries(2) })
    expect(viewport.style.height).toBe('200px')
    expect(groupStackHeightPx(2, 3, SLOT)).toBe(200)
    expect(groupStackHeightPx(7, 3, SLOT)).toBe(300 + GROUP_STACK_CONTROLS_HEIGHT_PX)
  })

  it('does not capture the mouse wheel', () => {
    const { viewport, group, list } = setup()
    for (const target of [viewport, group, screen.getByTestId('card-e1')]) {
      const ev = createEvent.wheel(target, { deltaY: 120 })
      fireEvent(target, ev)
      expect(ev.defaultPrevented).toBe(false)
    }
    expect(screen.getByText('1 von 7')).toBeInTheDocument()
    expect(translate(list)).toBe('translateY(0px)')
  })

  it('steps once per vertical touch swipe and ignores horizontal and mouse drags', () => {
    const { viewport } = setup()
    const card = screen.getByTestId('card-e0')
    const touch = { pointerType: 'touch', pointerId: 1, isPrimary: true }

    fireEvent.pointerDown(card, { ...touch, clientX: 50, clientY: 200 })
    fireEvent.pointerMove(card, { ...touch, clientX: 50, clientY: 180 })
    expect(screen.getByText('1 von 7')).toBeInTheDocument()
    fireEvent.pointerMove(card, { ...touch, clientX: 52, clientY: 160 })
    fireEvent.pointerMove(card, { ...touch, clientX: 52, clientY: 60 })
    fireEvent.pointerUp(card, { ...touch, clientX: 52, clientY: 60 })
    expect(screen.getByText('2 von 7')).toBeInTheDocument()

    // Swipe down → back one.
    fireEvent.pointerDown(viewport, { ...touch, clientX: 50, clientY: 100 })
    fireEvent.pointerMove(viewport, { ...touch, clientX: 50, clientY: 140 })
    fireEvent.pointerUp(viewport, touch)
    expect(screen.getByText('1 von 7')).toBeInTheDocument()

    // Horizontal move → ignored (the timeline pans).
    fireEvent.pointerDown(viewport, { ...touch, clientX: 50, clientY: 100 })
    fireEvent.pointerMove(viewport, { ...touch, clientX: 150, clientY: 60 })
    fireEvent.pointerUp(viewport, touch)
    expect(screen.getByText('1 von 7')).toBeInTheDocument()

    // Mouse drag → ignored.
    const mouse = { pointerType: 'mouse', pointerId: 2 }
    fireEvent.pointerDown(viewport, { ...mouse, clientX: 50, clientY: 200 })
    fireEvent.pointerMove(viewport, { ...mouse, clientX: 50, clientY: 100 })
    fireEvent.pointerUp(viewport, mouse)
    expect(screen.getByText('1 von 7')).toBeInTheDocument()

    expect(viewport.style.touchAction).toBe('pan-x')
  })

  it('clamps initialIndex and follows changes to it', () => {
    const entries = makeEntries(7)
    const renderCard = (e: Entry) => <span>{e.title}</span>
    const { rerender, getByRole } = render(
      <GroupStack entries={entries} visibleCount={3} slotHeightPx={SLOT} renderCard={renderCard} label="G" initialIndex={10} />,
    )
    expect(screen.getByText('5 von 7')).toBeInTheDocument()
    expect(getByRole('list').style.transform).toBe('translateY(-400px)')
    rerender(
      <GroupStack entries={entries} visibleCount={3} slotHeightPx={SLOT} renderCard={renderCard} label="G" initialIndex={2} />,
    )
    expect(screen.getByText('3 von 7')).toBeInTheDocument()
    rerender(
      <GroupStack entries={entries} visibleCount={3} slotHeightPx={SLOT} renderCard={renderCard} label="G" initialIndex={-3} />,
    )
    expect(screen.getByText('1 von 7')).toBeInTheDocument()
  })

  it('re-clamps when visibleCount grows', () => {
    const entries = makeEntries(4)
    const renderCard = (e: Entry) => <span>{e.title}</span>
    const { rerender } = render(
      <GroupStack entries={entries} visibleCount={1} slotHeightPx={SLOT} renderCard={renderCard} label="G" initialIndex={3} />,
    )
    expect(screen.getByText('4 von 4')).toBeInTheDocument()
    rerender(
      <GroupStack entries={entries} visibleCount={2} slotHeightPx={SLOT} renderCard={renderCard} label="G" initialIndex={3} />,
    )
    expect(screen.getByText('3 von 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Einen Eintrag nach unten' })).toBeDisabled()
  })

  it('keeps focus in the group when the focused card leaves the window', () => {
    const { group } = setup()
    const card = screen.getByTestId('card-e0')
    card.focus()
    fireEvent.keyDown(card, { key: 'ArrowDown' })
    expect(screen.getByText('2 von 7')).toBeInTheDocument()
    expect(group).toHaveFocus()
    // A card still in the window keeps focus.
    const card2 = screen.getByTestId('card-e2')
    card2.focus()
    fireEvent.keyDown(card2, { key: 'ArrowDown' })
    expect(screen.getByText('3 von 7')).toBeInTheDocument()
    expect(card2).toHaveFocus()
  })

  it('does not swallow keys when everything fits', () => {
    const { group } = setup({ entries: makeEntries(2) })
    for (const key of ['ArrowDown', 'Home', 'End']) {
      const ev = createEvent.keyDown(group, { key })
      fireEvent(group, ev)
      expect(ev.defaultPrevented).toBe(false)
    }
  })

  it('renders nothing for an empty group', () => {
    const { container } = render(
      <GroupStack entries={[]} visibleCount={3} slotHeightPx={SLOT} renderCard={() => null} label="G" />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(groupStackHeightPx(0, 3, SLOT)).toBe(0)
  })

  it('normalises visibleCount the same way in the component and the height helper', () => {
    expect(groupStackHeightPx(1, 0, SLOT)).toBe(SLOT)
    expect(groupStackHeightPx(5, 2.5, SLOT)).toBe(2 * SLOT + GROUP_STACK_CONTROLS_HEIGHT_PX)
    const { viewport } = setup({ entries: makeEntries(5), visibleCount: 2.5 })
    expect(viewport.style.height).toBe('200px')
    expect(screen.getByText('1 von 5')).toBeInTheDocument()
  })

  it('reports window changes from initialIndex and re-clamping, not the initial position', () => {
    const onIndexChange = vi.fn()
    const renderCard = (e: Entry) => <span>{e.title}</span>
    const props = { visibleCount: 2, slotHeightPx: SLOT, renderCard, label: 'G', onIndexChange }
    const { rerender } = render(<GroupStack {...props} entries={makeEntries(6)} initialIndex={3} />)
    expect(onIndexChange).not.toHaveBeenCalled()
    rerender(<GroupStack {...props} entries={makeEntries(6)} initialIndex={1} />)
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
    rerender(<GroupStack {...props} entries={makeEntries(6)} initialIndex={4} />)
    expect(onIndexChange).toHaveBeenLastCalledWith(4)
    rerender(<GroupStack {...props} entries={makeEntries(3)} initialIndex={4} />)
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
    expect(onIndexChange).toHaveBeenCalledTimes(3)
  })

  it('resets the swipe on pointercancel and swallows the click after a stepping swipe', () => {
    const onCardClick = vi.fn()
    render(
      <GroupStack
        entries={makeEntries(5)}
        visibleCount={1}
        slotHeightPx={SLOT}
        label="G"
        renderCard={(e) => (
          <button type="button" onClick={onCardClick}>
            {e.title}
          </button>
        )}
      />,
    )
    const list = screen.getByRole('list')
    const viewport = list.parentElement!
    const touch = { pointerType: 'touch', pointerId: 1, isPrimary: true }
    fireEvent.pointerDown(viewport, { ...touch, clientX: 0, clientY: 100 })
    fireEvent.pointerCancel(viewport, touch)
    fireEvent.pointerMove(viewport, { ...touch, clientX: 0, clientY: 0 })
    expect(screen.getByText('1 von 5')).toBeInTheDocument()

    const card = screen.getByRole('button', { name: 'Eintrag 1' })
    fireEvent.pointerDown(card, { ...touch, clientX: 0, clientY: 100 })
    fireEvent.pointerMove(card, { ...touch, clientX: 0, clientY: 40 })
    fireEvent.pointerUp(card, touch)
    fireEvent.click(card)
    expect(screen.getByText('2 von 5')).toBeInTheDocument()
    expect(onCardClick).not.toHaveBeenCalled()
    // The next plain tap clicks normally.
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag 2' }))
    expect(onCardClick).toHaveBeenCalledTimes(1)
  })

  it('animates the transform, except with reduced motion', () => {
    const { list } = setup()
    expect(list).toHaveClass('transition-transform', 'motion-reduce:transition-none')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = setup()
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})

describe('GroupMarker', () => {
  it('shows the count as an image with the label when not interactive', () => {
    render(<GroupMarker count={7} label="Gruppe mit 7 Einträgen, 1914–1922" />)
    const marker = screen.getByRole('img', { name: 'Gruppe mit 7 Einträgen, 1914–1922' })
    expect(marker).toHaveTextContent('7')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is a button calling onActivate when given', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    render(<GroupMarker count={4} label="Gruppe mit 4 Einträgen, 1917" onActivate={onActivate} highlighted />)
    const button = screen.getByRole('button', { name: 'Gruppe mit 4 Einträgen, 1917' })
    expect(button).toHaveTextContent('4')
    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <div>
        <GroupMarker count={7} label="Gruppe mit 7 Einträgen, 1914–1922" />
        <GroupMarker count={3} label="Gruppe mit 3 Einträgen, 1917" onActivate={() => {}} />
      </div>,
    )
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})
