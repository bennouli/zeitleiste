import { entries } from '@/data/entries'
import { isSpan } from '@/lib/entry'
import { describe, expect, it } from 'vitest'
import {
    buildClusterTree,
    cutTree,
    findCluster,
    isGroup,
    minGapFromPx,
    type Cluster,
    type ClusterPoint,
} from './cluster'

const DAY = 86_400_000
const YEAR = 365.25 * DAY

const samplePoints: ClusterPoint[] = entries
    .filter((e) => !isSpan(e))
    .map((e) => ({
        id: e.id,
        t: Date.UTC(e.start.year, (e.start.month ?? 1) - 1, e.start.day ?? 1),
    }))

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
    let a = seed
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function randomPoints(seed: number, n: number): ClusterPoint[] {
    const r = rng(seed)
    // Round to whole days so identical times and equal gaps occur.
    return Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        t: Math.round(r() * 200) * DAY,
    }))
}

function shuffle<T>(arr: readonly T[], seed: number): T[] {
    const r = rng(seed)
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1))
        ;[a[i], a[j]] = [a[j] as T, a[i] as T]
    }
    return a
}

function chronologicalIds(points: readonly ClusterPoint[]): string[] {
    return [...points]
        .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))
        .map((p) => p.id)
}

function allNodes(root: Cluster | null): Cluster[] {
    const out: Cluster[] = []
    const stack = root ? [root] : []
    while (stack.length > 0) {
        const c = stack.pop()!
        out.push(c)
        if (isGroup(c)) stack.push(c.left, c.right)
    }
    return out
}

function expectStable(points: readonly ClusterPoint[], gaps: number[]) {
    const root = buildClusterTree(points)
    const ids = chronologicalIds(points)
    const sortedGaps = [...gaps].sort((x, y) => x - y)
    const cuts = sortedGaps.map((g) => cutTree(root, g))
    for (const cut of cuts) {
        // Members never reorder: concatenating the cut gives the chronological id list.
        expect(cut.flatMap((c) => c.members)).toEqual(ids)
    }
    cuts.forEach((fine, i) => {
        for (const coarse of cuts.slice(i + 1)) {
            for (const c of fine) {
                const containing = coarse.filter((k) =>
                    c.members.every((m) => k.members.includes(m))
                )
                expect(containing).toHaveLength(1)
            }
        }
    })
}

describe('buildClusterTree / cutTree stability', () => {
    const gaps = [
        0,
        1,
        DAY,
        7 * DAY,
        30 * DAY,
        0.5 * YEAR,
        YEAR,
        2 * YEAR,
        10 * YEAR,
        50 * YEAR,
        Infinity,
    ]

    it('is stable for the sample data points', () => {
        expect(samplePoints.length).toBeGreaterThan(3)
        expectStable(samplePoints, gaps)
    })

    it('is stable for random point sets', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const points = randomPoints(seed, 5 + seed * 3)
            expectStable(points, [
                0,
                1,
                DAY,
                2 * DAY,
                3 * DAY,
                5 * DAY,
                10 * DAY,
                20 * DAY,
                50 * DAY,
                Infinity,
            ])
        }
    })

    it('cut groups are exactly the runs whose adjacent gaps are all < minGap', () => {
        for (let seed = 1; seed <= 10; seed++) {
            const points = randomPoints(seed, 40)
            const sorted = [...points].sort(
                (a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)
            )
            const root = buildClusterTree(points)
            for (const minGap of [DAY, 3 * DAY, 8 * DAY]) {
                const expected: string[][] = []
                let prev: ClusterPoint | undefined
                for (const p of sorted) {
                    const run = expected[expected.length - 1]
                    if (prev && run && p.t - prev.t < minGap) run.push(p.id)
                    else expected.push([p.id])
                    prev = p
                }
                expect(
                    cutTree(root, minGap).map((c) => [...c.members])
                ).toEqual(expected)
            }
        }
    })
})

