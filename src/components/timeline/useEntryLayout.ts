'use client'

import { useMemo, useState } from 'react'
import { isSpan, type Entry } from '@/lib/entry'
import { buildClusterTree, cutTree, isGroup, minGapFromPx, type Cluster, type ClusterNode } from '@/lib/cluster'
import { entryAnchor } from '@/lib/time'
import { placeItems, type BlockedInterval, type PlaceableItem, type Slot } from '@/lib/placement'
import { CARD_WIDTH_PX } from './EntryCard'
import { CLUSTER_MIN_GAP_PX, MAX_GROUP_SPAN_PX } from './constants'
import { GROUP_MARKER_SIZE_PX } from './GroupMarker'

/** One thing to draw on a side of the axis: a single card or a group stack. */
export interface LayoutItem {
  id: string
  /** 'marker': shown only as its marker on the axis, because no card or stack slot was free. */
  kind: 'card' | 'group' | 'marker'
  /** Anchor time (ms UTC); the caller maps it to x every frame. */
  t: number
  /** Chronological members; one entry for a card. */
  entries: Entry[]
  slot: Slot
  /** Card anchored at its right edge because it would leave the right border. */
  alignEnd: boolean
}

export interface EntryLayout {
  items: LayoutItem[]
  /** Group markers to draw on the axis. */
  groups: LayoutItem[]
}

export interface EntryLayoutInput {
  points: Entry[]
  /** Map from time to x at the moment of layout (a gesture end). */
  timeToX: (t: number) => number
  msPerPx: number
  width: number
  /** Rows per side that fit into the band. */
  maxLevels: number
  /** Rows a group stack covers. */
  groupLevels: number
  gapPx: number
}

/** Parent lookup for climbing the cluster tree when cards don't fit. */
function parentMap(root: Cluster | null): Map<string, ClusterNode> {
  const parents = new Map<string, ClusterNode>()
  const stack: Cluster[] = root ? [root] : []
  while (stack.length) {
    const c = stack.pop()!
    if (!isGroup(c)) continue
    parents.set(c.left.id, c)
    parents.set(c.right.id, c)
    stack.push(c.left, c.right)
  }
  return parents
}

/** Replace every cluster of `cut` that lies inside `parent` by `parent`, keeping chronological order. */
function mergeInto(cut: Cluster[], parent: ClusterNode): Cluster[] {
  const members = new Set(parent.members)
  const out: Cluster[] = []
  let inserted = false
  for (const c of cut) {
    if (members.has(c.members[0]!)) {
      if (!inserted) {
        out.push(parent)
        inserted = true
      }
      continue
    }
    out.push(c)
  }
  return out
}

function extentOf(x: number, width: number): { x0: number; x1: number; alignEnd: boolean } {
  const alignEnd = x + CARD_WIDTH_PX > width && x - CARD_WIDTH_PX >= 0
  return alignEnd ? { x0: x - CARD_WIDTH_PX, x1: x, alignEnd } : { x0: x, x1: x + CARD_WIDTH_PX, alignEnd }
}

/** Groups whose markers would overlap on the axis. */
const MARKER_GAP_PX = GROUP_MARKER_SIZE_PX + 4

/**
 * Lays out points as cards and groups. Points closer than CLUSTER_MIN_GAP_PX always form a
 * group (they would sit on one spot). Cards go above the axis, then below, then to the next
 * row; only cards that fit nowhere are merged into groups by climbing the cluster tree, and a
 * cluster that can't be merged further is shown as a bare marker on the axis.
 * `previous` slots are kept where they still fit, so cards don't flip sides needlessly.
 */
