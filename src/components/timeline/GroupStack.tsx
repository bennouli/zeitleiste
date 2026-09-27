'use client'

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import type { Entry } from '@/lib/entry'

export interface GroupStackProps {
  /** Chronological (the caller sorts; not checked here). */
  entries: Entry[]
  /** Number of cards visible at once: 3 desktop, 1 phone, ≤ 2 when collapsed. */
  visibleCount: number
  /** Height of one card slot in px, from the card component (the caller passes EntryCard's CARD_HEIGHT_PX + gap). */
  slotHeightPx: number
  /** Renders one card (the caller passes EntryCard with `inline`). */
  renderCard: (entry: Entry, index: number) => ReactNode
  /**
   * Scrolled-to index (e.g. to show the highlighted entry); default 0. A later
   * change scrolls to the new index; a change to `undefined` keeps the window.
   */
  initialIndex?: number
  /** Accessible name of the group, e.g. "Gruppe: 1914–1922". */
  label: string
  /** Called when the visible window changes (top index). */
  onIndexChange?: (topIndex: number) => void
  className?: string
}

/** Height of the controls row below the cards (incl. its top margin), when present. */
export const GROUP_STACK_CONTROLS_HEIGHT_PX = 36
/** Minimum vertical travel of a touch swipe that steps the stack. */
export const SWIPE_THRESHOLD_PX = 30

const CONTROLS_GAP_PX = 4

/** Total rendered height of a GroupStack, for positioning it like a card. */
export function groupStackHeightPx(entryCount: number, visibleCount: number, slotHeightPx: number): number {
  if (entryCount <= 0) return 0
  const visible = normalizeVisible(visibleCount)
  const controls = entryCount > visible ? GROUP_STACK_CONTROLS_HEIGHT_PX : 0
  return Math.min(visible, entryCount) * slotHeightPx + controls
}

function normalizeVisible(visibleCount: number): number {
  return Math.max(1, Math.floor(visibleCount))
}

function clamp(i: number, max: number): number {
  return Math.min(Math.max(0, Math.round(i)), max)
}

interface Swipe {
  pointerId: number
  x: number
  y: number
  stepped: boolean
}

/**
 * A group's entries as a vertical stack of cards, stepped one entry at a time
 * with the arrow buttons, ArrowUp/ArrowDown/Home/End while the group has
 * focus, or a vertical touch swipe. The mouse wheel is deliberately not
 * handled, so the page scrolls over the stack.
 *
 * Trade-off: the viewport sets `touch-action: pan-x` so vertical touch moves
 * reach the swipe handler; a vertical swipe over a stack therefore steps the
 * stack instead of scrolling the page. Horizontal swipes still pan.
 *
 * The window position is kept across `entries` changes (only clamped); key
 * the stack by group so a different group starts fresh. Renders nothing for
 * an empty group.
 */
