import { MS_PER_YEAR } from '@/lib/time'
import { describe, expect, it } from 'vitest'
import {
    PRIVATE_UNDER_TESTS,
    ZOOM_STEP_FACTOR,
    canZoomIn,
    canZoomOut,
    clampViewport,
    estimateVelocity,
    initialViewport,
    msPerPx,
    panBy,
    pinch,
    stepMomentum,
    timeToX,
    tweenViewport,
    viewportEquals,
    wheelZoom,
    zoomAround,
    zoomTo,
    type Bounds,
    type Momentum,
    type Viewport,
} from '../viewport'

const {
    MIN_VISIBLE_MS,
    MAX_VISIBLE_MS,
    WHEEL_PX_PER_ZOOM_STEP,
    visibleMs,
    xToTime,
    interpolateViewport,
} = PRIVATE_UNDER_TESTS

const SAMPLE: Bounds = { min: Date.UTC(1700, 0, 1), max: Date.UTC(2026, 8, 27) }
const WIDTH = 1000

function centerOf(vp: Viewport): number {
    return (vp.start + vp.end) / 2
}

describe('constants', () => {
    it('are ordered and positive', () => {
        expect(MIN_VISIBLE_MS).toBeGreaterThan(0)
        expect(MIN_VISIBLE_MS).toBeLessThan(MAX_VISIBLE_MS)
        expect(ZOOM_STEP_FACTOR).toBeGreaterThan(1)
    })
})

describe('initialViewport', () => {
    it('clamps a ~327-year range to MAX_VISIBLE_MS right-aligned at today', () => {
        expect(SAMPLE.max - SAMPLE.min).toBeGreaterThan(MAX_VISIBLE_MS)
        const vp = initialViewport(SAMPLE)
        expect(vp.end).toBe(SAMPLE.max)
        expect(visibleMs(vp)).toBeCloseTo(MAX_VISIBLE_MS, 0)
    })

    it('shows the whole range when it is between MIN and MAX', () => {
        const bounds = {
            min: SAMPLE.max - (MIN_VISIBLE_MS + MAX_VISIBLE_MS) / 2,
            max: SAMPLE.max,
        }
        const vp = initialViewport(bounds)
        expect(vp.start).toBeCloseTo(bounds.min, 0)
        expect(vp.end).toBe(bounds.max)
    })

    it('centers a range shorter than MIN_VISIBLE_MS on the bounds', () => {
        const bounds = { min: SAMPLE.max - MIN_VISIBLE_MS / 4, max: SAMPLE.max }
        const vp = initialViewport(bounds)
        expect(visibleMs(vp)).toBeCloseTo(MIN_VISIBLE_MS, 0)
        expect(centerOf(vp)).toBeCloseTo((bounds.min + bounds.max) / 2, 0)
    })
})

describe('end room', () => {
    const ROOM = 0.2
    const ROOMY: Bounds = { ...SAMPLE, endRoom: ROOM }
    const forty = 40 * MS_PER_YEAR

    it('initialViewport keeps the room after today', () => {
        const vp = initialViewport(ROOMY)
        expect(visibleMs(vp)).toBeCloseTo(MAX_VISIBLE_MS, 0)
        expect(vp.end - SAMPLE.max).toBeCloseTo(ROOM * visibleMs(vp), 0)
    })

    it('initialViewport shows the whole range and its room when they fit', () => {
        const range = (MAX_VISIBLE_MS / 2) * (1 - ROOM)
        const fitting: Bounds = {
            min: SAMPLE.max - range,
            max: SAMPLE.max,
            endRoom: ROOM,
        }
        const vp = initialViewport(fitting)
        expect(vp.start).toBeCloseTo(fitting.min, 0)
        expect(visibleMs(vp)).toBeCloseTo(MAX_VISIBLE_MS / 2, 0)
        expect(vp.end - SAMPLE.max).toBeCloseTo(ROOM * visibleMs(vp), 0)
    })

    it('panning to the end stops with the room after today', () => {
        const vp = zoomTo(Date.UTC(1900, 0, 1), forty, ROOMY)
        const atEnd = panBy(vp, WIDTH, -1e9, ROOMY)
        expect(atEnd.end - SAMPLE.max).toBeCloseTo(ROOM * forty, 0)
        expect(visibleMs(atEnd)).toBeCloseTo(forty, 0)
    })

    it('a focus zoom near today keeps the room', () => {
        const late = zoomTo(SAMPLE.max, forty, ROOMY)
        expect(late.end - SAMPLE.max).toBeCloseTo(ROOM * forty, 0)
    })

    it('zooming out stops once the range and its room fill the view', () => {
        const narrow: Bounds = {
            min: SAMPLE.max - MAX_VISIBLE_MS / 4,
            max: SAMPLE.max,
            endRoom: ROOM,
        }
        let cur = zoomTo(
            SAMPLE.max - MAX_VISIBLE_MS / 8,
            MIN_VISIBLE_MS,
            narrow
        )
        for (let i = 0; i < 100 && canZoomOut(cur, narrow); i++)
            cur = zoomAround(cur, WIDTH, 500, 1 / ZOOM_STEP_FACTOR, narrow)
        expect(visibleMs(cur)).toBeCloseTo(MAX_VISIBLE_MS / 4 / (1 - ROOM), 0)
        expect(cur.start).toBeCloseTo(narrow.min, 0)
        expect(canZoomOut(cur, narrow)).toBe(false)
    })

    it.each([Number.NaN, -0.5, 1, 2])('treats a room of %s as none', (room) => {
        const odd: Bounds = { ...SAMPLE, endRoom: room }
        expect(initialViewport(odd)).toEqual(initialViewport(SAMPLE))
    })
})

