import { estimateVelocity, finiteOr } from './viewport'

/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 6

export type PointerSample = {
    id: number
    /** Relative to the container. */
    x: number
    y: number
    type: string
    isPrimary: boolean
    buttons: number
    t: number
}

type GestureMode = 'idle' | 'press' | 'drag' | 'pinch'

type TrackedPointer = { x: number; type: string }

type VelocitySample = { x: number; t: number }

type PinchPair = readonly [number, number]

export type GestureState = {
    mode: GestureMode
    pointers: ReadonlyMap<number, TrackedPointer>
    startX: number
    startY: number
    lastX: number
    samples: readonly VelocitySample[]
    /** The last press became a drag or pinch; cleared on the next press. */
    dragged: boolean
}

export type GestureEffect =
    | { type: 'beginGesture' }
    | { type: 'endGesture' }
    | { type: 'cancelAnimation' }
    | { type: 'panBy'; dx: number }
    | { type: 'pinch'; prev: PinchPair; next: PinchPair }
    | { type: 'startMomentum'; velocity: number }
    | { type: 'capture'; id: number }
    | { type: 'release'; id: number }
    | { type: 'clearDragAfterClick' }

export type GestureTransition = {
    state: GestureState
    effects: readonly GestureEffect[]
}

const MAX_VELOCITY_SAMPLES = 20

const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2
/** px per line-mode wheel unit. */
const WHEEL_LINE_PX = 16

export const initialGestureState: GestureState = {
    mode: 'idle',
    pointers: new Map(),
    startX: 0,
    startY: 0,
    lastX: 0,
    samples: [],
    dragged: false,
}

export function pointerDown(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    const withoutStalePress = dropStalePress(state, sample)
    if (withoutStalePress.state.pointers.size === 0)
        return withEffectsBefore(
            withoutStalePress.effects,
            beginPress(withoutStalePress.state, sample)
        )
    if (startsPinch(withoutStalePress.state, sample))
        return beginPinch(withoutStalePress.state, sample)
    return withoutStalePress
}

export function pointerMove(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    if (!state.pointers.has(sample.id) || state.mode === 'idle')
        return unchanged(state)
    if (isReleasedMouse(sample)) return pointerEnd(state, sample, true)
    const movedState: GestureState = {
        ...state,
        pointers: withPointerX(state.pointers, sample.id, sample.x),
    }
    if (state.mode === 'pinch') return pinchMove(state, movedState)
    if (state.mode === 'drag') return dragMove(movedState, sample)
    if (axisLockedToPage(state, sample))
        return unchanged({ ...movedState, mode: 'idle' })
    if (Math.abs(sample.x - state.startX) < DRAG_THRESHOLD_PX)
        return unchanged(movedState)
    return beginDrag(movedState, sample)
}

export function pointerEnd(
    state: GestureState,
    sample: PointerSample,
    cancelled: boolean
): GestureTransition {
    if (!state.pointers.has(sample.id)) return unchanged(state)
    const activePointers = new Map(state.pointers)
    activePointers.delete(sample.id)
    return withEffectsBefore(
        [{ type: 'release', id: sample.id }],
        state.mode === 'pinch'
            ? endPinch({ ...state, pointers: activePointers }, sample)
            : endDrag({ ...state, pointers: activePointers }, sample, cancelled)
    )
}

export function clearDrag(state: GestureState): GestureState {
    return state.pointers.size === 0 ? { ...state, dragged: false } : state
}

export function isGrabbing(state: GestureState): boolean {
    return state.mode === 'drag' || state.mode === 'pinch'
}

/** The deltas and modifiers of a wheel event; a DOM `WheelEvent` is one. */
export type WheelSample = {
    deltaX: number
    deltaY: number
    /** Unit of the deltas, as `WheelEvent.deltaMode`: pixels, lines or pages. */
    deltaMode: number
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
}

/** What a wheel event does to the timeline; px, `contentShiftPx` as `panBy` takes it. */
export type WheelIntent =
    | { type: 'browser' }
    | { type: 'pan'; contentShiftPx: number }
    | { type: 'zoom'; deltaPx: number }

/**
 * Ctrl/Cmd + wheel stays with the browser. Shift + wheel and a mostly
 * horizontal delta pan by the dominant axis (browsers differ in which axis they
 * report Shift + wheel on): wheel down or swiping left brings later dates in.
 * Anything else zooms by the vertical delta. `pagePx` is the size of one page
 * for page-mode deltas.
 */
export function wheelIntent(sample: WheelSample, pagePx: number): WheelIntent {
    if (sample.ctrlKey || sample.metaKey) return { type: 'browser' }
    const pxPerUnit = wheelPxPerUnit(sample.deltaMode, pagePx)
    const deltaX = finiteOr(sample.deltaX, 0) * pxPerUnit
    const deltaY = finiteOr(sample.deltaY, 0) * pxPerUnit
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)
    if (!sample.shiftKey && !isHorizontal)
        return { type: 'zoom', deltaPx: deltaY }
    return { type: 'pan', contentShiftPx: -(isHorizontal ? deltaX : deltaY) }
}

function dropStalePress(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    const isStale =
        state.pointers.has(sample.id) ||
        (state.pointers.size > 0 &&
            (sample.type !== 'touch' || sample.isPrimary))
    if (!isStale) return unchanged(state)
    return {
        state: { ...state, mode: 'idle', pointers: new Map() },
        effects: isGrabbing(state) ? [{ type: 'endGesture' }] : [],
    }
}

