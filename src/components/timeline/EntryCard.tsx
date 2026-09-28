'use client'

import { CATEGORY_LABEL, type Entry } from '@/lib/entry'
import { entryLabel, formatEntryDate } from '@/lib/format'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { useId, useRef } from 'react'
import { AxisDot, Connector } from './Connector'
import { CARD_FIRST_ROW_OFFSET_PX } from './constants'
import { EntryLabel } from './EntryLabel'
import { LABEL_HEIGHT_PX, LABEL_MAX_WIDTH_PX } from './labelMetrics'
import { Tooltip } from './Tooltip'
import { useTooltipTrigger } from './useTooltipTrigger'

export type EntryCardProps = {
    entry: Entry
    /** x of the entry's anchor within the layer, px. The label's left edge is at `x`. */
    x: number
    side: 'above' | 'below'
    /** Row index, 0 nearest the axis. */
    level: number
    /** Vertical pitch per level in px (provided by the timeline). */
    rowHeightPx: number
    /** The entry whose post is open. */
    highlighted?: boolean
    /** Called on click (not on drag) for entries with a post. */
    onOpen: (id: string) => void
    /** The timeline sets this when the pointer moved (a drag); if it returns true, the click is ignored. */
    wasDrag?: () => boolean
    /** Render without absolute positioning, connector and dot (inside a group stack). */
    inline?: boolean
}

export function EntryCard({
    entry,
    x,
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
    const hasPost = entry.post !== undefined
    const { open, triggerProps, hoverProps, dismiss, toggleTouch } =
        useTooltipTrigger({
            tooltipId,
            anchorRef: bodyRef,
            touchToggle: !hasPost,
        })

    const label = entryLabel(entry)

    const cardProps = {
        ...triggerProps,
        onClick: () => {
            if (wasDrag?.()) return
            if (hasPost) {
                // Otherwise the next Escape would only close this tooltip, not the post.
                dismiss()
                onOpen(entry.id)
            } else toggleTouch()
        },
    }

    const cardClass = clsx(
        'block w-max cursor-pointer text-left',
        'focus-visible:outline-2 focus-visible:outline-focus',
        // Inside a stack the card fills the clipping window, so an outer outline would be cut off.
        inline && 'focus-visible:-outline-offset-2'
    )
    const cardStyle: CSSProperties = {
        maxWidth: LABEL_MAX_WIDTH_PX,
        height: LABEL_HEIGHT_PX,
    }

    const content = <EntryLabel entry={entry} side={side} open={highlighted} />

    const card = hasPost ? (
        <button
            type="button"
            aria-label={label}
            aria-describedby={tooltipId}
            className={cardClass}
            style={cardStyle}
            {...cardProps}
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
            {...cardProps}
        >
            {content}
        </div>
    )

    const body = (
        <div ref={bodyRef} className="relative" {...hoverProps}>
            {card}
            <Tooltip
                id={tooltipId}
                open={open}
                placement={side === 'above' ? 'bottom' : 'top'}
                anchorRef={bodyRef}
            >
                <EntryTooltipContent entry={entry} />
            </Tooltip>
        </div>
    )

    if (inline) {
        return (
            <div
                className={clsx(
                    'relative',
                    open ? 'z-30' : highlighted && 'z-20'
                )}
                data-entry-id={entry.id}
                data-highlighted={highlighted ? 'true' : undefined}
            >
                {body}
            </div>
        )
    }

    const style = wrapperStyle(side, level, rowHeightPx, x)
    const offset = rowOffsetPx(level, rowHeightPx)

    return (
        <div
            className={clsx(
                'absolute',
                open ? 'z-30' : highlighted ? 'z-20' : 'z-0'
            )}
            style={style}
            data-entry-id={entry.id}
            data-highlighted={highlighted ? 'true' : undefined}
        >
            <Connector side={side} lengthPx={offset} open={highlighted} />
            <AxisDot side={side} lengthPx={offset} open={highlighted} />
            {body}
        </div>
    )
}

/** Tooltip body of an entry; the title is hidden from screen readers because the anchor's label names it. */
export function EntryTooltipContent({ entry }: { entry: Entry }) {
    return (
        <>
            <p className="font-medium" aria-hidden="true">
                {entry.title}
            </p>
            <p className="text-xs text-fg-muted">
                {formatEntryDate(entry, 'long')} ·{' '}
                {CATEGORY_LABEL[entry.category]}
            </p>
            <p className="mt-2">{entry.summary}</p>
        </>
    )
}

/** Distance of a row's axis-side edge from the axis line. */
function rowOffsetPx(level: number, rowHeightPx: number): number {
    return CARD_FIRST_ROW_OFFSET_PX + level * rowHeightPx
}

function wrapperStyle(
    side: EntryCardProps['side'],
    level: number,
    rowHeightPx: number,
    x: number
): CSSProperties {
    const offset = rowOffsetPx(level, rowHeightPx)
    return side === 'above'
        ? { left: x, bottom: offset }
        : { left: x, top: offset }
}

export const PRIVATE_UNDER_TESTS = { wrapperStyle }
