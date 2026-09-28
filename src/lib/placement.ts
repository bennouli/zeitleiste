import { compareIds } from '@/lib/order'

export type Side = 'above' | 'below'

export type Slot = {
    side: Side
    /** 0 = nearest the axis */
    level: number
}

export type PlaceableItem = {
    id: string
    /** Horizontal extent of the card in px (already includes the card's width, i.e. x1 ≥ x0 + cardWidth). */
    x0: number
    x1: number
    /** Higher gets placed first and therefore its preferred slot. */
    importance: number
    /** Ordering tiebreak, e.g. the anchor time; lower first. */
    order: number
}

export type PlacementOptions = {
    /** Minimum horizontal gap between two cards in the same row, default 8. */
    gapPx?: number
    /** Rows per side, default 2 (so 4 rows total). */
    maxLevels?: number
    /** Intervals already taken before any item is placed, e.g. the rows a group stack covers. */
    blocked?: readonly BlockedInterval[]
}

export type BlockedInterval = Slot & {
    x0: number
    x1: number
}

export type Placement = {
    slots: Map<string, Slot>
    /** Items that fit nowhere; the caller groups them. */
    overflow: string[]
}

export const DEFAULT_GAP_PX = 8
export const DEFAULT_MAX_LEVELS = 2
const MAX_LEVELS_CAP = 64

/**
 * One row: disjoint intervals sorted by x0. Because they never overlap,
 * they are sorted by x1 as well, which makes the binary search valid.
 */
class Row {
    private readonly starts: number[] = []
    private readonly ends: number[] = []
    private readonly gap: number

    constructor(gap: number) {
        this.gap = gap
    }

    /** Index of the first interval whose end + gap > x0. */
    private firstReaching(x0: number): number {
        let lo = 0
        let hi = this.ends.length
        while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (this.ends[mid]! + this.gap > x0) hi = mid
            else lo = mid + 1
        }
        return lo
    }

    /** Free when every interval is at least `gap` away; touching at exactly `gap` is allowed. */
    isFree(x0: number, x1: number): boolean {
        const i = this.firstReaching(x0)
        const start = this.starts[i]
        return start === undefined || start >= x1 + this.gap
    }

    /** Caller must have checked isFree. */
    insert(x0: number, x1: number): void {
        const i = this.firstReaching(x0)
        this.starts.splice(i, 0, x0)
        this.ends.splice(i, 0, x1)
    }

    /** Reserve [x0, x1], merging with anything it touches so the row stays disjoint. */
    block(x0: number, x1: number): void {
        const i = this.firstReaching(x0)
        let j = i
        while (j < this.starts.length && this.starts[j]! < x1 + this.gap) {
            x0 = Math.min(x0, this.starts[j]!)
            x1 = Math.max(x1, this.ends[j]!)
            j++
        }
        this.starts.splice(i, j - i, x0)
        this.ends.splice(i, j - i, x1)
    }
}

function compareItems(a: PlaceableItem, b: PlaceableItem): number {
    if (a.importance !== b.importance) return b.importance - a.importance
    if (a.order !== b.order) return a.order - b.order
    return compareIds(a.id, b.id)
}

/** Try order: above 0, below 0, above 1, below 1, … */
function candidateSlots(maxLevels: number): Slot[] {
    return Array.from({ length: maxLevels }, (_, level): Slot[] => [
        { side: 'above', level },
        { side: 'below', level },
    ]).flat()
}

/** Hysteresis: every row on the previous side first (nearest the axis first), then the other side. */
function candidateSlotsKeepingSide(maxLevels: number, side: Side): Slot[] {
    const other: Side = side === 'above' ? 'below' : 'above'
    return [side, other].flatMap((s) =>
        Array.from({ length: maxLevels }, (_, level): Slot => ({
            side: s,
            level,
        }))
    )
}

function buildRows(
    maxLevels: number,
    gap: number,
    blocked: readonly BlockedInterval[]
): Record<Side, Row[]> {
    const rows: Record<Side, Row[]> = {
        above: Array.from({ length: maxLevels }, () => new Row(gap)),
        below: Array.from({ length: maxLevels }, () => new Row(gap)),
    }
    for (const b of blocked) {
        const x0 = Math.min(b.x0, b.x1)
        const x1 = Math.max(b.x0, b.x1)
        if (Number.isFinite(x0) && Number.isFinite(x1))
            rows[b.side]?.[b.level]?.block(x0, x1)
    }
    return rows
}

function cloneSlot(slot: Slot): Slot {
    return { side: slot.side, level: slot.level }
}

/**
 * `previous` slots are kept when the item still fits there (hysteresis); if not, the item
 * first tries the other rows on its previous side before changing sides.
 */
export function placeItems(
    items: readonly PlaceableItem[],
    previous: ReadonlyMap<string, Slot> | null,
    options: PlacementOptions = {}
): Placement {
    const gap = Math.max(0, options.gapPx ?? DEFAULT_GAP_PX)
    const maxLevels = Math.min(
        MAX_LEVELS_CAP,
        Math.max(0, Math.floor(options.maxLevels ?? DEFAULT_MAX_LEVELS))
    )
    const rows = buildRows(maxLevels, gap, options.blocked ?? [])
    const candidates = candidateSlots(maxLevels)

    const slots = new Map<string, Slot>()
    const overflow: string[] = []
    const seen = new Set<string>()

    for (const item of [...items].sort(compareItems)) {
        const x0 = Math.min(item.x0, item.x1)
        const x1 = Math.max(item.x0, item.x1)
        // Duplicate ids and non-finite extents cannot be placed safely.
        if (seen.has(item.id) || !Number.isFinite(x0) || !Number.isFinite(x1)) {
            overflow.push(item.id)
            continue
        }
        seen.add(item.id)

        const fits = (slot: Slot) =>
            rows[slot.side]?.[slot.level]?.isFree(x0, x1) ?? false
        const prev = previous?.get(item.id)
        const keepPrev = prev !== undefined && fits(prev)
        const found = keepPrev
            ? prev
            : (prev && rows[prev.side]
                  ? candidateSlotsKeepingSide(maxLevels, prev.side)
                  : candidates
              ).find(fits)
        const slot = found && cloneSlot(found)

        const row = slot && rows[slot.side][slot.level]
        if (slot && row) {
            row.insert(x0, x1)
            slots.set(item.id, slot)
        } else {
            overflow.push(item.id)
        }
    }

    return { slots, overflow }
}

/** Number of rows actually used per side, for computing the band height. */
function usedLevels(p: Placement): { above: number; below: number } {
    const used = { above: 0, below: 0 }
    for (const slot of p.slots.values()) {
        used[slot.side] = Math.max(used[slot.side], slot.level + 1)
    }
    return used
}

export const PRIVATE_UNDER_TESTS = {
    usedLevels,
    candidateSlots,
    candidateSlotsKeepingSide,
    buildRows,
}
