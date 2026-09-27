'use client'

import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, PointerEvent } from 'react'
import { CATEGORY_LABEL, type Entry, type Region } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import { Tooltip } from './Tooltip'

export const CARD_WIDTH_PX = 176
export const CARD_HEIGHT_PX = 56
export const CONNECTOR_MIN_PX = 12

const PRESS_FOCUS_WINDOW_MS = 1000

export interface EntryCardProps {
  entry: Entry
  /** x of the entry's anchor within the layer, px. The card's left edge is at `x` (or its right edge with `alignEnd`). */
  x: number
  alignEnd?: boolean
  side: 'above' | 'below'
  /** Row index, 0 nearest the axis. */
  level: number
  /** Vertical pitch per level in px (provided by the timeline). */
  rowHeightPx: number
  highlighted?: boolean
  /** Called on click (not on drag) for entries with a post. */
  onOpen: (id: string) => void
  /** The timeline sets this when the pointer moved (a drag); if it returns true, the click is ignored. */
  wasDrag?: () => boolean
  /** Render without absolute positioning and without the connector (inside a group stack). */
  inline?: boolean
}

const CARD_BORDER: Record<Region, string> = {
  russia: 'border-l-russia',
  west: 'border-l-west',
  both: 'border-l-both',
}

const CONNECTOR_BG: Record<Region, string> = {
  russia: 'bg-russia',
  west: 'bg-west',
  both: 'bg-both',
}

export function EntryCard({
  entry,
  x,
  alignEnd = false,
  side,
  level,
  rowHeightPx,
  highlighted = false,
  onOpen,
  wasDrag,
  inline = false,
}: EntryCardProps) {
  const tooltipId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touchOpen, setTouchOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const open = (hovered || focused || touchOpen) && !dismissed
  // Pointer type of the last pointerdown, cleared by the click it belongs to.
  const pointerTypeRef = useRef<string | null>(null)
  // Time of the last pointerdown: a focus shortly after it was caused by the press, not the keyboard.
  const pressedAtRef = useRef<number | null>(null)

  // While open: Escape dismisses even without focus; a touch tap elsewhere closes a tapped-open tooltip.
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      setDismissed(true)
      // This Escape is used up; the shell's window listener must not also close the post.
      e.preventDefault()
    }
    const onDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node
      // The open bubble lives in a portal, outside the body's DOM.
      if (bodyRef.current?.contains(target) || document.getElementById(tooltipId)?.contains(target)) return
      setTouchOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, tooltipId])

  const hasPost = entry.post !== undefined
  const shortDate = formatEntryDate(entry, 'short')
  const label = hasPost ? `${entry.title}, ${shortDate}, Beitrag` : `${entry.title}, ${shortDate}`

  // On the body (card + bubble; React events bubble out of the bubble's portal) so the pointer can move onto the bubble.
  const hoverHandlers = {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      setHovered(true)
      setDismissed(false)
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType !== 'touch') setHovered(false)
    },
  }

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      pointerTypeRef.current = e.pointerType
      pressedAtRef.current = e.timeStamp
    },
    onPointerCancel: () => {
      pointerTypeRef.current = null
      pressedAtRef.current = null
    },
    onFocus: (e: FocusEvent) => {
      const pressedAt = pressedAtRef.current
      pressedAtRef.current = null
      if (pressedAt !== null && e.timeStamp - pressedAt < PRESS_FOCUS_WINDOW_MS) return
      setFocused(true)
      setDismissed(false)
    },
    onBlur: () => {
      setFocused(false)
      setTouchOpen(false)
    },
    onClick: () => {
      const pointerType = pointerTypeRef.current
      pointerTypeRef.current = null
      pressedAtRef.current = null
      if (wasDrag?.()) return
      if (hasPost) {
        // Otherwise the next Escape would only close this tooltip, not the post.
        setDismissed(true)
        onOpen(entry.id)
      } else if (pointerType === 'touch') {
        setDismissed(false)
        setTouchOpen(!open)
      }
    },
  }

  const cardClass = clsx(
    'block cursor-pointer overflow-hidden rounded-md border border-l-3 border-border bg-surface-raised px-2 py-1.5 text-left text-fg shadow-sm',
    'transition-transform duration-150 motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-focus',
    CARD_BORDER[entry.region],
    highlighted && 'ring-2 ring-focus',
    highlighted && (side === 'above' ? '-translate-y-0.5' : 'translate-y-0.5'),
  )
  const cardStyle: CSSProperties = { width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX }

  const content = (
    <>
      <span className="block truncate text-sm font-medium leading-5">{entry.title}</span>
      <span className="flex items-center justify-between gap-2 text-xs leading-4 text-fg-muted">
        <span className="truncate">{shortDate}</span>
        {hasPost && (
          <span className="shrink-0 rounded-sm bg-accent px-1 font-medium text-accent-fg" aria-hidden="true">
            Beitrag ›
          </span>
        )}
      </span>
    </>
  )

  const card = hasPost ? (
    <button
      type="button"
      aria-label={label}
      aria-describedby={tooltipId}
      className={cardClass}
      style={cardStyle}
      {...handlers}
    >
      {content}
    </button>
  ) : (
    <div
      role="note"
      tabIndex={0}
      aria-label={label}
      aria-describedby={tooltipId}
      className={cardClass}
      style={cardStyle}
      {...handlers}
    >
      {content}
    </div>
  )

  const body = (
    <div ref={bodyRef} className="relative" {...hoverHandlers}>
      {card}
      <Tooltip
        id={tooltipId}
        open={open}
        placement={side === 'above' ? 'bottom' : 'top'}
        align={alignEnd ? 'end' : 'start'}
        anchorRef={bodyRef}
      >
        {/* The card's label already names the title. */}
        <p className="font-medium" aria-hidden="true">
          {entry.title}
        </p>
        <p className="text-xs text-fg-muted">
          {formatEntryDate(entry, 'long')} · {CATEGORY_LABEL[entry.category]}
        </p>
        <p className="mt-2">{entry.summary}</p>
      </Tooltip>
    </div>
  )

  if (inline) {
    return (
      <div
        className={clsx('relative', open ? 'z-30' : highlighted && 'z-20')}
        data-entry-id={entry.id}
        data-highlighted={highlighted ? 'true' : undefined}
      >
        {body}
      </div>
    )
  }

  const offset = level * rowHeightPx
  const wrapperStyle: CSSProperties =
    side === 'above'
      ? { left: x, bottom: offset, paddingBottom: CONNECTOR_MIN_PX }
      : { left: x, top: offset, paddingTop: CONNECTOR_MIN_PX }
  const connectorStyle: CSSProperties = {
    height: offset + CONNECTOR_MIN_PX,
    ...(side === 'above' ? { bottom: -offset } : { top: -offset }),
  }

  return (
    <div
      className={clsx('absolute', alignEnd && '-translate-x-full', open ? 'z-30' : highlighted ? 'z-20' : 'z-0')}
      style={wrapperStyle}
      data-entry-id={entry.id}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <div
        aria-hidden="true"
        className={clsx('absolute w-0.5', alignEnd ? 'right-0' : 'left-0', CONNECTOR_BG[entry.region])}
        style={connectorStyle}
      />
      {body}
    </div>
  )
}