describe('coordinate mapping', () => {
    const vp = initialViewport(SAMPLE)

    it('round-trips time and x', () => {
        for (const x of [0, 1, 123.5, WIDTH / 2, WIDTH]) {
            expect(timeToX(vp, WIDTH, xToTime(vp, WIDTH, x))).toBeCloseTo(x, 6)
        }
        const t = Date.UTC(1917, 10, 7)
        expect(
            Math.abs(xToTime(vp, WIDTH, timeToX(vp, WIDTH, t)) - t)
        ).toBeLessThan(1)
    })

    it('maps start to 0 and end to width', () => {
        expect(timeToX(vp, WIDTH, vp.start)).toBe(0)
        expect(timeToX(vp, WIDTH, vp.end)).toBeCloseTo(WIDTH, 9)
    })

    it('msPerPx is span / width', () => {
        expect(msPerPx(vp, WIDTH)).toBeCloseTo(visibleMs(vp) / WIDTH, 3)
    })

    it('never returns NaN for degenerate width', () => {
        for (const w of [0, -10, Number.NaN]) {
            expect(Number.isFinite(msPerPx(vp, w))).toBe(true)
            expect(Number.isFinite(timeToX(vp, w, SAMPLE.min))).toBe(true)
            expect(Number.isFinite(xToTime(vp, w, 5))).toBe(true)
        }
    })
})

describe('clampViewport', () => {
    it('clamps span into [MIN, MAX] around the center', () => {
        const c = Date.UTC(1900, 0, 1)
        const tiny = clampViewport({ start: c - 1000, end: c + 1000 }, SAMPLE)
        expect(visibleMs(tiny)).toBeCloseTo(MIN_VISIBLE_MS, 0)
        expect(centerOf(tiny)).toBeCloseTo(c, 0)
    })

    it('shifts inside bounds without changing the span', () => {
        const span = 10 * MS_PER_YEAR
        const vp = clampViewport(
            { start: SAMPLE.max - span / 2, end: SAMPLE.max + span / 2 },
            SAMPLE
        )
        expect(vp.end).toBeCloseTo(SAMPLE.max, 0)
        expect(visibleMs(vp)).toBeCloseTo(span, 0)
    })

    it('repairs NaN input', () => {
        const vp = clampViewport({ start: Number.NaN, end: Number.NaN }, SAMPLE)
        expect(Number.isFinite(vp.start) && Number.isFinite(vp.end)).toBe(true)
        expect(vp.end).toBeGreaterThan(vp.start)
    })
})

