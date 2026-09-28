'use client'

import type { Entry } from '@/lib/entry'
import { entryLabel } from '@/lib/format'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import clsx from 'clsx'
import type { JSX } from 'react'
import { useId, useRef } from 'react'
import { EntryTooltipContent } from './EntryCard'
import { laneBox } from './spanGeometry'
import { Tooltip } from './Tooltip'
import { useTooltipTrigger } from './useTooltipTrigger'

export type SpanBarProps = {
    entry: Entry
    bar: SpanBar
    /** Runs until today or later: the bar fades out over its last 40 %. */
    ongoing: boolean
}

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
                    'absolute',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    ongoing
                        ? 'bg-linear-to-r from-fg/35 from-60% to-fg/10 hover:from-fg/55 focus-visible:from-fg/55'
                        : 'bg-fg/35 hover:bg-fg/55 focus-visible:bg-fg/55'
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
