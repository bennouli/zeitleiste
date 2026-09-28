'use client'

import type { Entry } from '@/lib/entry'
import { entryLabel } from '@/lib/format'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import clsx from 'clsx'
import type { JSX } from 'react'
import { useId, useRef } from 'react'
import { EntryTooltipContent } from './EntryCard'
import { Tooltip } from './Tooltip'
import { useTooltipTrigger } from './useTooltipTrigger'

export type SpanBarProps = {
    entry: Entry
    bar: SpanBar
    /** Runs until today or later: the bar fades out over its last 40 %. */
    ongoing: boolean
}

/** The axis line's thickness; lane 0 is centred on it. */
const AXIS_LINE_THICKNESS_PX = 1
const AXIS_LANE_HEIGHT_PX = 7
const LOWER_LANE_HEIGHT_PX = 3
const FIRST_LOWER_LANE_TOP_PX = 8
const LOWER_LANE_PITCH_PX = 6

/**
 * One time span drawn as a thin bar at [bar.x0, bar.x1]: lane 0 straddles the
 * axis line, further lanes hang below it. Hover or keyboard focus shows the
 * entry's hover note.
 */
export function SpanBarView({
    entry,
    bar,
    ongoing,
}: SpanBarProps): JSX.Element {
    const tooltipId = useId()
    const anchorRef = useRef<HTMLDivElement>(null)
    const { open, triggerProps, hoverProps } = useTooltipTrigger({
        tooltipId,
        anchorRef,
    })

    return (
        <>
            <div
                role="group"
                tabIndex={0}
                ref={anchorRef}
                data-span-id={entry.id}
                data-t={startOf(entry.start)}
                aria-label={entryLabel(entry)}
                aria-describedby={tooltipId}
                className={clsx(
                    'absolute hover:brightness-70',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    ongoing
                        ? 'bg-linear-to-r from-fg/12 from-60% to-fg/2'
                        : 'bg-fg/12'
                )}
                style={{
                    left: bar.x0,
                    width: bar.x1 - bar.x0,
                    ...laneBox(bar.lane),
                }}
                {...triggerProps}
                {...hoverProps}
            />
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

/** Top edge (relative to the axis line's top edge) and height of a lane. */
function laneBox(lane: number): { top: number; height: number } {
    if (lane === 0)
        return {
            top: (AXIS_LINE_THICKNESS_PX - AXIS_LANE_HEIGHT_PX) / 2,
            height: AXIS_LANE_HEIGHT_PX,
        }
    return {
        top: FIRST_LOWER_LANE_TOP_PX + (lane - 1) * LOWER_LANE_PITCH_PX,
        height: LOWER_LANE_HEIGHT_PX,
    }
}
