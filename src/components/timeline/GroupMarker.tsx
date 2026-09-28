'use client'

import type { Entry } from '@/lib/entry'
import { formatGroupMeta } from '@/lib/format'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { useId, useRef } from 'react'
import { Tooltip, TooltipBody, TooltipMeta, TooltipTitle } from './Tooltip'
import { useTooltipTrigger } from './useTooltipTrigger'

export type GroupMarkerProps = {
    /** The group's members, chronological. */
    entries: Entry[]
    /** Accessible label, e.g. "Hineinzoomen: Gruppe mit 7 Einträgen, 1914–1922". */
    label: string
    /** The side of the axis the group's stack is on; the hover note opens on the other. */
    side: Side
    /** Visual only; put anything screen readers need into `label`. */
    highlighted?: boolean
    /** Click → the timeline zooms into the group. */
    onActivate: () => void
}

/** Diameter of the marker's counter circle in px, for centering it on the axis. */
export const GROUP_MARKER_SIZE_PX = 22

/** The marker on the axis for a group: a counter circle showing the entry count, with a hover note naming the members. */
export function GroupMarker({
    entries,
    label,
    side,
    highlighted = false,
    onActivate,
}: GroupMarkerProps) {
    const tooltipId = useId()
    const anchorRef = useRef<HTMLDivElement>(null)
    const { open, triggerProps, hoverProps, dismiss } = useTooltipTrigger({
        tooltipId,
        anchorRef,
    })

    return (
        <div ref={anchorRef} className="relative" {...hoverProps}>
            <button
                type="button"
                aria-label={label}
                aria-describedby={tooltipId}
                {...triggerProps}
                onClick={() => {
                    // Otherwise the next Escape would only close this note.
                    dismiss()
                    onActivate()
                }}
                className={clsx(
                    'flex cursor-zoom-in items-center justify-center rounded-full border border-fg bg-surface text-label font-medium tabular-nums text-fg',
                    'hover:bg-accent hover:text-accent-fg focus-visible:bg-accent focus-visible:text-accent-fg',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    highlighted && 'outline-2 outline-offset-2 outline-accent'
                )}
                style={{
                    width: GROUP_MARKER_SIZE_PX,
                    height: GROUP_MARKER_SIZE_PX,
                }}
            >
                <span aria-hidden="true">{entries.length}</span>
            </button>
            <Tooltip
                id={tooltipId}
                open={open}
                placement={side === 'above' ? 'bottom' : 'top'}
                anchorRef={anchorRef}
            >
                <GroupTooltipContent entries={entries} />
            </Tooltip>
        </div>
    )
}

/** Hover note of a group: count and years, the zoom hint, the member titles. */
function GroupTooltipContent({ entries }: { entries: Entry[] }) {
    return (
        <>
            <TooltipMeta>{formatGroupMeta(entries)}</TooltipMeta>
            <TooltipTitle aria-hidden="true">
                Gruppe · Klicken zum Hineinzoomen
            </TooltipTitle>
            {entries.map((entry) => (
                <TooltipBody key={entry.id}>{entry.title}</TooltipBody>
            ))}
        </>
    )
}
