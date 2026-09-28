'use client'

import clsx from 'clsx'

export type GroupMarkerProps = {
    count: number
    /** Accessible label, e.g. "Gruppe mit 7 Einträgen, 1914–1922" (caller builds the date part). */
    label: string
    /** Visual only; put anything screen readers need into `label`. */
    highlighted?: boolean
    /** Optional click → the timeline zooms into the group. */
    onActivate?: () => void
}

/** Diameter of the marker badge in px, for centering it on the axis. */
export const GROUP_MARKER_SIZE_PX = 32

/** The marker on the axis for a collapsed group: a round badge showing the entry count. */
export function GroupMarker({
    count,
    label,
    highlighted = false,
    onActivate,
}: GroupMarkerProps) {
    const className = clsx(
        'inline-flex items-center justify-center rounded-full bg-accent px-1 text-sm font-semibold tabular-nums text-accent-fg',
        highlighted && 'outline-2 outline-offset-2 outline-accent'
    )
    const style = {
        minWidth: GROUP_MARKER_SIZE_PX,
        height: GROUP_MARKER_SIZE_PX,
    }
    const content = <span aria-hidden="true">{count}</span>

    if (onActivate) {
        return (
            <button
                type="button"
                aria-label={label}
                onClick={onActivate}
                className={clsx(
                    className,
                    'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
                )}
                style={style}
            >
                {content}
            </button>
        )
    }
    return (
        <span role="img" aria-label={label} className={className} style={style}>
            {content}
        </span>
    )
}
