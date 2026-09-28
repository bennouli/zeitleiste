'use client'

import type { Entry, Region } from '@/lib/entry'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { AXIS_LINE_Y_PX } from './Axis'
import { AXIS_HEIGHT_PX } from './constants'
import { CARD_WIDTH_PX, CONNECTOR_MIN_PX, EntryCard } from './EntryCard'
import { GroupMarker } from './GroupMarker'
import { GroupStack } from './GroupStack'
import { useTimeline } from './TimelineContext'
import type { LayoutItem } from './useEntryLayout'

const REGION_BG: Record<Region, string> = {
    russia: 'bg-russia',
    west: 'bg-west',
    both: 'bg-both',
}

/** Paint order: lower rows over higher rows (whose connectors pass behind them), markers over the axis. */
const Z_BASE = 100
const Z_MARKER = 150
const Z_HIGHLIGHTED = 200

export interface CardLayerProps {
    items: LayoutItem[]
    rowHeightPx: number
    /** Cards visible at once in a group stack. */
    visibleCount: number
    slotHeightPx: number
    focusEntryId: string | null
    onOpen: (id: string) => void
    /** Activating a group's axis marker. */
    onZoomIntoGroup: (entries: Entry[]) => void
}

export function groupLabel(entries: Entry[]): string {
    const first = entries[0]
    const last = entries[entries.length - 1]
    if (!first || !last) return 'Gruppe'
    const from = String(first.start.year)
    const to = String(last.start.year)
    return `Gruppe mit ${entries.length} Einträgen, ${from === to ? from : `${from}–${to}`}`
}

/** Name of a group's axis marker; differs from the stack's name so the two tab stops are distinguishable. */
export function markerLabel(entries: Entry[]): string {
    return `Hineinzoomen: ${groupLabel(entries)}`
}

const idsAttr = (entries: Entry[]) => entries.map((e) => e.id).join(' ')

/**
 * Every card, group stack and group marker of both sides, in one chronological
 * DOM (and tab) order. Rendered inside the axis band: its top edge is the
 * origin, above-items hang from it, below-items start at its bottom edge.
 * Nothing is culled, so Tab reaches off-screen entries (the timeline pans to
 * the focused one); the timeline's `overflow: clip` hides them.
 */
export function CardLayer({
    items,
    rowHeightPx,
    visibleCount,
    slotHeightPx,
    focusEntryId,
    onOpen,
    onZoomIntoGroup,
}: CardLayerProps) {
    const { timeToX, wasDrag } = useTimeline()
    const ordered = [...items].sort(
        (a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )

    return (
        <div data-layer="points" className="absolute inset-x-0 top-0 h-0">
            {ordered.flatMap((item) => {
                const x = timeToX(item.t)
                const highlighted = item.entries.some(
                    (e) => e.id === focusEntryId
                )
                const out = []

                if (item.kind === 'card' || item.kind === 'group') {
                    const side = item.slot.side
                    // Zero-height anchor on the axis top (above) or bottom (below).
                    const anchorStyle = {
                        top: side === 'above' ? 0 : AXIS_HEIGHT_PX,
                        '--z': highlighted
                            ? Z_HIGHLIGHTED
                            : Z_BASE - item.slot.level,
                    } as CSSProperties
                    const anchorProps = {
                        className:
                            'absolute left-0 h-0 w-0 z-(--z) focus-within:z-300',
                        style: anchorStyle,
                        'data-item-id': item.id,
                        'data-t': item.t,
                        'data-entry-ids': idsAttr(item.entries),
                    }

                    if (item.kind === 'card') {
                        const entry = item.entries[0]!
                        out.push(
                            <div key={item.id} {...anchorProps}>
                                <EntryCard
                                    entry={entry}
                                    x={x}
                                    alignEnd={item.alignEnd}
                                    side={side}
                                    level={item.slot.level}
                                    rowHeightPx={rowHeightPx}
                                    highlighted={entry.id === focusEntryId}
                                    onOpen={onOpen}
                                    wasDrag={wasDrag}
                                />
                            </div>
                        )
                    } else {
                        const focusIndex = item.entries.findIndex(
                            (e) => e.id === focusEntryId
                        )
                        const region = item.entries[0]!.region
                        out.push(
                            <div key={item.id} {...anchorProps}>
                                <div
                                    data-group-id={item.id}
                                    className={clsx(
                                        'absolute',
                                        item.alignEnd && '-translate-x-full'
                                    )}
                                    style={{
                                        left: x,
                                        width: CARD_WIDTH_PX,
                                        [side === 'above' ? 'bottom' : 'top']:
                                            0,
                                        [side === 'above'
                                            ? 'paddingBottom'
                                            : 'paddingTop']: CONNECTOR_MIN_PX,
                                    }}
                                >
                                    <div
                                        aria-hidden="true"
                                        className={clsx(
                                            'absolute w-0.5',
                                            REGION_BG[region],
                                            item.alignEnd ? 'right-0' : 'left-0'
                                        )}
                                        style={{
                                            height: CONNECTOR_MIN_PX,
                                            [side === 'above'
                                                ? 'bottom'
                                                : 'top']: 0,
                                        }}
                                    />
                                    <GroupStack
                                        entries={item.entries}
                                        visibleCount={visibleCount}
                                        slotHeightPx={slotHeightPx}
                                        // Without a highlighted member the window stays put (closing a post must not hide its card).
                                        initialIndex={
                                            focusIndex >= 0
                                                ? focusIndex
                                                : undefined
                                        }
                                        label={groupLabel(item.entries)}
                                        renderCard={(entry) => (
                                            <EntryCard
                                                entry={entry}
                                                x={0}
                                                side={side}
                                                level={0}
                                                rowHeightPx={rowHeightPx}
                                                highlighted={
                                                    entry.id === focusEntryId
                                                }
                                                onOpen={onOpen}
                                                wasDrag={wasDrag}
                                                inline
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )
                    }
                }

                if (item.kind !== 'card') {
                    out.push(
                        <div
                            key={`${item.id}:marker`}
                            data-group-marker={item.id}
                            data-t={item.t}
                            data-entry-ids={idsAttr(item.entries)}
                            className="absolute z-(--z) -translate-x-1/2 -translate-y-1/2 focus-within:z-300"
                            style={
                                {
                                    left: x,
                                    top: AXIS_LINE_Y_PX,
                                    '--z': Z_MARKER,
                                } as CSSProperties
                            }
                        >
                            <GroupMarker
                                count={item.entries.length}
                                label={markerLabel(item.entries)}
                                highlighted={highlighted}
                                onActivate={() => {
                                    if (!wasDrag())
                                        onZoomIntoGroup(item.entries)
                                }}
                            />
                        </div>
                    )
                }
                return out
            })}
        </div>
    )
}
