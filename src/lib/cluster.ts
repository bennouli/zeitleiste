// Stable 1D clustering of timeline points.
//
// The tree is built once per data set by single-linkage agglomerative clustering:
// the two adjacent clusters with the smallest gap between their nearest members are
// merged first (ties: earlier pair first). Merges therefore happen in non-decreasing
// gap order, which gives the invariant:
//
//   every node's `gap` is >= the `gap` of every node below it.
//
// Cutting at minGapMs (show a node as a group iff gap < minGapMs) thus yields exactly
// the maximal runs of points whose adjacent gaps are all < minGapMs. Raising minGapMs
// only merges clusters, lowering it only splits them into their children, and an
// entry never moves between groups.

import { compareIds } from '@/lib/order'

export type ClusterPoint = {
    id: string
    t: number
}

export type ClusterLeaf = {
    kind: 'leaf'
    id: string
    t: number
    members: readonly string[]
    count: 1
}

export type ClusterNode = {
    kind: 'node'
    /** Stable id derived from the members (`${firstId}..${lastId}`): same members ⇒ same id. */
    id: string
    /** Position of the group marker: the mean of the member times. */
    t: number
    /** Earliest and latest member time. */
    tMin: number
    tMax: number
    /** Member ids in chronological order. */
    members: readonly string[]
    count: number
    left: Cluster
    right: Cluster
    /** The gap (ms) between the nearest members of left and right — the distance at which this node splits. */
    gap: number
}

export type Cluster = ClusterLeaf | ClusterNode

export function isGroup(c: Cluster): c is ClusterNode {
    return c.kind === 'node'
}

/**
 * Build once per data set. Returns null for no points. Points need not be sorted.
 * Throws on duplicate ids, ids containing '..', and non-finite times.
 */
export function buildClusterTree(
    points: readonly ClusterPoint[]
): Cluster | null {
    const seen = new Set<string>()
    for (const p of points) {
        if (seen.has(p.id))
            throw new Error(`buildClusterTree: duplicate id "${p.id}"`)
        // Node ids are `${first}..${last}`; a leaf id containing '..' could collide with one.
        if (p.id.includes('..'))
            throw new Error(
                `buildClusterTree: id "${p.id}" must not contain ".."`
            )
        if (!Number.isFinite(p.t))
            throw new Error(`buildClusterTree: non-finite t for "${p.id}"`)
        seen.add(p.id)
    }
    if (points.length === 0) return null

    // Sort by time, then id, so the tree does not depend on input order.
    const sorted = [...points].sort(
        (a, b) => a.t - b.t || compareIds(a.id, b.id)
    )
    const n = sorted.length
    const ids = sorted.map((p) => p.id)

    // byStart[s]: cluster spanning sorted[s..endOf[s]]; startOf[e]: start of the cluster ending at e.
    const byStart: Cluster[] = sorted.map((p) => ({
        kind: 'leaf',
        id: p.id,
        t: p.t,
        members: [p.id],
        count: 1,
    }))
    const endOf = Array.from({ length: n }, (_, i) => i)
    const startOf = Array.from({ length: n }, (_, i) => i)

    const order = Array.from({ length: n - 1 }, (_, i) => i)
    const gapAt = (i: number) => at(sorted, i + 1).t - at(sorted, i).t
    order.sort((a, b) => gapAt(a) - gapAt(b) || a - b)

    for (const i of order) {
        const ls = at(startOf, i)
        const re = at(endOf, i + 1)
        const left = at(byStart, ls)
        const right = at(byStart, i + 1)
        const count = left.count + right.count
        const node: ClusterNode = {
            kind: 'node',
            id: `${at(ids, ls)}..${at(ids, re)}`,
            t: (left.t * left.count + right.t * right.count) / count,
            tMin: at(sorted, ls).t,
            tMax: at(sorted, re).t,
            members: ids.slice(ls, re + 1),
            count,
            left,
            right,
            gap: gapAt(i),
        }
        byStart[ls] = node
        endOf[ls] = re
        startOf[re] = ls
    }
    return at(byStart, 0)
}

function at<T>(arr: readonly T[], i: number): T {
    const v = arr[i]
    if (v === undefined) throw new Error(`cluster: index ${i} out of range`)
    return v
}

/**
 * Chronological list of clusters visible at this zoom. A node is shown as a group when
 * its `gap` < minGapMs; otherwise it is split into its children. Leaves are returned as is.
 */
export function cutTree(root: Cluster | null, minGapMs: number): Cluster[] {
    if (!root) return []
    const out: Cluster[] = []
    // Iterative pre-order (left before right) keeps chronological order without recursion depth limits.
    const stack: Cluster[] = [root]
    while (stack.length > 0) {
        const c = stack.pop()!
        if (c.kind === 'leaf' || c.gap < minGapMs) {
            out.push(c)
        } else {
            stack.push(c.right, c.left)
        }
    }
    return out
}

/** minGapMs from a pixel distance and the current scale. */
export function minGapFromPx(minGapPx: number, msPerPx: number): number {
    return minGapPx * msPerPx
}

/** The cluster in a cut that contains an id, or undefined. */
function findCluster(cut: readonly Cluster[], id: string): Cluster | undefined {
    return cut.find((c) =>
        c.kind === 'leaf' ? c.id === id : c.members.includes(id)
    )
}

export const PRIVATE_UNDER_TESTS = { findCluster }
