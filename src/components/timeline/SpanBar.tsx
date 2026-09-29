'use client'

import { useI18n } from '@/components/I18nContext'
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
    /** Click, Enter or Space on the bar. */
    onActivate?: (id: string) => void
}

/**
 * One time span drawn as a thin bar at [bar.x0, bar.x1]: lane 0 straddles the
 * axis line, further lanes hang below it. Hover or keyboard focus shows the
 * entry's hover note; a click, Enter or Space is handed to `onActivate`.
 */
export function SpanBarView({
    entry,
    bar,
    ongoing,
    onActivate,
}: SpanBarProps): JSX.Element {
    const tooltipId = useId()
    const { locale } = useI18n()
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
                aria-label={entryLabel(entry, locale)}
                aria-describedby={tooltipId}
                className={clsx(
                    'absolute',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    ongoing
                        ? 'bg-linear-to-r from-bar from-60% to-bar-faint hover:from-bar-strong focus-visible:from-bar-strong'
                        : 'bg-bar hover:bg-bar-strong focus-visible:bg-bar-strong'
                )}
                style={{
                    left: bar.x0,
                    width: bar.x1 - bar.x0,
                    ...laneBox(bar.lane),
                }}
                {...triggerProps}
                {...hoverProps}
                onClick={() => onActivate?.(entry.id)}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    onActivate?.(entry.id)
                }}
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
