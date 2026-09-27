'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { FocusEvent, JSX, MouseEvent, PointerEvent, RefObject } from 'react'
import clsx from 'clsx'
import type { Entry, Region } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import { EntryTooltipContent } from './EntryCard'
import { Tooltip } from './Tooltip'

/** How a bar stretched to the minimum width is drawn. */
export type ShortSpanStyle = 'uniform' | 'faded'

export interface SpanBarProps {
  entry: Entry
  bar: SpanBar
  laneHeightPx: number
  shortSpanStyle: ShortSpanStyle
  highlighted?: boolean
  onOpen: (id: string) => void
  wasDrag?: () => boolean
}

/** Vertical gap between lanes, in px. */
const LANE_GAP_PX = 2

const SOLID: Record<Region, string> = {
  russia: 'bg-russia',
  west: 'bg-west',
  both: 'bg-both',
}

const FADE: Record<Region, string> = {
  russia: 'from-russia',
  west: 'from-west',
  both: 'from-both',
}

/** Accessible name of a span bar. */
export function spanBarLabel(entry: Entry): string {
  const label = `${entry.title}, ${formatEntryDate(entry, 'short')}`
  return entry.post ? `${label}, Beitrag` : label
}

/**
 * One time span drawn as a bar at [bar.x0, bar.x1] in lane `bar.lane`.
 * In 'faded' style a stretched bar is solid over its true extent
 * [trueX0, trueX1] and fades out over the extension on either side.
 * Hovering or keyboard focus shows the entry's summary in a tooltip.
 */
export function SpanBarView({
  entry,
  bar,
  laneHeightPx,
  shortSpanStyle,
  highlighted = false,
  onOpen,
  wasDrag,
}: SpanBarProps): JSX.Element {
  const label = spanBarLabel(entry)
  const tooltipId = useId()
  const ref = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const open = (hovered || focused) && !dismissed

  // While open, Escape dismisses the tooltip (and is used up, so it doesn't also close a post).
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      setDismissed(true)
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const faded = shortSpanStyle === 'faded' && bar.extended
  // A stretched faded bar has no room for a legible label on its solid part.
  const showLabel = bar.labelFits && !faded
  const width = bar.x1 - bar.x0
  // Offsets within the bar: [0, solidLeft] fades in, [solidLeft, solidRight] is the true span, the rest fades out.
  const solidLeft = Math.max(0, bar.trueX0 - bar.x0)
  const solidRight = Math.min(width, Math.max(solidLeft, bar.trueX1 - bar.x0))

  const style = {
    left: bar.x0,
    width,
    top: bar.lane * laneHeightPx,
    height: Math.max(0, laneHeightPx - LANE_GAP_PX),
  }

  const className = clsx(
    'absolute flex cursor-pointer items-center overflow-hidden rounded-sm text-left text-xs',
    // Inset: the lowest lane touches the timeline's clipping edge.
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
    !faded && SOLID[entry.region],
    'text-surface',
    highlighted && 'ring-2 ring-focus focus-visible:-outline-offset-4',
  )

  const content = (
    <>
      {faded && (
        <>
          {solidLeft > 0 && (
            <span
              aria-hidden
              data-part="fade"
              data-side="start"
              className={clsx('absolute inset-y-0 left-0 bg-linear-to-l to-transparent', FADE[entry.region])}
              style={{ width: solidLeft }}
            />
          )}
          <span
            aria-hidden
            data-part="solid"
            className={clsx('absolute inset-y-0', SOLID[entry.region])}
            style={{ left: solidLeft, width: solidRight - solidLeft }}
          />
          {solidRight < width && (
            <span
              aria-hidden
              data-part="fade"
              data-side="end"
              className={clsx('absolute inset-y-0 bg-linear-to-r to-transparent', FADE[entry.region])}
              style={{ left: solidRight, width: width - solidRight }}
            />
          )}
        </>
      )}
      {showLabel && (
        <span aria-hidden data-part="label" className="relative truncate px-1.5">
          {entry.title}
        </span>
      )}
    </>
  )

  const handleClick = (event: MouseEvent) => {
    // detail 0: keyboard activation, never a drag.
    if (event.detail !== 0 && wasDrag?.()) return
    if (entry.post) {
      setDismissed(true)
      onOpen(entry.id)
    }
  }

  const common = {
    'data-span-id': entry.id,
    'data-t': startOf(entry.start),
    className,
    style,
    'aria-label': label,
    'aria-describedby': tooltipId,
    onClick: handleClick,
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      setHovered(true)
      setDismissed(false)
    },
    onPointerLeave: () => setHovered(false),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      // A mouse press focuses too; only keyboard focus (focus-visible) opens the tooltip.
      if (!isFocusVisible(e.currentTarget)) return
      setFocused(true)
      setDismissed(false)
    },
    onBlur: () => setFocused(false),
  }

  const element = entry.post ? (
    <button type="button" ref={ref as RefObject<HTMLButtonElement | null>} {...common}>
      {content}
    </button>
  ) : (
    <div role="group" tabIndex={0} ref={ref as RefObject<HTMLDivElement | null>} {...common}>
      {content}
    </div>
  )

  return (
    <>
      {element}
      <Tooltip id={tooltipId} open={open} placement="top" anchorRef={ref}>
        <EntryTooltipContent entry={entry} />
      </Tooltip>
    </>
  )
}

function isFocusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    return true
  }
}
