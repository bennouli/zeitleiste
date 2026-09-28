'use client'

import type { Entry } from '@/lib/entry'
import { entryLabel } from '@/lib/format'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import clsx from 'clsx'
import type { JSX, MouseEvent } from 'react'
import { useId, useRef } from 'react'
import { EntryTooltipContent } from './EntryCard'
import { REGION_BG } from './regionStyles'
import { Tooltip } from './Tooltip'
import { useTooltipTrigger } from './useTooltipTrigger'

export type SpanBarProps = {
    entry: Entry
    bar: SpanBar
    laneHeightPx: number
    highlighted?: boolean
    onOpen: (id: string) => void
    wasDrag?: () => boolean
}

/** Vertical gap between lanes, in px. */
const LANE_GAP_PX = 2

/**
 * One time span drawn as a bar at [bar.x0, bar.x1] in lane `bar.lane`
 * (a short span is stretched to the minimum width as one uniform bar).
 * Hovering or keyboard focus shows the entry's summary in a tooltip.
 */
export function SpanBarView({
    entry,
    bar,
    laneHeightPx,
    highlighted = false,
    onOpen,
    wasDrag,
}: SpanBarProps): JSX.Element {
    const tooltipId = useId()
    const buttonRef = useRef<HTMLButtonElement>(null)
    const groupRef = useRef<HTMLDivElement>(null)
    const anchorRef = entry.post ? buttonRef : groupRef
    const { open, triggerProps, hoverProps, dismiss } = useTooltipTrigger({
        tooltipId,
        anchorRef,
    })

    const style = {
        left: bar.x0,
        width: bar.x1 - bar.x0,
        top: bar.lane * laneHeightPx,
        height: Math.max(0, laneHeightPx - LANE_GAP_PX),
    }

    const className = clsx(
        'absolute flex cursor-pointer items-center overflow-hidden rounded-sm text-left text-xs',
        // Inset: the lowest lane touches the timeline's clipping edge.
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        REGION_BG[entry.region],
        'text-surface',
        highlighted && 'ring-2 ring-focus focus-visible:-outline-offset-4'
    )

    const content = bar.labelFits && (
        <span
            aria-hidden
            data-part="label"
            className="relative truncate px-1.5"
        >
            {entry.title}
        </span>
    )

    const handleClick = (event: MouseEvent) => {
        // detail 0: keyboard activation, never a drag.
        if (event.detail !== 0 && wasDrag?.()) return
        if (entry.post) {
            dismiss()
            onOpen(entry.id)
        }
    }

    const barProps = {
        'data-span-id': entry.id,
        'data-t': startOf(entry.start),
        className,
        style,
        'aria-label': entryLabel(entry),
        'aria-describedby': tooltipId,
        ...triggerProps,
        ...hoverProps,
        onClick: handleClick,
    }

    return (
        <>
            {entry.post ? (
                <button type="button" ref={buttonRef} {...barProps}>
                    {content}
                </button>
            ) : (
                <div role="group" tabIndex={0} ref={groupRef} {...barProps}>
                    {content}
                </div>
            )}
            <Tooltip
                id={tooltipId}
                open={open}
                placement="top"
                anchorRef={anchorRef}
            >
                <EntryTooltipContent entry={entry} />
            </Tooltip>
        </>
    )
}