describe('zoomAround', () => {
    const vp = initialViewport(SAMPLE)

    it('keeps the anchored time under the anchor', () => {
        const anchorX = 700
        const t = xToTime(vp, WIDTH, anchorX)
        const zoomed = zoomAround(vp, WIDTH, anchorX, ZOOM_STEP_FACTOR, SAMPLE)
        expect(visibleMs(zoomed)).toBeCloseTo(
            visibleMs(vp) / ZOOM_STEP_FACTOR,
            0
        )
        expect(Math.abs(xToTime(zoomed, WIDTH, anchorX) - t)).toBeLessThan(1)
    })

    it('stops at MIN_VISIBLE_MS and canZoomIn flips', () => {
        let cur = vp
        for (let i = 0; i < 100 && canZoomIn(cur); i++)
            cur = zoomAround(cur, WIDTH, 500, ZOOM_STEP_FACTOR, SAMPLE)
        expect(visibleMs(cur)).toBeCloseTo(MIN_VISIBLE_MS, 0)
        expect(canZoomIn(cur)).toBe(false)
        expect(canZoomOut(cur, SAMPLE)).toBe(true)
    })

    it('stops at MAX_VISIBLE_MS and canZoomOut flips', () => {
        const wide = { min: SAMPLE.max - 3 * MAX_VISIBLE_MS, max: SAMPLE.max }
        let cur = zoomTo(
            SAMPLE.max - 1.5 * MAX_VISIBLE_MS,
            MIN_VISIBLE_MS,
            wide
        )
        for (let i = 0; i < 100 && canZoomOut(cur, wide); i++)
            cur = zoomAround(cur, WIDTH, 200, 1 / ZOOM_STEP_FACTOR, wide)
        expect(visibleMs(cur)).toBeCloseTo(MAX_VISIBLE_MS, 0)
        expect(canZoomOut(cur, wide)).toBe(false)
        expect(canZoomIn(cur)).toBe(true)
    })

    it('canZoomOut is false when the span already covers narrower bounds', () => {
        const bounds = {
            min: SAMPLE.max - Math.sqrt(MIN_VISIBLE_MS * MAX_VISIBLE_MS),
            max: SAMPLE.max,
        }
        const vp50 = initialViewport(bounds)
        expect(canZoomOut(vp50, bounds)).toBe(false)
        const out = zoomAround(vp50, WIDTH, 500, 1 / ZOOM_STEP_FACTOR, bounds)
        expect(viewportEquals(out, vp50)).toBe(true)
        const pinched = pinch(vp50, WIDTH, [300, 700], [450, 550], bounds)
        expect(viewportEquals(pinched, vp50)).toBe(true)
    })

    it('keeps the anchor when the zoom hits MIN_VISIBLE_MS', () => {
        const near = zoomTo(Date.UTC(1900, 0, 1), MIN_VISIBLE_MS * 1.5, SAMPLE)
        const t = xToTime(near, WIDTH, 300)
        const out = zoomAround(near, WIDTH, 300, 1000, SAMPLE)
        expect(visibleMs(out)).toBeCloseTo(MIN_VISIBLE_MS, 0)
        expect(Math.abs(xToTime(out, WIDTH, 300) - t)).toBeLessThan(1)
    })

    it('zooms around the center when width is not measured yet', () => {
        const near = zoomTo(Date.UTC(1900, 0, 1), visibleMs(vp) / 4, SAMPLE)
        for (const w of [0, -5, Number.NaN]) {
            const out = zoomAround(near, w, 500, ZOOM_STEP_FACTOR, SAMPLE)
            expect(centerOf(out)).toBeCloseTo(centerOf(near), 0)
        }
    })

    it('clamps into bounds when zooming near the edge', () => {
        const zoomedIn = zoomTo(
            SAMPLE.max - MS_PER_YEAR,
            10 * MS_PER_YEAR,
            SAMPLE
        )
        const out = zoomAround(
            zoomedIn,
            WIDTH,
            WIDTH,
            1 / ZOOM_STEP_FACTOR,
            SAMPLE
        )
        expect(out.end).toBeLessThanOrEqual(SAMPLE.max + 1)
        expect(out.start).toBeGreaterThanOrEqual(SAMPLE.min - 1)
    })

    it('ignores invalid factors', () => {
        expect(
            viewportEquals(zoomAround(vp, WIDTH, 500, Number.NaN, SAMPLE), vp)
        ).toBe(true)
        expect(viewportEquals(zoomAround(vp, WIDTH, 500, 0, SAMPLE), vp)).toBe(
            true
        )
    })
})