export function layoutEntries(
  input: EntryLayoutInput,
  root: Cluster | null,
  parents: Map<string, ClusterNode>,
  previous: ReadonlyMap<string, Slot> | null,
): EntryLayout {
  const { points, timeToX, msPerPx, width, maxLevels, groupLevels, gapPx } = input
  if (points.length === 0 || width <= 0) return { items: [], groups: [] }
  const byId = new Map(points.map((e) => [e.id, e]))
  let cut = cutTree(root, minGapFromPx(CLUSTER_MIN_GAP_PX, msPerPx))
  const markerOnly = new Set<string>()

  const toItem = (c: Cluster, kind: LayoutItem['kind'], slot: Slot, alignEnd: boolean): LayoutItem => ({
    id: c.id,
    kind,
    t: c.t,
    entries: c.members.map((id) => byId.get(id)).filter((e): e is Entry => e !== undefined),
    slot,
    alignEnd,
  })

  // Every round either shrinks the cut or turns a cluster into a bare marker, so this terminates.
  const lastRound = 2 * points.length + 1
  for (let round = 0; round <= lastRound; round++) {
    const groupItems: PlaceableItem[] = []
    const cardItems: PlaceableItem[] = []
    const extents = new Map<string, ReturnType<typeof extentOf>>()
    for (const c of cut) {
      const ext = extentOf(timeToX(c.t), width)
      extents.set(c.id, ext)
      if (markerOnly.has(c.id)) continue
      const importance = isGroup(c) ? 10 + c.count : (byId.get(c.id)?.importance ?? 1)
      const item = { id: c.id, x0: ext.x0, x1: ext.x1, importance, order: c.t }
      ;(isGroup(c) ? groupItems : cardItems).push(item)
    }

    // Groups first: they sit at level 0 and block the rows their stack covers.
    const groupPlacement = placeItems(groupItems, previous, { gapPx, maxLevels: 1 })
    const blocked: BlockedInterval[] = []
    for (const [id, slot] of groupPlacement.slots) {
      const ext = extents.get(id)!
      for (let level = 0; level < groupLevels; level++) blocked.push({ ...slot, level, x0: ext.x0, x1: ext.x1 })
    }
    const cardPlacement = placeItems(cardItems, previous, { gapPx, maxLevels, blocked })
    const overflow = new Set([...groupPlacement.overflow, ...cardPlacement.overflow])

    // Markers of neighbouring groups must not overlap on the axis either.
    let lastMarkerX = -Infinity
    for (const c of cut) {
      if (!isGroup(c) && !markerOnly.has(c.id)) continue
      const x = timeToX(c.t)
      if (x - lastMarkerX < MARKER_GAP_PX && !markerOnly.has(c.id)) overflow.add(c.id)
      else lastMarkerX = x
    }

    if (round === lastRound) for (const id of overflow) markerOnly.add(id)
    if (overflow.size === 0 || round === lastRound) {
      const items: LayoutItem[] = []
      const groups: LayoutItem[] = []
      for (const c of cut) {
        const ext = extents.get(c.id)!
        if (markerOnly.has(c.id)) {
          const item = toItem(c, 'marker', { side: 'above', level: 0 }, false)
          items.push(item)
          groups.push(item)
          continue
        }
        const slot = groupPlacement.slots.get(c.id) ?? cardPlacement.slots.get(c.id)
        if (!slot) continue
        const item = toItem(c, isGroup(c) ? 'group' : 'card', slot, ext.alignEnd)
        items.push(item)
        if (item.kind === 'group') groups.push(item)
      }
      return { items, groups }
    }

    // Merge each overflowing cluster with its sibling, widest parents first so nested ones are skipped.
    const candidates: ClusterNode[] = []
    for (const id of overflow) {
      const parent = parents.get(id)
      if (!parent) {
        markerOnly.add(id)
        continue
      }
      const span = Math.abs(timeToX(parent.tMax) - timeToX(parent.tMin))
      if (span > MAX_GROUP_SPAN_PX) markerOnly.add(id)
      else candidates.push(parent)
    }
    candidates.sort((a, b) => b.count - a.count)
    const merged = new Set<string>()
    for (const parent of candidates) {
      if (parent.members.every((m) => merged.has(m))) continue
      cut = mergeInto(cut, parent)
      for (const m of parent.members) merged.add(m)
    }
    // A merged cluster is placed afresh; its former parts are no longer bare markers.
    const inCut = new Set(cut.map((c) => c.id))
    for (const id of markerOnly) if (!inCut.has(id)) markerOnly.delete(id)
  }
  /* istanbul ignore next -- the loop always returns */
  return { items: [], groups: [] }
}

interface LayoutCache {
  key: unknown
  tree: Cluster | null
  layout: EntryLayout
}

/**
 * Recomputes the layout only when `key` changes (a gesture end, a resize or a collapse),
 * so cards never jump mid-gesture. The previous layout's slots feed the hysteresis.
 */
export function useEntryLayout(entries: Entry[], input: Omit<EntryLayoutInput, 'points'>, key: unknown): EntryLayout {
  const points = useMemo(() => entries.filter((e) => !isSpan(e)), [entries])
  const tree = useMemo(() => buildClusterTree(points.map((e) => ({ id: e.id, t: entryAnchor(e) }))), [points])
  const parents = useMemo(() => parentMap(tree), [tree])

  // Derived state adjusted during render: the layout depends on the previous one.
  const [cache, setCache] = useState<LayoutCache | null>(null)
  if (cache && cache.key === key && cache.tree === tree) return cache.layout
  const previous = cache ? new Map(cache.layout.items.map((i) => [i.id, i.slot])) : null
  const layout = layoutEntries({ ...input, points }, tree, parents, previous)
  setCache({ key, tree, layout })
  return layout
}
