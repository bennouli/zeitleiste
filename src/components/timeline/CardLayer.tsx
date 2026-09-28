'use client'

import type { Entry } from '@/lib/entry'
import { formatGroupYears } from '@/lib/format'
import { compareIds } from '@/lib/order'
import type { CSSProperties, ReactNode } from 'react'
import { AXIS_LINE_Y_PX } from './Axis'
import { Connector } from './Connector'
import { CARD_FIRST_ROW_OFFSET_PX } from './constants'
import { EntryCard } from './EntryCard'
import { GroupMarker } from './GroupMarker'
import { GroupStack } from './GroupStack'
import { LABEL_MAX_WIDTH_PX } from './labelMetrics'
import { useTimeline } from './TimelineContext'
import type { LayoutItem } from './useEntryLayout'

/** Paint order: lower rows over higher rows (whose connectors pass behind them), markers over the axis. */
const Z_BASE = 100
const Z_MARKER = 150
const Z_HIGHLIGHTED = 200

export type CardLayerProps = {
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

/**
 * Every card, group stack and group marker of both sides, in one chronological
 * DOM (and tab) order. Rendered inside the axis band: every item hangs from
 * the axis line, above-items upwards and below-items downwards.
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
    const ordered = [...items].sort(
        (a, b) => a.t - b.t || compareIds(a.id, b.id)
    )

    return (
        <div data-layer="points" className="absolute inset-x-0 top-0 h-0">
            {ordered.flatMap((item) => {
                const highlighted = item.entries.some(
                    (e) => e.id === focusEntryId
                )
                return [
                    item.kind !== 'marker' && (
                        <AnchoredItem
                            key={item.id}
                            item={item}
                            highlighted={highlighted}
                        >
                            {item.kind === 'card' ? (
                                <CardItem
                                    item={item}
                                    rowHeightPx={rowHeightPx}
                                    focusEntryId={focusEntryId}
                                    onOpen={onOpen}
                                />
                            ) : (
                                <GroupItem
                                    item={item}
                                    rowHeightPx={rowHeightPx}
                                    visibleCount={visibleCount}
                                    slotHeightPx={slotHeightPx}
                                    focusEntryId={focusEntryId}
                                    onOpen={onOpen}
                                />
                            )}
                        </AnchoredItem>
                    ),
                    item.kind !== 'card' && (
                        <MarkerItem
                            key={`${item.id}:marker`}
                            item={item}
                            highlighted={highlighted}
                            onZoomIntoGroup={onZoomIntoGroup}
                        />
                    ),
                ]
            })}
        </div>
    )
}

const idsAttr = (entries: Entry[]) => entries.map((e) => e.id).join(' ')

type AnchoredItemProps = {
    item: LayoutItem
    highlighted: boolean
    children: ReactNode
}

function AnchoredItem({ item, highlighted, children }: AnchoredItemProps) {
    const style = {
        top: AXIS_LINE_Y_PX,
        '--z': highlighted ? Z_HIGHLIGHTED : Z_BASE - item.slot.level,
    } as CSSProperties
    return (
        <div
            className="absolute left-0 h-0 w-0 z-(--z) focus-within:z-300"
            style={style}
            data-item-id={item.id}
            data-t={item.t}
            data-entry-ids={idsAttr(item.entries)}
        >
            {children}
        </div>
    )
}

type ItemProps = Pick<
    CardLayerProps,
    'rowHeightPx' | 'focusEntryId' | 'onOpen'
> & { item: LayoutItem }

function CardItem({ item, rowHeightPx, focusEntryId, onOpen }: ItemProps) {
    const { timeToX, wasDrag } = useTimeline()
    const entry = item.entries[0]!
    return (
        <EntryCard
            entry={entry}
            x={timeToX(item.t)}
            side={item.slot.side}
            level={item.slot.level}
            rowHeightPx={rowHeightPx}
            highlighted={entry.id === focusEntryId}
            onOpen={onOpen}
            wasDrag={wasDrag}
        />
    )
}

type GroupItemProps = ItemProps &
    Pick<CardLayerProps, 'visibleCount' | 'slotHeightPx'>

function GroupItem({
    item,
    rowHeightPx,
    visibleCount,
    slotHeightPx,
    focusEntryId,
    onOpen,
}: GroupItemProps) {
    const { timeToX, wasDrag } = useTimeline()
    const side = item.slot.side
    const focusIndex = item.entries.findIndex((e) => e.id === focusEntryId)
    return (
        <div
            data-group-id={item.id}
            className="absolute"
            style={{
                left: timeToX(item.t),
                width: LABEL_MAX_WIDTH_PX,
                [side === 'above' ? 'bottom' : 'top']: CARD_FIRST_ROW_OFFSET_PX,
            }}
        >
            <Connector side={side} lengthPx={CARD_FIRST_ROW_OFFSET_PX} />
            <GroupStack
                entries={item.entries}
                visibleCount={visibleCount}
                slotHeightPx={slotHeightPx}
                // Without a highlighted member the window stays put (closing a post must not hide its card).
                initialIndex={focusIndex >= 0 ? focusIndex : undefined}
                label={groupLabel(item.entries)}
                side={side}
                renderCard={(entry) => (
                    <EntryCard
                        entry={entry}
                        x={0}
                        side={side}
                        level={0}
                        rowHeightPx={rowHeightPx}
                        highlighted={entry.id === focusEntryId}
                        onOpen={onOpen}
                        wasDrag={wasDrag}
                        inline
                    />
                )}
            />
        </div>
    )
}

type MarkerItemProps = Pick<CardLayerProps, 'onZoomIntoGroup'> & {
    item: LayoutItem
    highlighted: boolean
}

function MarkerItem({ item, highlighted, onZoomIntoGroup }: MarkerItemProps) {
    const { timeToX, wasDrag } = useTimeline()
    return (
        <div
            data-group-marker={item.id}
            data-t={item.t}
            data-entry-ids={idsAttr(item.entries)}
            className="absolute z-(--z) -translate-x-1/2 -translate-y-1/2 focus-within:z-300"
            style={
                {
                    left: timeToX(item.t),
                    top: AXIS_LINE_Y_PX,
                    '--z': Z_MARKER,
                } as CSSProperties
            }
        >
            <GroupMarker
                entries={item.entries}
                label={markerLabel(item.entries)}
                side={item.slot.side}
                highlighted={highlighted}
                onActivate={() => {
                    if (!wasDrag()) onZoomIntoGroup(item.entries)
                }}
            />
        </div>
    )
}

function groupLabel(entries: Entry[]): string {
    if (entries.length === 0) return 'Gruppe'
    return `Gruppe mit ${entries.length} Einträgen, ${formatGroupYears(entries)}`
}

/** Name of a group's axis marker; differs from the stack's name so the two tab stops are distinguishable. */
function markerLabel(entries: Entry[]): string {
    return `Hineinzoomen: ${groupLabel(entries)}`
}

export const PRIVATE_UNDER_TESTS = { groupLabel, markerLabel }