describe('wheelZoom', () => {
    const vp = zoomTo(Date.UTC(1900, 0, 1), 50 * MS_PER_YEAR, SAMPLE)
    const anchorX = 300

    it('keeps the time under the pointer fixed', () => {
        const t = xToTime(vp, WIDTH, anchorX)
        const zoomedIn = wheelZoom(vp, WIDTH, anchorX, -120, SAMPLE)
        expect(visibleMs(zoomedIn)).toBeLessThan(visibleMs(vp))
        expect(Math.abs(xToTime(zoomedIn, WIDTH, anchorX) - t)).toBeLessThan(1)
    })

    it('zooms in on a negative delta and out on a positive one', () => {
        const zoomedIn = wheelZoom(vp, WIDTH, anchorX, -50, SAMPLE)
        const zoomedOut = wheelZoom(vp, WIDTH, anchorX, 50, SAMPLE)
        expect(visibleMs(zoomedIn)).toBeLessThan(visibleMs(vp))
        expect(visibleMs(zoomedOut)).toBeGreaterThan(visibleMs(vp))
    })

    it('is stepless: WHEEL_PX_PER_ZOOM_STEP px make one button step, half of it the square root', () => {
        const oneStep = wheelZoom(
            vp,
            WIDTH,
            anchorX,
            -WHEEL_PX_PER_ZOOM_STEP,
            SAMPLE
        )
        const halfStep = wheelZoom(
            vp,
            WIDTH,
            anchorX,
            -WHEEL_PX_PER_ZOOM_STEP / 2,
            SAMPLE
        )
        expect(visibleMs(oneStep)).toBeCloseTo(
            visibleMs(vp) / ZOOM_STEP_FACTOR,
            0
        )
        expect(visibleMs(halfStep)).toBeCloseTo(
            visibleMs(vp) / Math.sqrt(ZOOM_STEP_FACTOR),
            0
        )
    })

    it('returns to the start after an equal delta back', () => {
        const zoomedIn = wheelZoom(vp, WIDTH, anchorX, -80, SAMPLE)
        const zoomedBack = wheelZoom(zoomedIn, WIDTH, anchorX, 80, SAMPLE)
        expect(viewportEquals(zoomedBack, vp, 1000)).toBe(true)
    })

    it('stops at the button limits', () => {
        const hugeDeltaPx = 1e9
        const fullyIn = wheelZoom(vp, WIDTH, anchorX, -hugeDeltaPx, SAMPLE)
        const fullyOut = wheelZoom(vp, WIDTH, anchorX, hugeDeltaPx, SAMPLE)
        expect(visibleMs(fullyIn)).toBeCloseTo(MIN_VISIBLE_MS, 0)
        expect(canZoomIn(fullyIn)).toBe(false)
        expect(canZoomOut(fullyOut, SAMPLE)).toBe(false)
    })

    it('ignores a non-finite delta', () => {
        const unchangedVp = wheelZoom(vp, WIDTH, anchorX, Number.NaN, SAMPLE)
        expect(viewportEquals(unchangedVp, vp)).toBe(true)
    })
})

describe('zoomTo', () => {
    const forty = 40 * MS_PER_YEAR

    it('centers exactly away from the edges', () => {
        const c = Date.UTC(1900, 5, 1)
        const vp = zoomTo(c, forty, SAMPLE)
        expect(centerOf(vp)).toBeCloseTo(c, 0)
        expect(visibleMs(vp)).toBeCloseTo(forty, 0)
    })

    it('shifts near the edges', () => {
        const late = zoomTo(SAMPLE.max - MS_PER_YEAR, forty, SAMPLE)
        expect(late.end).toBeCloseTo(SAMPLE.max, 0)
        expect(visibleMs(late)).toBeCloseTo(forty, 0)
        const early = zoomTo(SAMPLE.min + MS_PER_YEAR, forty, SAMPLE)
        expect(early.start).toBeCloseTo(SAMPLE.min, 0)
    })

    it('clamps the span to the limits', () => {
        expect(visibleMs(zoomTo(Date.UTC(1900, 0, 1), 1, SAMPLE))).toBeCloseTo(
            MIN_VISIBLE_MS,
            0
        )
        expect(
            visibleMs(zoomTo(Date.UTC(1900, 0, 1), MAX_VISIBLE_MS * 10, SAMPLE))
        ).toBeCloseTo(MAX_VISIBLE_MS, 0)
    })
})