describe('cutTree extremes', () => {
    it('cut at 0 returns all leaves in chronological order', () => {
        const root = buildClusterTree(samplePoints)
        const cut = cutTree(root, 0)
        expect(cut.every((c) => c.kind === 'leaf')).toBe(true)
        expect(cut.map((c) => c.id)).toEqual(chronologicalIds(samplePoints))
    })

    it('cut at Infinity returns the root', () => {
        const root = buildClusterTree(samplePoints)
        const cut = cutTree(root, Infinity)
        expect(cut).toEqual([root])
        expect(cut[0]?.count).toBe(samplePoints.length)
    })

    it('cut at Infinity of a single point returns the leaf', () => {
        const root = buildClusterTree([{ id: 'a', t: 5 }])
        expect(root).toEqual({
            kind: 'leaf',
            id: 'a',
            t: 5,
            members: ['a'],
            count: 1,
        })
        expect(cutTree(root, Infinity)).toEqual([root])
        expect(cutTree(root, 0)).toEqual([root])
    })

    it('a node whose gap equals minGap is split', () => {
        const root = buildClusterTree([
            { id: 'a', t: 0 },
            { id: 'b', t: 10 },
        ])
        expect(cutTree(root, 10).map((c) => c.id)).toEqual(['a', 'b'])
        expect(cutTree(root, 10.0001).map((c) => c.id)).toEqual(['a..b'])
    })
})

describe('sample data 1914–1922', () => {
    const inRange = samplePoints
        .filter(
            (p) => p.t >= Date.UTC(1914, 0, 1) && p.t < Date.UTC(1923, 0, 1)
        )
        .map((p) => p.id)
    const root = buildClusterTree(samplePoints)

    it('groups at a coarse minGap (2 years)', () => {
        expect(inRange.length).toBeGreaterThanOrEqual(3)
        const cut = cutTree(root, 2 * YEAR)
        const clusters = new Set(inRange.map((id) => findCluster(cut, id)))
        const groups = [...clusters].filter(
            (c): c is Cluster => c !== undefined && isGroup(c)
        )
        expect(groups.length).toBeGreaterThanOrEqual(1)
        expect(clusters.size).toBeLessThan(inRange.length)
        for (const g of groups) expect(g.count).toBeGreaterThan(1)
    })

    it('splits at a fine minGap (1 month)', () => {
        const cut = cutTree(root, 30 * DAY)
        for (const id of inRange) {
            const c = findCluster(cut, id)
            expect(c?.kind).toBe('leaf')
            expect(c?.id).toBe(id)
        }
    })
})

