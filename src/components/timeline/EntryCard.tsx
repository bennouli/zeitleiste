'use client'

import { CATEGORY_LABEL, type Entry } from '@/lib/entry'
import { entryLabel, formatEntryDate } from '@/lib/format'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { useId, useRef } from 'react'
import { Connector } from './Connector'
import { REGION_BORDER_L } from './regionStyles'
import { Tooltip } from './Tooltip'
import { useTooltipTrigger } from './useTooltipTrigger'

export const CARD_WIDTH_PX = 176
export const CARD_HEIGHT_PX = 56
export const CONNECTOR_MIN_PX = 12

export type EntryCardProps = {
    entry: Entry
    /** x of the entry's anchor within the layer, px. The card's left edge is at `x`. */
    x: number
    side: 'above' | 'below'
    /** Row index, 0 nearest the axis. */
    level: number
    /** Vertical pitch per level in px (provided by the timeline). */
    rowHeightPx: number
    highlighted?: boolean
    /** Called on click (not on drag) for entries with a post. */
    onOpen: (id: string) => void
    /** The timeline sets this when the pointer moved (a drag); if it returns true, the click is ignored. */
    wasDrag?: () => boolean
    /** Render without absolute positioning and without the connector (inside a group stack). */
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

    const shortDate = formatEntryDate(entry, 'short')
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
        'block cursor-pointer overflow-hidden rounded-md border border-l-3 border-border bg-surface-raised px-2 py-1.5 text-left text-fg shadow-sm',
        'transition-transform duration-150 motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-focus',
        // Inside a stack the card fills the clipping window, so an outer outline would be cut off.
        inline && 'focus-visible:-outline-offset-2',
        // The highlight ring sits where the outline would; keep the focus outline apart from it.
        highlighted &&
            (inline
                ? 'focus-visible:-outline-offset-4'
                : 'focus-visible:outline-offset-2'),
        REGION_BORDER_L[entry.region],
        highlighted && 'ring-2 ring-focus',
        highlighted &&
            (side === 'above' ? '-translate-y-0.5' : 'translate-y-0.5')
    )
    const cardStyle: CSSProperties = {
        width: CARD_WIDTH_PX,
        height: CARD_HEIGHT_PX,
    }

    const content = (
        <>
            <span className="block truncate font-serif text-sm font-medium leading-5">
                {entry.title}
            </span>
            <span className="flex items-center justify-between gap-2 text-xs leading-4 text-fg-muted">
                <span className="truncate">{shortDate}</span>
                {hasPost && (
                    <span
                        className="shrink-0 rounded-sm bg-accent px-1 font-medium text-accent-fg"
                        aria-hidden="true"
                    >
                        Beitrag ›
                    </span>
                )}
            </span>
        </>
    )

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
    const offset = level * rowHeightPx

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
            <Connector
                region={entry.region}
                side={side}
                heightPx={offset + CONNECTOR_MIN_PX}
                offsetPx={offset}
            />
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

function wrapperStyle(
    side: EntryCardProps['side'],
    level: number,
    rowHeightPx: number,
    x: number
): CSSProperties {
    const offset = level * rowHeightPx
    return side === 'above'
        ? { left: x, bottom: offset, paddingBottom: CONNECTOR_MIN_PX }
        : { left: x, top: offset, paddingTop: CONNECTOR_MIN_PX }
}

export const PRIVATE_UNDER_TESTS = { wrapperStyle }
