'use client'

import {
    buildClusterTree,
    cutTree,
    isGroup,
    minGapFromPx,
    type Cluster,
    type ClusterNode,
} from '@/lib/cluster'
import { isSpan, type Entry } from '@/lib/entry'
import {
    placeItems,
    type BlockedInterval,
    type PlaceableItem,
    type PlacedSide,
    type Slot,
} from '@/lib/placement'
import { entryAnchor } from '@/lib/time'
import { useMemo, useState } from 'react'
import { CLUSTER_MIN_GAP_PX, MAX_GROUP_SPAN_PX } from './constants'
import { GROUP_MARKER_SIZE_PX } from './GroupMarker'
import { estimateLabelWidthPx, LABEL_MAX_WIDTH_PX } from './labelMetrics'

/** One thing to draw on a side of the axis: a single card or a group stack. */
export type LayoutItem = {
    id: string
    /** 'marker': shown only as its marker on the axis, because no card or stack slot was free. */
    kind: 'card' | 'group' | 'marker'
    /** Anchor time (ms UTC); the caller maps it to x every frame. */
    t: number
    /** Chronological members; one entry for a card. */
    entries: Entry[]
    slot: Slot
}

export type EntryLayout = {
    items: LayoutItem[]
    /** Group markers to draw on the axis. */
    groups: LayoutItem[]
}

