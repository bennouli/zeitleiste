// Pure zoom/pan state for the timeline. Times are ms since epoch (UTC), widths are px.

import { easeOutCubic } from './easing'
import { MS_PER_DAY } from './time'

/** Zoom limits: how much time fits across the full width. Change here only. */
const MIN_VISIBLE_MS: number = 3 * 30.44 * MS_PER_DAY
const MAX_VISIBLE_MS: number = 300 * 365.2425 * MS_PER_DAY

/** Factor used by the zoom buttons. */
export const ZOOM_STEP_FACTOR: number = 2

/** Wheel delta that zooms by one button step (ZOOM_STEP_FACTOR); about three mouse-wheel notches. */
const WHEEL_PX_PER_ZOOM_STEP = 300
/** Beyond this many button steps any span has reached a zoom limit; keeps the wheel factor finite and non-zero. */
const MAX_WHEEL_ZOOM_STEPS = 32

/** A visible time range. Invariant: end > start. */
export type Viewport = {
    start: number
    end: number
}

/** The data range that can be shown: first entry start … today. */
export type Bounds = {
    min: number
    max: number
    /** Fraction of the visible span kept free after `max`, so a card anchored on today fits. Default 0. */
    endRoom?: number
}

type NormalBounds = Required<Bounds>

/** Tolerance for limit checks; floating-point error on ~1e13 ms spans is far below this. */
const LIMIT_EPSILON_MS = 1

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v))
}

function safeWidth(width: number): number {
    return Number.isFinite(width) && width > 0 ? width : 1
}

function finiteOr(v: number, fallback: number): number {
    return Number.isFinite(v) ? v : fallback
}

/** Invalid spans (NaN, 0) fall back to MIN; inverted spans use their magnitude. */
function clampSpan(span: number): number {
    if (Number.isNaN(span) || span === 0) return MIN_VISIBLE_MS
    return clamp(Math.abs(span), MIN_VISIBLE_MS, MAX_VISIBLE_MS)
}

/** Span for a zoom gesture: zooming out never goes beyond the bounds (or the current span, if already wider). */
function gestureSpan(
    current: number,
    factor: number,
    b: NormalBounds | null
): number {
    const span = clampSpan(current / factor)
    if (factor >= 1 || !b) return span
    return Math.min(span, Math.max(clampSpan(current), rangeSpan(b)))
}

/** Where a viewport of `span` may end: `max` plus the room after it. */
function limitEnd(b: NormalBounds, span: number): number {
    return b.max + span * b.endRoom
}

/** The span at which the whole range and its room fill the viewport. */
function rangeSpan(b: NormalBounds): number {
    return (b.max - b.min) / (1 - b.endRoom)
}

function centeredOn(center: number, span: number): Viewport {
    return { start: center - span / 2, end: center + span / 2 }
}

/** Returns ordered finite bounds with a room in [0, 1), or null if they are unusable. */
function normalizeBounds(bounds: Bounds): NormalBounds | null {
    const { min, max, endRoom = 0 } = bounds
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    const room =
        Number.isFinite(endRoom) && endRoom >= 0 && endRoom < 1 ? endRoom : 0
    return min <= max
        ? { min, max, endRoom: room }
        : { min: max, max: min, endRoom: room }
}

/** Span of the viewport; 0 for a non-finite viewport so NaN never propagates. */
function visibleMs(vp: Viewport): number {
    const span = vp.end - vp.start
    return Number.isFinite(span) ? span : 0
}

export function msPerPx(vp: Viewport, width: number): number {
    return visibleMs(vp) / safeWidth(width)
}

export function timeToX(vp: Viewport, width: number, t: number): number {
    const span = visibleMs(vp)
    if (!(span > 0) || !Number.isFinite(t) || !Number.isFinite(vp.start))
        return 0
    return ((t - vp.start) / span) * safeWidth(width)
}

function xToTime(vp: Viewport, width: number, x: number): number {
    return (
        finiteOr(vp.start, 0) +
        (finiteOr(x, 0) / safeWidth(width)) * visibleMs(vp)
    )
}

/** Clamp the span to [MIN_VISIBLE_MS, MAX_VISIBLE_MS] around its center, then shift it inside bounds (plus the room after max) without changing the span. If bounds are narrower than the span, center on them. */
export function clampViewport(vp: Viewport, bounds: Bounds): Viewport {
    const b = normalizeBounds(bounds)
    const span = clampSpan(vp.end - vp.start)
    const center = (vp.start + vp.end) / 2
    if (!b) return centeredOn(finiteOr(center, 0), span)
    const end = limitEnd(b, span)
    const boundsCenter = (b.min + end) / 2
    if (span >= end - b.min) return centeredOn(boundsCenter, span)
    const start = clamp(
        finiteOr(center, boundsCenter) - span / 2,
        b.min,
        end - span
    )
    return { start, end: start + span }
}