function beginPress(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    return {
        state: {
            mode: 'press',
            pointers: new Map([[sample.id, trackedPointer(sample)]]),
            startX: sample.x,
            startY: sample.y,
            lastX: sample.x,
            samples: [{ x: sample.x, t: sample.t }],
            dragged: false,
        },
        effects: [{ type: 'cancelAnimation' }],
    }
}

function startsPinch(state: GestureState, sample: PointerSample): boolean {
    const [firstPointer] = state.pointers.values()
    return (
        state.pointers.size === 1 &&
        sample.type === 'touch' &&
        firstPointer?.type === 'touch'
    )
}

function beginPinch(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    const activePointers = new Map(state.pointers).set(
        sample.id,
        trackedPointer(sample)
    )
    const beginEffects: GestureEffect[] =
        state.mode === 'drag' ? [] : [{ type: 'beginGesture' }]
    return {
        state: {
            ...state,
            mode: 'pinch',
            pointers: activePointers,
            dragged: true,
        },
        effects: [
            ...beginEffects,
            ...[...activePointers.keys()].map((id): GestureEffect => ({
                type: 'capture',
                id,
            })),
        ],
    }
}

function axisLockedToPage(state: GestureState, sample: PointerSample): boolean {
    const dx = Math.abs(sample.x - state.startX)
    const dy = Math.abs(sample.y - state.startY)
    return sample.type === 'touch' && dy >= DRAG_THRESHOLD_PX && dy > dx
}

function beginDrag(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    return withEffectsBefore(
        [{ type: 'beginGesture' }, { type: 'capture', id: sample.id }],
        dragMove({ ...state, mode: 'drag', dragged: true }, sample)
    )
}

function pinchMove(
    stateBefore: GestureState,
    movedState: GestureState
): GestureTransition {
    const pairBefore = pinchPair(stateBefore.pointers)
    const pairAfter = pinchPair(movedState.pointers)
    return {
        state: movedState,
        effects:
            pairBefore && pairAfter
                ? [{ type: 'pinch', prev: pairBefore, next: pairAfter }]
                : [],
    }
}

function dragMove(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    return {
        state: {
            ...state,
            lastX: sample.x,
            samples: [...state.samples, { x: sample.x, t: sample.t }].slice(
                -MAX_VELOCITY_SAMPLES
            ),
        },
        effects: [{ type: 'panBy', dx: sample.x - state.lastX }],
    }
}

function endPinch(
    state: GestureState,
    sample: PointerSample
): GestureTransition {
    const [remaining] = state.pointers.values()
    if (state.pointers.size === 1 && remaining)
        return unchanged(handOverToDrag(state, remaining, sample.t))
    if (state.pointers.size > 0) return unchanged(state)
    return {
        state: { ...state, mode: 'idle' },
        effects: [{ type: 'clearDragAfterClick' }, { type: 'endGesture' }],
    }
}

function handOverToDrag(
    state: GestureState,
    remaining: TrackedPointer,
    t: number
): GestureState {
    return {
        ...state,
        mode: 'drag',
        lastX: remaining.x,
        samples: [{ x: remaining.x, t }],
    }
}

function endDrag(
    state: GestureState,
    sample: PointerSample,
    cancelled: boolean
): GestureTransition {
    const idleState: GestureState = { ...state, mode: 'idle' }
    const clearEffects: GestureEffect[] = state.dragged
        ? [{ type: 'clearDragAfterClick' }]
        : []
    if (state.mode !== 'drag')
        return { state: idleState, effects: clearEffects }
    if (cancelled)
        return {
            state: idleState,
            effects: [...clearEffects, { type: 'endGesture' }],
        }
    const samples = [...state.samples, { x: sample.x, t: sample.t }]
    return {
        state: { ...idleState, samples },
        effects: [
            ...clearEffects,
            { type: 'startMomentum', velocity: estimateVelocity(samples) },
        ],
    }
}

function isReleasedMouse(sample: PointerSample): boolean {
    return sample.type === 'mouse' && sample.buttons === 0
}

function pinchPair(
    pointers: ReadonlyMap<number, TrackedPointer>
): PinchPair | null {
    const [firstPointer, secondPointer] = pointers.values()
    return firstPointer && secondPointer
        ? [firstPointer.x, secondPointer.x]
        : null
}

function withPointerX(
    pointers: ReadonlyMap<number, TrackedPointer>,
    id: number,
    x: number
): ReadonlyMap<number, TrackedPointer> {
    const pointer = pointers.get(id)
    return pointer ? new Map(pointers).set(id, { ...pointer, x }) : pointers
}

function trackedPointer(sample: PointerSample): TrackedPointer {
    return { x: sample.x, type: sample.type }
}

function unchanged(state: GestureState): GestureTransition {
    return { state, effects: [] }
}

function withEffectsBefore(
    effects: readonly GestureEffect[],
    transition: GestureTransition
): GestureTransition {
    return { ...transition, effects: [...effects, ...transition.effects] }
}

function wheelPxPerUnit(deltaMode: number, pagePx: number): number {
    if (deltaMode === DOM_DELTA_LINE) return WHEEL_LINE_PX
    if (deltaMode === DOM_DELTA_PAGE) return pagePx
    return 1
}

export const PRIVATE_UNDER_TESTS = {
    WHEEL_LINE_PX,
}