describe('panBy', () => {
    const vp = zoomTo(Date.UTC(1900, 0, 1), 40 * MS_PER_YEAR, SAMPLE)

    it('dragging right shows earlier times', () => {
        const moved = panBy(vp, WIDTH, 100, SAMPLE)
        expect(moved.start).toBeLessThan(vp.start)
        expect(vp.start - moved.start).toBeCloseTo(100 * msPerPx(vp, WIDTH), 0)
        expect(visibleMs(moved)).toBeCloseTo(visibleMs(vp), 0)
    })

    it('dragging left shows later times', () => {
        expect(panBy(vp, WIDTH, -100, SAMPLE).start).toBeGreaterThan(vp.start)
    })

    it('clamps at both ends', () => {
        expect(panBy(vp, WIDTH, 1e9, SAMPLE).start).toBeCloseTo(SAMPLE.min, 0)
        expect(panBy(vp, WIDTH, -1e9, SAMPLE).end).toBeCloseTo(SAMPLE.max, 0)
    })

    it('keeps the span for absurd or invalid dx', () => {
        expect(visibleMs(panBy(vp, WIDTH, 1e300, SAMPLE))).toBeCloseTo(
            visibleMs(vp),
            0
        )
        expect(viewportEquals(panBy(vp, WIDTH, Number.NaN, SAMPLE), vp)).toBe(
            true
        )
    })
})

describe('pinch', () => {
    const vp = zoomTo(Date.UTC(1900, 0, 1), 40 * MS_PER_YEAR, SAMPLE)

    it('keeps the times under both fingers when unconstrained', () => {
        const prev = [400, 600] as const
        const next = [350, 700] as const
        const ta = xToTime(vp, WIDTH, prev[0])
        const tb = xToTime(vp, WIDTH, prev[1])
        const out = pinch(vp, WIDTH, prev, next, SAMPLE)
        expect(Math.abs(xToTime(out, WIDTH, next[0]) - ta)).toBeLessThan(1)
        expect(Math.abs(xToTime(out, WIDTH, next[1]) - tb)).toBeLessThan(1)
    })

    it('spreading zooms in, closing zooms out', () => {
        expect(
            visibleMs(pinch(vp, WIDTH, [400, 600], [300, 700], SAMPLE))
        ).toBeLessThan(visibleMs(vp))
        expect(
            visibleMs(pinch(vp, WIDTH, [300, 700], [400, 600], SAMPLE))
        ).toBeGreaterThan(visibleMs(vp))
    })

    it('respects the limits', () => {
        const tight = pinch(vp, WIDTH, [499, 501], [0, WIDTH], SAMPLE)
        expect(visibleMs(tight)).toBeCloseTo(MIN_VISIBLE_MS, 0)
    })

    it('treats coincident fingers as a pan', () => {
        const out = pinch(vp, WIDTH, [500, 500], [600, 600], SAMPLE)
        expect(visibleMs(out)).toBeCloseTo(visibleMs(vp), 0)
        expect(out.start).toBeLessThan(vp.start)
    })
})

