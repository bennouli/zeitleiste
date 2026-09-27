'use client'

import type { JSX, MouseEvent } from 'react'
import clsx from 'clsx'
import type { Entry, Region } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import type { SpanBar } from '@/lib/spans'

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

/** Accessible name and native tooltip text of a span bar. */
export function spanBarLabel(entry: Entry): string {
  const label = `${entry.title}, ${formatEntryDate(entry, 'short')}`
  return entry.post ? `${label}, Beitrag` : label
}

/**
 * One time span drawn as a bar at [bar.x0, bar.x1] in lane `bar.lane`.
 * In 'faded' style a stretched bar is solid over its true extent
 * [trueX0, trueX1] and fades out over the extension on either side.
 * Tooltip is the native `title` attribute for now.
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
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    !faded && SOLID[entry.region],
    'text-surface',
    highlighted && 'ring-2 ring-focus',
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
    if (entry.post) onOpen(entry.id)
  }

  if (entry.post) {
    return (
      <button
        type="button"
        data-span-id={entry.id}
        className={className}
        style={style}
        title={label}
        aria-label={label}
        onClick={handleClick}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      role="group"
      tabIndex={0}
      data-span-id={entry.id}
      className={className}
      style={style}
      title={label}
      aria-label={label}
      onClick={handleClick}
    >
      {content}
    </div>
  )
}