/** The whole range and its room, or as much of it as MAX_VISIBLE_MS allows, right-aligned so bounds.max (today) sits before the room. Ranges shorter than MIN_VISIBLE_MS are centered. */
export function initialViewport(bounds: Bounds): Viewport {
    const b = normalizeBounds(bounds)
    if (!b)
        return clampViewport(
            { start: -MIN_VISIBLE_MS / 2, end: MIN_VISIBLE_MS / 2 },
            bounds
        )
    const span = clampSpan(rangeSpan(b))
    const end = limitEnd(b, span)
    return clampViewport({ start: end - span, end }, b)
}

/** Zoom by `factor` (>1 zooms in) keeping the time under `anchorX` fixed, then clamp. */
export function zoomAround(
    vp: Viewport,
    width: number,
    anchorX: number,
    factor: number,
    bounds: Bounds
): Viewport {
    const f = Number.isFinite(factor) && factor > 0 ? factor : 1
    // Before layout (width <= 0) pixel anchors are meaningless: zoom around the center.
    const ratio =
        width > 0 && Number.isFinite(width) && Number.isFinite(anchorX)
            ? anchorX / width
            : 0.5
    const base = clampViewport(vp, bounds)
    const anchorT = base.start + ratio * visibleMs(base)
    const span = gestureSpan(visibleMs(base), f, normalizeBounds(bounds))
    const start = anchorT - ratio * span
    return clampViewport({ start, end: start + span }, bounds)
}

/** Stepless wheel zoom around `anchorX`: scrolling down (deltaPx > 0) zooms out, up zooms in. Same limits as the buttons. */
export function wheelZoom(
    vp: Viewport,
    width: number,
    anchorX: number,
    deltaPx: number,
    bounds: Bounds
): Viewport {
    const steps = clamp(
        -finiteOr(deltaPx, 0) / WHEEL_PX_PER_ZOOM_STEP,
        -MAX_WHEEL_ZOOM_STEPS,
        MAX_WHEEL_ZOOM_STEPS
    )
    return zoomAround(vp, width, anchorX, ZOOM_STEP_FACTOR ** steps, bounds)
}

/** Set the span to `spanMs` centered on `centerT`, then clamp. Used by "open post → 40 years centered on the entry". */
export function zoomTo(
    centerT: number,
    spanMs: number,
    bounds: Bounds
): Viewport {
    const span = clampSpan(spanMs)
    const b = normalizeBounds(bounds)
    const c = finiteOr(centerT, b ? (b.min + b.max) / 2 : 0)
    return clampViewport({ start: c - span / 2, end: c + span / 2 }, bounds)
}

/** Shift by dx px of pointer movement: dragging content to the right (dx > 0) shows earlier times. Clamped. */
export function panBy(
    vp: Viewport,
    width: number,
    dx: number,
    bounds: Bounds
): Viewport {
    const b = normalizeBounds(bounds)
    const rawShift = -finiteOr(dx, 0) * msPerPx(vp, width)
    const maxShift = b ? rangeSpan(b) + MAX_VISIBLE_MS : Infinity
    // Keep the arithmetic finite for absurd dx; anything beyond the bounds width is clamped anyway.
    const shift = clamp(rawShift, -maxShift, maxShift)
    return clampViewport(
        { start: vp.start + shift, end: vp.end + shift },
        bounds
    )
}

/** Two-finger pinch: previous and current x positions of the two pointers; the times under both fingers stay under them as far as limits allow. */
export function pinch(
    vp: Viewport,
    width: number,
    prev: readonly [number, number],
    next: readonly [number, number],
    bounds: Bounds
): Viewport {
    const [p0, p1] = prev
    const [n0, n1] = next
    if (!(width > 0) || ![width, p0, p1, n0, n1].every(Number.isFinite))
        return clampViewport(vp, bounds)
    const w = width
    const base = clampViewport(vp, bounds)
    const prevDist = Math.abs(p1 - p0)
    const nextDist = Math.abs(n1 - n0)
    // Fingers (nearly) on top of each other: no reliable scale, treat as a pan of the midpoint.
    const factor = prevDist < 1 || nextDist < 1 ? 1 : nextDist / prevDist
    const prevMid = (p0 + p1) / 2
    const nextMid = (n0 + n1) / 2
    const midT = xToTime(base, w, prevMid)
    const span = gestureSpan(visibleMs(base), factor, normalizeBounds(bounds))
    const start = midT - (nextMid / w) * span
    return clampViewport({ start, end: start + span }, bounds)
}

export function canZoomIn(vp: Viewport): boolean {
    return visibleMs(vp) > MIN_VISIBLE_MS + LIMIT_EPSILON_MS
}

