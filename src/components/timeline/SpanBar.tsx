'use client'

import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import clsx from 'clsx'
import type {
    FocusEvent,
    JSX,
    MouseEvent,
    PointerEvent,
    RefObject,
} from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { EntryTooltipContent } from './EntryCard'
import { REGION_BG } from './regionStyles'
import { Tooltip } from './Tooltip'

/** How a bar stretched to the minimum width is drawn. */

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

/** Accessible name of a span bar. */
export function spanBarLabel(entry: Entry): string {
    const label = `${entry.title}, ${formatEntryDate(entry, 'short')}`
    return entry.post ? `${label}, Beitrag` : label
}

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
    const showLabel = bar.labelFits
    const width = bar.x1 - bar.x0

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
        REGION_BG[entry.region],
        'text-surface',
        highlighted && 'ring-2 ring-focus focus-visible:-outline-offset-4'
    )

    const content = (
        <>
            {showLabel && (
                <span
                    aria-hidden
                    data-part="label"
                    className="relative truncate px-1.5"
                >
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
        <button
            type="button"
            ref={ref as RefObject<HTMLButtonElement | null>}
            {...common}
        >
            {content}
        </button>
    ) : (
        <div
            role="group"
            tabIndex={0}
            ref={ref as RefObject<HTMLDivElement | null>}
            {...common}
        >
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