describe('degenerate input', () => {
    const vp = zoomTo(Date.UTC(1900, 0, 1), 40 * MS_PER_YEAR, SAMPLE)
    const bad: Viewport = { start: Number.NaN, end: Number.NaN }
    const finite = (v: Viewport) =>
        Number.isFinite(v.start) && Number.isFinite(v.end) && v.end > v.start

    it('never returns NaN', () => {
        expect(finite(zoomTo(Number.NaN, Number.NaN, SAMPLE))).toBe(true)
        expect(finite(zoomAround(bad, WIDTH, 100, 2, SAMPLE))).toBe(true)
        expect(finite(panBy(bad, WIDTH, 10, SAMPLE))).toBe(true)
        expect(finite(pinch(vp, WIDTH, [Number.NaN, 1], [2, 3], SAMPLE))).toBe(
            true
        )
        expect(finite(interpolateViewport(bad, vp, 0.5))).toBe(true)
        expect(finite(interpolateViewport(vp, bad, 0.5))).toBe(true)
        expect(
            Number.isFinite(timeToX({ start: -Infinity, end: 0 }, WIDTH, 5))
        ).toBe(true)
        expect(Number.isFinite(xToTime(bad, WIDTH, 5))).toBe(true)
        expect(Number.isFinite(msPerPx(bad, WIDTH))).toBe(true)
    })

    it('handles inverted and empty bounds', () => {
        const inverted = clampViewport(vp, { min: SAMPLE.max, max: SAMPLE.min })
        expect(viewportEquals(inverted, vp)).toBe(true)
        const point = initialViewport({ min: SAMPLE.max, max: SAMPLE.max })
        expect(visibleMs(point)).toBeCloseTo(MIN_VISIBLE_MS, 0)
        expect(centerOf(point)).toBeCloseTo(SAMPLE.max, 0)
    })

    it('without usable bounds keeps the span around the center, and 0 for a NaN center', () => {
        const unusable: Bounds = { min: Number.NaN, max: Number.NaN }
        expect(clampViewport(vp, unusable)).toEqual(vp)
        expect(centerOf(clampViewport(bad, unusable))).toBe(0)
        const shifted = panBy(vp, WIDTH, -WIDTH, unusable)
        expect(shifted.start - vp.start).toBeCloseTo(visibleMs(vp), 0)
    })

    it('uses the magnitude of an inverted viewport span', () => {
        const out = clampViewport({ start: vp.end, end: vp.start }, SAMPLE)
        expect(visibleMs(out)).toBeCloseTo(visibleMs(vp), 0)
    })

    it('viewportEquals honours a custom epsilon', () => {
        const shifted = { start: vp.start + 5, end: vp.end + 5 }
        expect(viewportEquals(vp, shifted)).toBe(false)
        expect(viewportEquals(vp, shifted, 10)).toBe(true)
    })
})

describe('interpolateViewport', () => {
    const from = zoomTo(Date.UTC(1800, 0, 1), MAX_VISIBLE_MS / 2, SAMPLE)
    const to = zoomTo(Date.UTC(1950, 0, 1), MIN_VISIBLE_MS * 4, SAMPLE)

    it('returns the endpoints', () => {
        expect(interpolateViewport(from, to, 0)).toEqual(from)
        expect(interpolateViewport(from, to, 1)).toEqual(to)
    })

    it('midpoint span is the geometric mean and center is linear', () => {
        const mid = interpolateViewport(from, to, 0.5)
        const expected = Math.sqrt(visibleMs(from) * visibleMs(to))
        expect(visibleMs(mid) / expected).toBeCloseTo(1, 9)
        expect(centerOf(mid)).toBeCloseTo(
            (centerOf(from) + centerOf(to)) / 2,
            0
        )
    })
})

describe('tweenViewport', () => {
    const from = zoomTo(Date.UTC(1800, 0, 1), MAX_VISIBLE_MS / 2, SAMPLE)
    const to = zoomTo(Date.UTC(1950, 0, 1), MIN_VISIBLE_MS * 4, SAMPLE)
    const DURATION_MS = 300

    it('starts at `from` and is not done', () => {
        expect(tweenViewport(from, to, 0, DURATION_MS)).toEqual({
            vp: from,
            done: false,
        })
    })

    it('eases out: at half the duration it is past the linear midpoint', () => {
        const halfway = tweenViewport(from, to, DURATION_MS / 2, DURATION_MS)
        const linearMidpoint = interpolateViewport(from, to, 0.5)
        expect(halfway.done).toBe(false)
        expect(visibleMs(halfway.vp)).toBeLessThan(visibleMs(linearMidpoint))
        expect(visibleMs(halfway.vp)).toBeGreaterThan(visibleMs(to))
        expect(centerOf(halfway.vp)).toBeGreaterThan(centerOf(linearMidpoint))
        expect(centerOf(halfway.vp)).toBeLessThan(centerOf(to))
    })

    it('ends exactly at `to` once the duration has elapsed', () => {
        expect(tweenViewport(from, to, DURATION_MS, DURATION_MS)).toEqual({
            vp: to,
            done: true,
        })
        expect(tweenViewport(from, to, DURATION_MS * 2, DURATION_MS)).toEqual({
            vp: to,
            done: true,
        })
    })

    it('is done immediately for a non-positive duration', () => {
        expect(tweenViewport(from, to, 0, 0)).toEqual({ vp: to, done: true })
    })
})