export type LayoutGeometry = {
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

type CardExtent = { x0: number; x1: number }

type CutPlacement = {
    slots: ReadonlyMap<string, Slot>
    extents: ReadonlyMap<string, CardExtent>
    overflow: string[]
}

type LayoutCache = {
    key: unknown
    tree: Cluster | null
    layout: EntryLayout
}

const MARKER_GAP_PX = GROUP_MARKER_SIZE_PX + 4

const MARKER_SLOT: Slot = { side: 'above', level: 0 }

/**
 * Recomputes the layout only when `key` changes (a gesture end, a resize or a collapse),
 * so cards never jump mid-gesture. The previous layout's slots feed the hysteresis.
 */
export function useEntryLayout(
    entries: Entry[],
    geometry: LayoutGeometry,
    key: unknown
): EntryLayout {
    const points = useMemo(() => entries.filter((e) => !isSpan(e)), [entries])
    const tree = useMemo(
        () =>
            buildClusterTree(
                points.map((e) => ({ id: e.id, t: entryAnchor(e) }))
            ),
        [points]
    )
    const parents = useMemo(() => parentMap(tree), [tree])

    const [cache, setCache] = useState<LayoutCache | null>(null)
    if (cache && cache.key === key && cache.tree === tree) return cache.layout
    const previous = cache
        ? new Map(cache.layout.items.map((i) => [i.id, i.slot]))
        : null
    const layout = layoutEntries(points, geometry, tree, parents, previous)
    setCache({ key, tree, layout })
    return layout
}

/**
 * Lays out points as cards and groups. Points closer than CLUSTER_MIN_GAP_PX always form a
 * group (they would sit on one spot). Groups are placed first and passed on as preceding items, so
 * placeItems chooses each card's side knowing the groups around it; only cards that fit nowhere
 * are merged into groups by climbing the cluster tree, and a cluster that can't be merged further
 * is shown as a bare marker on the axis.
 * `previous` slots are kept where they still fit, so cards don't flip sides needlessly.
 */
function layoutEntries(
    points: Entry[],
    geometry: LayoutGeometry,
    tree: Cluster | null,
    parents: ReadonlyMap<string, ClusterNode>,
    previous: ReadonlyMap<string, Slot> | null
): EntryLayout {
    if (points.length === 0 || geometry.width <= 0)
        return { items: [], groups: [] }
    const byId = new Map(points.map((e) => [e.id, e]))
    let cut = cutTree(tree, minGapFromPx(CLUSTER_MIN_GAP_PX, geometry.msPerPx))
    let markerOnly: ReadonlySet<string> = new Set<string>()

    // Every round either shrinks the cut or turns a cluster into a bare marker, so this terminates.
    const lastRound = 2 * points.length + 1
    for (let round = 0; round <= lastRound; round++) {
        const placement = placeCut(cut, markerOnly, geometry, byId, previous)
        const overflow = new Set([
            ...placement.overflow,
            ...markerCollisions(cut, markerOnly, geometry.timeToX),
        ])
        if (overflow.size === 0)
            return toLayout(cut, placement, markerOnly, byId)
        if (round === lastRound)
            return toLayout(
                cut,
                placement,
                new Set([...markerOnly, ...overflow]),
                byId
            )
        ;({ cut, markerOnly } = mergeOverflowing(
            cut,
            overflow,
            parents,
            markerOnly,
            geometry.timeToX
        ))
    }
    return { items: [], groups: [] }
}

function placeCut(
    cut: readonly Cluster[],
    markerOnly: ReadonlySet<string>,
    geometry: LayoutGeometry,
    byId: ReadonlyMap<string, Entry>,
    previous: ReadonlyMap<string, Slot> | null
): CutPlacement {
    const { timeToX, maxLevels, groupLevels, gapPx } = geometry
    const extents = new Map(
        cut.map((cluster) => [
            cluster.id,
            extentOf(timeToX(cluster.t), widthOf(cluster, byId)),
        ])
    )
    const toPlaceable = (cluster: Cluster): PlaceableItem => {
        const extent = extents.get(cluster.id)!
        return {
            id: cluster.id,
            x0: extent.x0,
            x1: extent.x1,
            order: cluster.t,
        }
    }
    const placeable = cut.filter((cluster) => !markerOnly.has(cluster.id))
    const groups = placeable.filter(isGroup)
    const groupPlacement = placeItems(groups.map(toPlaceable), previous, {
        gapPx,
        maxLevels: 1,
    })
    const blocked: BlockedInterval[] = [...groupPlacement.slots].flatMap(
        ([id, slot]) => {
            const extent = extents.get(id)!
            return Array.from({ length: groupLevels }, (_, level) => ({
                ...slot,
                level,
                x0: extent.x0,
                x1: extent.x1,
            }))
        }
    )
    const placedGroups: PlacedSide[] = groups.flatMap((group) => {
        const slot = groupPlacement.slots.get(group.id)
        return slot ? [{ order: group.t, side: slot.side }] : []
    })
    const cardPlacement = placeItems(
        placeable.filter((cluster) => !isGroup(cluster)).map(toPlaceable),
        previous,
        { gapPx, maxLevels, blocked, placedElsewhere: placedGroups }
    )
    return {
        slots: new Map([...groupPlacement.slots, ...cardPlacement.slots]),
        extents,
        overflow: [...groupPlacement.overflow, ...cardPlacement.overflow],
    }
}

function extentOf(x: number, widthPx: number): CardExtent {
    return { x0: x, x1: x + widthPx }
}

/** A card is as wide as its label; a group stack as wide as its widest possible label. */
function widthOf(cluster: Cluster, byId: ReadonlyMap<string, Entry>): number {
    return isGroup(cluster)
        ? LABEL_MAX_WIDTH_PX
        : estimateLabelWidthPx(byId.get(cluster.id)!)
}

function markerCollisions(
    cut: readonly Cluster[],
    markerOnly: ReadonlySet<string>,
    timeToX: (t: number) => number
): Set<string> {
    const collisions = new Set<string>()
    let lastMarkerX = -Infinity
    for (const cluster of cut) {
        if (!isGroup(cluster) && !markerOnly.has(cluster.id)) continue
        const x = timeToX(cluster.t)
        if (x - lastMarkerX < MARKER_GAP_PX && !markerOnly.has(cluster.id))
            collisions.add(cluster.id)
        else lastMarkerX = x
    }
    return collisions
}

function toLayout(
    cut: readonly Cluster[],
    placement: CutPlacement,
    markerOnly: ReadonlySet<string>,
    byId: ReadonlyMap<string, Entry>
): EntryLayout {
    const items = cut.flatMap((cluster): LayoutItem[] => {
        const entries = entriesOf(cluster, byId)
        if (markerOnly.has(cluster.id))
            return [
                {
                    id: cluster.id,
                    kind: 'marker',
                    t: cluster.t,
                    entries,
                    slot: MARKER_SLOT,
                },
            ]
        const slot = placement.slots.get(cluster.id)
        if (!slot) return []
        return [
            {
                id: cluster.id,
                kind: isGroup(cluster) ? 'group' : 'card',
                t: cluster.t,
                entries,
                slot,
            },
        ]
    })
    return { items, groups: items.filter((item) => item.kind !== 'card') }
}

function entriesOf(
    cluster: Cluster,
    byId: ReadonlyMap<string, Entry>
): Entry[] {
    return cluster.members
        .map((id) => byId.get(id))
        .filter((e): e is Entry => e !== undefined)
}

function mergeOverflowing(
    cut: readonly Cluster[],
    overflow: ReadonlySet<string>,
    parents: ReadonlyMap<string, ClusterNode>,
    markerOnly: ReadonlySet<string>,
    timeToX: (t: number) => number
): { cut: Cluster[]; markerOnly: ReadonlySet<string> } {
    const isMergeable = (
        parent: ClusterNode | undefined
    ): parent is ClusterNode =>
        parent !== undefined &&
        Math.abs(timeToX(parent.tMax) - timeToX(parent.tMin)) <=
            MAX_GROUP_SPAN_PX
    const overflowIds = [...overflow]
    const unmergeable = overflowIds.filter(
        (id) => !isMergeable(parents.get(id))
    )
    const widestFirst = overflowIds
        .map((id) => parents.get(id))
        .filter(isMergeable)
        .sort((a, b) => b.count - a.count)
    const merged = new Set<string>()
    let mergedCut = [...cut]
    for (const parent of widestFirst) {
        if (parent.members.every((m) => merged.has(m))) continue
        mergedCut = mergeInto(mergedCut, parent)
        for (const m of parent.members) merged.add(m)
    }
    const inCut = new Set(mergedCut.map((cluster) => cluster.id))
    return {
        cut: mergedCut,
        markerOnly: new Set(
            [...markerOnly, ...unmergeable].filter((id) => inCut.has(id))
        ),
    }
}

function parentMap(root: Cluster | null): Map<string, ClusterNode> {
    const parents = new Map<string, ClusterNode>()
    const stack: Cluster[] = root ? [root] : []
    while (stack.length) {
        const cluster = stack.pop()!
        if (!isGroup(cluster)) continue
        parents.set(cluster.left.id, cluster)
        parents.set(cluster.right.id, cluster)
        stack.push(cluster.left, cluster.right)
    }
    return parents
}

function mergeInto(cut: readonly Cluster[], parent: ClusterNode): Cluster[] {
    const members = new Set(parent.members)
    const isInside = (cluster: Cluster) => members.has(cluster.members[0]!)
    const firstInside = cut.findIndex(isInside)
    return cut.flatMap((cluster, i) => {
        if (!isInside(cluster)) return [cluster]
        return i === firstInside ? [parent] : []
    })
}

export const PRIVATE_UNDER_TESTS = {
    layoutEntries,
    parentMap,
    markerCollisions,
    mergeInto,
}