export function GroupStack({
  entries,
  visibleCount,
  slotHeightPx,
  renderCard,
  initialIndex,
  label,
  onIndexChange,
  className,
}: GroupStackProps) {
  const visible = normalizeVisible(visibleCount)
  const maxIndex = Math.max(0, entries.length - visible)
  const [rawIndex, setRawIndex] = useState(() => clamp(initialIndex ?? 0, maxIndex))
  // Follow a changed initialIndex (e.g. another entry got highlighted).
  const [prevInitial, setPrevInitial] = useState(initialIndex)
  if (prevInitial !== initialIndex) {
    setPrevInitial(initialIndex)
    if (initialIndex !== undefined) setRawIndex(clamp(initialIndex, maxIndex))
  }
  const topIndex = clamp(rawIndex, maxIndex)
  const swipe = useRef<Swipe | null>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  // Set after a swipe that stepped, to swallow the click it may end with.
  const suppressClick = useRef(false)

  // Report every change of the visible window (user steps, initialIndex
  // changes, re-clamping), but not the initial position.
  const onIndexChangeRef = useRef(onIndexChange)
  const reported = useRef(topIndex)
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange
  })
  useEffect(() => {
    if (reported.current === topIndex) return
    reported.current = topIndex
    onIndexChangeRef.current?.(topIndex)
  }, [topIndex])

  const go = (next: number) => {
    const target = clamp(next, maxIndex)
    if (target === topIndex) return
    setRawIndex(target)
    // Focus inside a card that leaves the window would fall to <body> (the
    // slot becomes inert); keep it on the group.
    const group = groupRef.current
    const active = document.activeElement
    if (group && active && active !== group && group.contains(active)) {
      const slot = active.closest('li')
      const i = slot ? Number(slot.dataset.index) : NaN
      if (!Number.isNaN(i) && (i < target || i >= target + visible)) group.focus()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as HTMLElement
    if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
    let next: number
    switch (e.key) {
      case 'ArrowUp':
        next = topIndex - 1
        break
      case 'ArrowDown':
        next = topIndex + 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = maxIndex
        break
      default:
        return
    }
    if (maxIndex === 0) return
    e.preventDefault()
    go(next)
  }

  // No capture and no stopPropagation here: a tap must still click the card
  // under the finger, and horizontal moves must reach the timeline's drag.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false
    if (e.pointerType !== 'touch' || !e.isPrimary) return
    swipe.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, stepped: false }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    if (!s || s.stepped || e.pointerId !== s.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dy) < SWIPE_THRESHOLD_PX || Math.abs(dy) <= Math.abs(dx)) return
    s.stepped = true
    suppressClick.current = true
    // Only now capture on the viewport: the touched card's slot is about to turn inert.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // Pointer already released; the step still applies.
    }
    // Swipe up → content moves up → later entries.
    go(topIndex + (dy < 0 ? 1 : -1))
  }
  const endSwipe = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    if (s?.pointerId !== e.pointerId) return
    swipe.current = null
    // A moved touch usually ends without a click; don't let the flag eat a later one.
    if (s.stepped) setTimeout(() => (suppressClick.current = false), 0)
  }
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    // detail 0: a keyboard activation, never the tail of a swipe.
    if (!suppressClick.current || e.detail === 0) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  // A button that becomes disabled would drop focus to <body>; keep it on the group.
  const stepFromButton = (delta: number) => {
    const target = clamp(topIndex + delta, maxIndex)
    go(target)
    if (target === 0 || target === maxIndex) groupRef.current?.focus()
  }

  if (entries.length === 0) return null

  const hasControls = entries.length > visible
  const buttonClass =
    'inline-flex size-8 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface-raised text-fg ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
    'disabled:cursor-default disabled:opacity-40'

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={clsx(
        'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
    >
      <div
        className="overflow-hidden"
        style={{ height: Math.min(visible, entries.length) * slotHeightPx, touchAction: 'pan-x' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
        onLostPointerCapture={endSwipe}
        onClickCapture={onClickCapture}
      >
        <ul
          role="list"
          className="m-0 list-none p-0 transition-transform duration-250 ease-out motion-reduce:transition-none"
          style={{ transform: `translateY(${-topIndex * slotHeightPx}px)` }}
        >
          {entries.map((entry, i) => {
            const shown = i >= topIndex && i < topIndex + visible
            return (
              <li
                key={entry.id}
                role="listitem"
                data-index={i}
                style={{ height: slotHeightPx }}
                aria-hidden={shown ? undefined : true}
                inert={!shown}
              >
                {renderCard(entry, i)}
              </li>
            )
          })}
        </ul>
      </div>
      {hasControls && (
        <div
          className="flex items-center justify-between gap-2"
          style={{ height: GROUP_STACK_CONTROLS_HEIGHT_PX - CONTROLS_GAP_PX, marginTop: CONTROLS_GAP_PX }}
        >
          <button
            type="button"
            aria-label="Einen Eintrag nach oben"
            disabled={topIndex === 0}
            onClick={() => stepFromButton(-1)}
            className={buttonClass}
          >
            <Chevron up />
          </button>
          <span aria-live="polite" className="text-sm tabular-nums text-fg-muted">
            {topIndex + 1} von {entries.length}
          </span>
          <button
            type="button"
            aria-label="Einen Eintrag nach unten"
            disabled={topIndex === maxIndex}
            onClick={() => stepFromButton(1)}
            className={buttonClass}
          >
            <Chevron />
          </button>
        </div>
      )}
    </div>
  )
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={up ? 'rotate-180' : undefined}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}
