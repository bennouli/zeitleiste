'use client'

import clsx from 'clsx'
import type { Entry, Region } from '@/lib/entry'
import { CONNECTOR_MIN_PX, EntryCard } from './EntryCard'
import { GroupStack } from './GroupStack'
import { useTimeline } from './TimelineContext'
import type { LayoutItem } from './useEntryLayout'

const REGION_BG: Record<Region, string> = { russia: 'bg-russia', west: 'bg-west', both: 'bg-both' }

export interface CardLayerProps {
  side: 'above' | 'below'
  items: LayoutItem[]
  rowHeightPx: number
  /** Cards visible at once in a group stack. */
  visibleCount: number
  slotHeightPx: number
  focusEntryId: string | null
  onOpen: (id: string) => void
}

export function groupLabel(entries: Entry[]): string {
  const first = entries[0]
  const last = entries[entries.length - 1]
  if (!first || !last) return 'Gruppe'
  const from = String(first.start.year)
  const to = String(last.start.year)
  return `Gruppe mit ${entries.length} Einträgen, ${from === to ? from : `${from}–${to}`}`
}

/** The cards and group stacks on one side of the axis, positioned by the current viewport. */
export function CardLayer({ side, items, rowHeightPx, visibleCount, slotHeightPx, focusEntryId, onOpen }: CardLayerProps) {
  const { timeToX, width, wasDrag } = useTimeline()
  const margin = 2 * slotHeightPx
  const visible = items.filter((item) => item.slot.side === side)
  // Higher rows first, so a long connector never paints over a lower card.
  visible.sort((a, b) => b.slot.level - a.slot.level)

  return (
    <>
      {visible.map((item) => {
        const x = timeToX(item.t)
        if (x < -margin || x > width + margin) return null

        if (item.kind === 'card') {
          const entry = item.entries[0]!
          return (
            <EntryCard
              key={item.id}
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
          )
        }

        const focusIndex = item.entries.findIndex((e) => e.id === focusEntryId)
        const region = item.entries[0]!.region
        return (
          <div
            key={item.id}
            data-group-id={item.id}
            className={clsx('absolute', item.alignEnd && '-translate-x-full')}
            style={{
              left: x,
              [side === 'above' ? 'bottom' : 'top']: 0,
              [side === 'above' ? 'paddingBottom' : 'paddingTop']: CONNECTOR_MIN_PX,
            }}
          >
            <div
              aria-hidden="true"
              className={clsx('absolute w-0.5', REGION_BG[region], item.alignEnd ? 'right-0' : 'left-0')}
              style={{ height: CONNECTOR_MIN_PX, [side === 'above' ? 'bottom' : 'top']: 0 }}
            />
            <GroupStack
              key={item.id}
              entries={item.entries}
              visibleCount={visibleCount}
              slotHeightPx={slotHeightPx}
              initialIndex={Math.max(0, focusIndex)}
              label={groupLabel(item.entries)}
              className="w-44"
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
      })}
    </>
  )
}