/** False when the span already covers the bounds or reached MAX_VISIBLE_MS. */
export function canZoomOut(vp: Viewport, bounds: Bounds): boolean {
    const b = normalizeBounds(bounds)
    const limit = b ? Math.min(MAX_VISIBLE_MS, rangeSpan(b)) : MAX_VISIBLE_MS
    return visibleMs(vp) < limit - LIMIT_EPSILON_MS
}

/** Interpolate for animation. Span interpolates in log space so zooming looks uniform; center linearly. */
function interpolateViewport(
    from: Viewport,
    to: Viewport,
    progress: number
): Viewport {
    const p = Number.isFinite(progress) ? clamp(progress, 0, 1) : 1
    const fromOk = Number.isFinite(from.start) && Number.isFinite(from.end)
    const toOk = Number.isFinite(to.start) && Number.isFinite(to.end)
    if (!toOk)
        return fromOk
            ? { start: from.start, end: from.end }
            : { start: 0, end: MIN_VISIBLE_MS }
    if (p === 1 || !fromOk) return { start: to.start, end: to.end }
    if (p === 0) return { start: from.start, end: from.end }
    const s0 = Math.max(visibleMs(from), 1)
    const s1 = Math.max(visibleMs(to), 1)
    const span = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * p)
    const c0 = (from.start + from.end) / 2
    const c1 = (to.start + to.end) / 2
    const center = c0 + (c1 - c0) * p
    return { start: center - span / 2, end: center + span / 2 }
}

/** One frame of an eased animation from `from` to `to`; `done` once `elapsedMs` reaches `durationMs`. */
export function tweenViewport(
    from: Viewport,
    to: Viewport,
    elapsedMs: number,
    durationMs: number
): { vp: Viewport; done: boolean } {
    const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 1
    if (progress < 1)
        return {
            vp: interpolateViewport(from, to, easeOutCubic(progress)),
            done: false,
        }
    return { vp: to, done: true }
}

export function viewportEquals(
    a: Viewport,
    b: Viewport,
    epsilonMs = 1
): boolean {
    return (
        Math.abs(a.start - b.start) <= epsilonMs &&
        Math.abs(a.end - b.end) <= epsilonMs
    )
}

/** Momentum after a drag. Pure step; the component calls it per animation frame. */
export type Momentum = {
    vp: Viewport
    velocityPxPerMs: number
}

export type MomentumOptions = {
    /** Exponential decay rate per ms. Default 0.004. */
    frictionPerMs?: number
    /** Stop once |velocity| falls below this. Default 0.02 px/ms. */
    stopBelowPxPerMs?: number
}

export function stepMomentum(
    m: Momentum,
    dtMs: number,
    width: number,
    bounds: Bounds,
    options: MomentumOptions = {}
): { next: Momentum; done: boolean } {
    const k = Math.max(0, finiteOr(options.frictionPerMs ?? 0.004, 0.004))
    // A tiny floor guarantees termination even with stopBelowPxPerMs: 0.
    const stopBelow = Math.max(
        1e-6,
        finiteOr(options.stopBelowPxPerMs ?? 0.02, 0.02)
    )
    const v0 = finiteOr(m.velocityPxPerMs, 0)
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0
    if (Math.abs(v0) < stopBelow) {
        return { next: { vp: m.vp, velocityPxPerMs: 0 }, done: true }
    }
    // Exact integral of v0 * e^(-k t) over [0, dt].
    const dx = k > 0 ? (v0 * (1 - Math.exp(-k * dt))) / k : v0 * dt
    const v1 = v0 * Math.exp(-k * dt)
    const vp = panBy(m.vp, width, dx, bounds)
    const intended = -dx * msPerPx(m.vp, width)
    const actual = vp.start - m.vp.start
    const hitBounds = Math.abs(actual - intended) > 0.01 * msPerPx(m.vp, width)
    if (hitBounds || Math.abs(v1) < stopBelow) {
        return { next: { vp, velocityPxPerMs: 0 }, done: true }
    }
    return { next: { vp, velocityPxPerMs: v1 }, done: false }
}

/** Velocity estimate from recent pointer samples (x, timeMs), e.g. the last ~100 ms, in px/ms. Returns 0 for fewer than two samples. */
export function estimateVelocity(
    samples: readonly { x: number; t: number }[],
    windowMs = 100
): number {
    const valid = samples
        .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.t))
        .sort((a, b) => a.t - b.t)
    const last = valid[valid.length - 1]
    if (!last || valid.length < 2) return 0
    const recent = valid.filter((s) => s.t >= last.t - windowMs)
    const first = recent[0]
    if (!first || recent.length < 2) return 0
    const dt = last.t - first.t
    return dt > 0 ? (last.x - first.x) / dt : 0
}

export const PRIVATE_UNDER_TESTS = {
    MIN_VISIBLE_MS,
    WHEEL_PX_PER_ZOOM_STEP,
    MAX_VISIBLE_MS,
    visibleMs,
    xToTime,
    interpolateViewport,
}