describe('stepMomentum', () => {
    const vp = zoomTo(Date.UTC(1900, 0, 1), 40 * MS_PER_YEAR, SAMPLE)

    it('decays and eventually finishes', () => {
        let m: Momentum = { vp, velocityPxPerMs: 1 }
        const first = stepMomentum(m, 16, WIDTH, SAMPLE)
        expect(first.done).toBe(false)
        expect(first.next.velocityPxPerMs).toBeLessThan(1)
        expect(first.next.vp.start).toBeLessThan(vp.start)
        let done = false
        let steps = 0
        while (!done && steps < 1000) {
            const r = stepMomentum(m, 16, WIDTH, SAMPLE)
            m = r.next
            done = r.done
            steps++
        }
        expect(done).toBe(true)
        expect(m.velocityPxPerMs).toBe(0)
    })

    it('stops at the bounds', () => {
        const atEnd = zoomTo(SAMPLE.max, 40 * MS_PER_YEAR, SAMPLE)
        const r = stepMomentum(
            { vp: atEnd, velocityPxPerMs: -5 },
            16,
            WIDTH,
            SAMPLE
        )
        expect(r.done).toBe(true)
        expect(r.next.velocityPxPerMs).toBe(0)
        expect(r.next.vp.end).toBeCloseTo(SAMPLE.max, 0)
    })

    it('stops when a partial move reaches the left bound', () => {
        const nearStart = zoomTo(
            SAMPLE.min + MS_PER_YEAR,
            40 * MS_PER_YEAR,
            SAMPLE
        )
        const shifted = panBy(nearStart, WIDTH, -50, SAMPLE)
        const r = stepMomentum(
            { vp: shifted, velocityPxPerMs: 10 },
            16,
            WIDTH,
            SAMPLE
        )
        expect(r.done).toBe(true)
        expect(r.next.velocityPxPerMs).toBe(0)
        expect(r.next.vp.start).toBeCloseTo(SAMPLE.min, 0)
    })

    it('terminates with stopBelowPxPerMs 0 and survives NaN input', () => {
        let m: Momentum = { vp, velocityPxPerMs: 0.5 }
        let done = false
        for (let i = 0; i < 20000 && !done; i++) {
            const r = stepMomentum(m, 16, WIDTH, SAMPLE, {
                stopBelowPxPerMs: 0,
            })
            m = r.next
            done = r.done
        }
        expect(done).toBe(true)
        const nan = stepMomentum(
            { vp, velocityPxPerMs: Number.NaN },
            Number.NaN,
            WIDTH,
            SAMPLE
        )
        expect(nan.done).toBe(true)
        expect(nan.next.vp).toEqual(vp)
    })

    it('is done immediately for zero velocity', () => {
        const r = stepMomentum({ vp, velocityPxPerMs: 0 }, 16, WIDTH, SAMPLE)
        expect(r.done).toBe(true)
        expect(r.next.vp).toEqual(vp)
    })
})

describe('estimateVelocity', () => {
    it('returns 0 for fewer than two samples', () => {
        expect(estimateVelocity([])).toBe(0)
        expect(estimateVelocity([{ x: 10, t: 0 }])).toBe(0)
    })

    it('computes px/ms from synthetic samples', () => {
        const samples = [0, 16, 32, 48, 64].map((t) => ({
            x: 100 + 0.5 * t,
            t,
        }))
        expect(estimateVelocity(samples)).toBeCloseTo(0.5, 9)
    })

    it('handles unsorted input, duplicate timestamps and NaN samples', () => {
        expect(
            estimateVelocity([
                { x: 20, t: 10 },
                { x: 0, t: 0 },
                { x: Number.NaN, t: 5 },
            ])
        ).toBeCloseTo(2, 9)
        expect(
            estimateVelocity([
                { x: 0, t: 5 },
                { x: 10, t: 5 },
            ])
        ).toBe(0)
    })

    it('ignores samples older than the window', () => {
        const samples = [
            { x: 0, t: 0 },
            { x: 1000, t: 500 },
            { x: 1100, t: 550 },
            { x: 1200, t: 600 },
        ]
        expect(estimateVelocity(samples, 100)).toBeCloseTo(2, 9)
    })
})