describe('node properties', () => {
    it('node ids are stable across rebuilds with shuffled input', () => {
        const idsOf = (root: Cluster | null) =>
            allNodes(root)
                .map((c) => c.id)
                .sort()
        for (const points of [samplePoints, randomPoints(7, 60)]) {
            const base = buildClusterTree(points)
            for (let seed = 1; seed <= 5; seed++) {
                const shuffled = buildClusterTree(shuffle(points, seed))
                expect(idsOf(shuffled)).toEqual(idsOf(base))
                expect(shuffled).toEqual(base)
            }
        }
    })

    it('t is the mean of member times; tMin/tMax, count and members are right', () => {
        const points = randomPoints(3, 50)
        const tOf = new Map(points.map((p) => [p.id, p.t]))
        for (const c of allNodes(buildClusterTree(points))) {
            const times = c.members.map((m) => tOf.get(m)!)
            expect(c.count).toBe(c.members.length)
            expect(c.t).toBeCloseTo(
                times.reduce((s, t) => s + t, 0) / times.length,
                -1
            )
            if (isGroup(c)) {
                expect(c.tMin).toBe(Math.min(...times))
                expect(c.tMax).toBe(Math.max(...times))
                expect(c.members).toEqual([
                    ...c.left.members,
                    ...c.right.members,
                ])
                expect(c.id).toBe(
                    `${c.members[0]}..${c.members[c.members.length - 1]}`
                )
                const leftMax = isGroup(c.left) ? c.left.tMax : c.left.t
                const rightMin = isGroup(c.right) ? c.right.tMin : c.right.t
                expect(c.gap).toBe(rightMin - leftMax)
            }
        }
    })

    // Checking direct children suffices: >= is transitive, so each gap is >= every gap below it.
    it('gap is monotonic: every node gap >= its children gaps', () => {
        for (const points of [
            samplePoints,
            ...[1, 2, 3, 4, 5].map((s) => randomPoints(s, 80)),
        ]) {
            for (const c of allNodes(buildClusterTree(points))) {
                if (!isGroup(c)) continue
                if (isGroup(c.left))
                    expect(c.gap).toBeGreaterThanOrEqual(c.left.gap)
                if (isGroup(c.right))
                    expect(c.gap).toBeGreaterThanOrEqual(c.right.gap)
            }
        }
    })

    it('merges the earlier pair first on equal gaps', () => {
        const root = buildClusterTree([
            { id: 'a', t: 0 },
            { id: 'b', t: 10 },
            { id: 'c', t: 20 },
        ])
        expect(isGroup(root!) && root.left.id).toBe('a..b')
        expect(isGroup(root!) && root.right.id).toBe('c')
    })

    it('applies the tie-break deeper in the tree', () => {
        const shape = (c: Cluster): string =>
            isGroup(c) ? `(${shape(c.left)} ${shape(c.right)})` : c.id
        const equal = buildClusterTree(
            ['a', 'b', 'c', 'd'].map((id, i) => ({ id, t: i * 10 }))
        )
        expect(shape(equal!)).toBe('(((a b) c) d)')
        const mixed = buildClusterTree([
            { id: 'a', t: 0 },
            { id: 'b', t: 10 },
            { id: 'c', t: 15 },
            { id: 'd', t: 25 },
        ])
        expect(shape(mixed!)).toBe('((a (b c)) d)')
    })
})

describe('edge cases', () => {
    it('empty input returns null and cutTree(null) returns []', () => {
        expect(buildClusterTree([])).toBeNull()
        expect(cutTree(null, 100)).toEqual([])
    })

    it('duplicate ids throw', () => {
        expect(() =>
            buildClusterTree([
                { id: 'a', t: 0 },
                { id: 'a', t: 1 },
            ])
        ).toThrow(/duplicate/)
    })

    it('non-finite t and ids containing ".." throw', () => {
        expect(() => buildClusterTree([{ id: 'a', t: NaN }])).toThrow(
            /non-finite/
        )
        expect(() => buildClusterTree([{ id: 'a', t: Infinity }])).toThrow(
            /non-finite/
        )
        expect(() => buildClusterTree([{ id: 'a..b', t: 0 }])).toThrow(/\.\./)
    })

    it('two points with identical t work', () => {
        const root = buildClusterTree([
            { id: 'b', t: 100 },
            { id: 'a', t: 100 },
        ])
        expect(root).toMatchObject({
            kind: 'node',
            id: 'a..b',
            gap: 0,
            t: 100,
            tMin: 100,
            tMax: 100,
            count: 2,
        })
        expect(cutTree(root, 0).map((c) => c.id)).toEqual(['a', 'b'])
        expect(cutTree(root, 1).map((c) => c.id)).toEqual(['a..b'])
    })
})

describe('findCluster and minGapFromPx', () => {
    it('finds the containing cluster or undefined', () => {
        const root = buildClusterTree([
            { id: 'a', t: 0 },
            { id: 'b', t: 1 },
            { id: 'c', t: 100 },
        ])
        const cut = cutTree(root, 10)
        expect(findCluster(cut, 'b')?.id).toBe('a..b')
        expect(findCluster(cut, 'c')?.id).toBe('c')
        expect(findCluster(cut, 'x')).toBeUndefined()
    })

    it('converts pixels to ms', () => {
        expect(minGapFromPx(24, DAY)).toBe(24 * DAY)
        expect(minGapFromPx(0, DAY)).toBe(0)
    })
})
