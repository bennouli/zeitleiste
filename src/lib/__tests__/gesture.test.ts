import { describe, expect, it } from 'vitest'
import {
    PRIVATE_UNDER_TESTS,
    clearDrag,
    initialGestureState,
    isGrabbing,
    pointerDown,
    pointerEnd,
    pointerMove,
    wheelIntent,
    type GestureState,
    type PointerSample,
    type WheelSample,
} from '../gesture'

const mouse = (x: number, t: number, extra: Partial<PointerSample> = {}) => ({
    id: 1,
    x,
    y: 100,
    type: 'mouse',
    isPrimary: true,
    buttons: 1,
    t,
    ...extra,
})

const touch = (
    id: number,
    x: number,
    t: number,
    extra: Partial<PointerSample> = {}
) => ({
    id,
    x,
    y: 100,
    type: 'touch',
    isPrimary: id === 1,
    buttons: 1,
    t,
    ...extra,
})

const stateAfterPress = (sample: PointerSample): GestureState =>
    pointerDown(initialGestureState, sample).state

describe('pointerDown', () => {
    it('begins a press and stops a running animation', () => {
        const pressDown = mouse(500, 0)
        const { state, effects } = pointerDown(initialGestureState, pressDown)
        expect(state.mode).toBe('press')
        expect(state.dragged).toBe(false)
        expect(effects).toEqual([{ type: 'cancelAnimation' }])
    })

    it('drops a stale drag whose release was never seen and begins a new press', () => {
        const draggingState = pointerMove(
            stateAfterPress(mouse(500, 0)),
            mouse(520, 10)
        ).state
        const pressDown = mouse(300, 1000)
        const { state, effects } = pointerDown(draggingState, pressDown)
        expect(state.mode).toBe('press')
        expect([...state.pointers.keys()]).toEqual([1])
        expect(state.startX).toBe(300)
        expect(effects).toEqual([
            { type: 'endGesture' },
            { type: 'cancelAnimation' },
        ])
    })

    it('a primary touch clears pointers left over from an earlier touch', () => {
        const leftover = stateAfterPress(touch(7, 400, 0, { isPrimary: true }))
        const pressDown = touch(1, 200, 1000)
        const { state } = pointerDown(leftover, pressDown)
        expect([...state.pointers.keys()]).toEqual([1])
        expect(state.mode).toBe('press')
    })

    it('a second touch begins a pinch and captures both pointers', () => {
        const pressState = stateAfterPress(touch(1, 400, 0))
        const secondFinger = touch(2, 600, 10)
        const { state, effects } = pointerDown(pressState, secondFinger)
        expect(state.mode).toBe('pinch')
        expect(state.dragged).toBe(true)
        expect(isGrabbing(state)).toBe(true)
        expect(effects).toEqual([
            { type: 'beginGesture' },
            { type: 'capture', id: 1 },
            { type: 'capture', id: 2 },
        ])
    })

    it('a second touch during a drag pinches without a second beginGesture', () => {
        const dragState = pointerMove(
            stateAfterPress(touch(1, 400, 0)),
            touch(1, 420, 10)
        ).state
        const secondFinger = touch(2, 600, 20)
        const { state, effects } = pointerDown(dragState, secondFinger)
        expect(state.mode).toBe('pinch')
        expect(effects).not.toContainEqual({ type: 'beginGesture' })
    })

    it('drops a stale press that never grabbed without ending a gesture', () => {
        const staleState = stateAfterPress(mouse(500, 0))
        const pressDown = mouse(300, 1000)
        const { effects } = pointerDown(staleState, pressDown)
        expect(effects).toEqual([{ type: 'cancelAnimation' }])
    })

    it('drops a stale pinch and ends its gesture', () => {
        const pinchState = pointerDown(
            stateAfterPress(touch(1, 400, 0)),
            touch(2, 600, 10)
        ).state
        const primaryTouch = touch(1, 300, 1000)
        const { state, effects } = pointerDown(pinchState, primaryTouch)
        expect(state.mode).toBe('press')
        expect(effects).toEqual([
            { type: 'endGesture' },
            { type: 'cancelAnimation' },
        ])
    })

    it('a third touch during a pinch is ignored', () => {
        const pinchState = pointerDown(
            stateAfterPress(touch(1, 400, 0)),
            touch(2, 600, 10)
        ).state
        const thirdFinger = touch(3, 800, 20)
        const { state, effects } = pointerDown(pinchState, thirdFinger)
        expect(state).toBe(pinchState)
        expect(effects).toEqual([])
    })

    it('a non-primary touch next to a mouse press is ignored', () => {
        const pressState = stateAfterPress(mouse(400, 0))
        const secondFinger = touch(2, 600, 10)
        const { state, effects } = pointerDown(pressState, secondFinger)
        expect(state).toBe(pressState)
        expect(effects).toEqual([])
    })
})

describe('pointerMove', () => {
    it('ignores an unknown pointer and plain hover', () => {
        const hover = mouse(520, 10, { buttons: 0 })
        const { state, effects } = pointerMove(initialGestureState, hover)
        expect(state).toBe(initialGestureState)
        expect(effects).toEqual([])
    })

    it('stays a press below the drag threshold', () => {
        const pressState = stateAfterPress(mouse(500, 0))
        const subThresholdMove = mouse(505, 10)
        const { state, effects } = pointerMove(pressState, subThresholdMove)
        expect(state.mode).toBe('press')
        expect(effects).toEqual([])
    })

    it('turns into a drag at the threshold and pans by dx', () => {
        const pressState = stateAfterPress(mouse(500, 0))
        const thresholdMove = mouse(506, 10)
        const { state, effects } = pointerMove(pressState, thresholdMove)
        expect(state.mode).toBe('drag')
        expect(state.dragged).toBe(true)
        expect(effects).toEqual([
            { type: 'beginGesture' },
            { type: 'capture', id: 1 },
            { type: 'panBy', dx: 6 },
        ])
    })

    it('pans by the distance since the last move', () => {
        const dragState = pointerMove(
            stateAfterPress(mouse(500, 0)),
            mouse(520, 10)
        ).state
        const followUpMove = mouse(560, 20)
        const { state, effects } = pointerMove(dragState, followUpMove)
        expect(effects).toEqual([{ type: 'panBy', dx: 40 }])
        expect(state.lastX).toBe(560)
    })

    it('keeps the last 20 velocity samples', () => {
        const moves = Array.from({ length: 30 }, (_, i) =>
            mouse(510 + i, 10 + i)
        )
        const dragState = moves.reduce(
            (state, move) => pointerMove(state, move).state,
            stateAfterPress(mouse(500, 0))
        )
        expect(dragState.samples).toHaveLength(20)
        expect(dragState.samples.at(-1)).toEqual({ x: 539, t: 39 })
    })

    it('a mouse move without buttons ends the press as cancelled', () => {
        const dragState = pointerMove(
            stateAfterPress(mouse(500, 0)),
            mouse(560, 10)
        ).state
        const buttonsReleased = mouse(600, 20, { buttons: 0 })
        const { state, effects } = pointerMove(dragState, buttonsReleased)
        expect(state.mode).toBe('idle')
        expect(state.pointers.size).toBe(0)
        expect(effects).toContainEqual({ type: 'endGesture' })
        expect(effects).not.toContainEqual(
            expect.objectContaining({ type: 'panBy' })
        )
    })

    it('a mostly vertical touch move is locked to the page, the pointer stays known', () => {
        const pressState = stateAfterPress(touch(1, 300, 0))
        const verticalSwipe = touch(1, 304, 10, { y: 160 })
        const { state, effects } = pointerMove(pressState, verticalSwipe)
        expect(state.mode).toBe('idle')
        expect(state.pointers.has(1)).toBe(true)
        expect(effects).toEqual([])
    })

    it('a vertical touch move exactly at the threshold is locked to the page', () => {
        const pressState = stateAfterPress(touch(1, 300, 0))
        const thresholdSwipe = touch(1, 305, 10, { y: 106 })
        const { state } = pointerMove(pressState, thresholdSwipe)
        expect(state.mode).toBe('idle')
    })

    it('a mostly vertical mouse move still drags', () => {
        const pressState = stateAfterPress(mouse(300, 0))
        const verticalSwipe = mouse(310, 10, { y: 160 })
        const { state } = pointerMove(pressState, verticalSwipe)
        expect(state.mode).toBe('drag')
    })

    it('pinches with the positions before and after the move', () => {
        const pinchState = pointerDown(
            stateAfterPress(touch(1, 400, 0)),
            touch(2, 600, 10)
        ).state
        const spreadMove = touch(2, 700, 20)
        const { effects } = pointerMove(pinchState, spreadMove)
        expect(effects).toEqual([
            { type: 'pinch', prev: [400, 600], next: [400, 700] },
        ])
    })
})

describe('pointerEnd', () => {
    it('a press without drag releases without momentum and leaves dragged false', () => {
        const pressState = stateAfterPress(mouse(500, 0))
        const pointerUp = mouse(504, 10)
        const { state, effects } = pointerEnd(pressState, pointerUp, false)
        expect(state.mode).toBe('idle')
        expect(state.dragged).toBe(false)
        expect(effects).toEqual([{ type: 'release', id: 1 }])
    })

    it('a drag release starts momentum from the samples', () => {
        const dragState = pointerMove(
            stateAfterPress(mouse(500, 0)),
            mouse(540, 40)
        ).state
        const pointerUp = mouse(580, 80)
        const { state, effects } = pointerEnd(dragState, pointerUp, false)
        expect(state.mode).toBe('idle')
        expect(state.dragged).toBe(true)
        expect(effects).toEqual([
            { type: 'release', id: 1 },
            { type: 'clearDragAfterClick' },
            { type: 'startMomentum', velocity: 1 },
        ])
    })

    it('a cancelled drag ends the gesture without momentum', () => {
        const dragState = pointerMove(
            stateAfterPress(mouse(500, 0)),
            mouse(540, 40)
        ).state
        const cancelEvent = mouse(540, 50)
        const { effects } = pointerEnd(dragState, cancelEvent, true)
        expect(effects).toEqual([
            { type: 'release', id: 1 },
            { type: 'clearDragAfterClick' },
            { type: 'endGesture' },
        ])
    })

    it('ignores an unknown pointer', () => {
        const pressState = stateAfterPress(mouse(500, 0))
        const unknownUp = mouse(500, 10, { id: 9 })
        const { state, effects } = pointerEnd(pressState, unknownUp, false)
        expect(state).toBe(pressState)
        expect(effects).toEqual([])
    })

    it('one finger lifting from a pinch hands over to a drag with the other', () => {
        const firstFingerDown = touch(1, 400, 0)
        const secondFingerDown = touch(2, 600, 10)
        const secondFingerSpread = touch(2, 800, 20)
        const pressState = stateAfterPress(firstFingerDown)
        const pinchStartState = pointerDown(pressState, secondFingerDown).state
        const pinchState = pointerMove(
            pinchStartState,
            secondFingerSpread
        ).state
        const firstFingerUp = touch(1, 400, 30)
        const { state, effects } = pointerEnd(pinchState, firstFingerUp, false)
        expect(state.mode).toBe('drag')
        expect(state.lastX).toBe(800)
        expect(state.samples).toEqual([{ x: 800, t: 30 }])
        expect(effects).toEqual([{ type: 'release', id: 1 }])
        const followUpMove = touch(2, 850, 40)
        expect(pointerMove(state, followUpMove).effects).toEqual([
            { type: 'panBy', dx: 50 },
        ])
    })

    it('releasing the finger that took over from a pinch glides from its own samples', () => {
        const pinchState = pointerDown(
            stateAfterPress(touch(1, 400, 0)),
            touch(2, 600, 10)
        ).state
        const handedOver = pointerEnd(
            pinchState,
            touch(1, 400, 20),
            false
        ).state
        const dragState = pointerMove(handedOver, touch(2, 640, 60)).state
        const lastFingerUp = touch(2, 680, 100)
        const { effects } = pointerEnd(dragState, lastFingerUp, false)
        expect(effects).toEqual([
            { type: 'release', id: 2 },
            { type: 'clearDragAfterClick' },
            { type: 'startMomentum', velocity: 1 },
        ])
    })

    it('lifting the last finger after a pinch ends without momentum', () => {
        const lastFingerPinch: GestureState = {
            ...initialGestureState,
            mode: 'pinch',
            pointers: new Map([[2, { x: 600, type: 'touch' }]]),
            dragged: true,
        }
        const lastFingerUp = touch(2, 600, 30)
        const { state, effects } = pointerEnd(
            lastFingerPinch,
            lastFingerUp,
            false
        )
        expect(state.mode).toBe('idle')
        expect(effects).toEqual([
            { type: 'release', id: 2 },
            { type: 'clearDragAfterClick' },
            { type: 'endGesture' },
        ])
    })

    it('releasing an axis-locked touch neither ends a gesture nor glides', () => {
        const lockedState = pointerMove(
            stateAfterPress(touch(1, 300, 0)),
            touch(1, 304, 10, { y: 160 })
        ).state
        const cancelEvent = touch(1, 304, 20, { y: 160 })
        const { state, effects } = pointerEnd(lockedState, cancelEvent, true)
        expect(state.pointers.size).toBe(0)
        expect(effects).toEqual([{ type: 'release', id: 1 }])
    })

    it('an axis-locked touch can still start a pinch with a second finger', () => {
        const lockedState = pointerMove(
            stateAfterPress(touch(1, 300, 0)),
            touch(1, 304, 10, { y: 160 })
        ).state
        const secondFinger = touch(2, 600, 20)
        const { state, effects } = pointerDown(lockedState, secondFinger)
        expect(state.mode).toBe('pinch')
        expect(effects).toContainEqual({ type: 'beginGesture' })
    })
})

describe('clearDrag', () => {
    it('clears dragged once every pointer is up', () => {
        const draggedState: GestureState = {
            ...initialGestureState,
            dragged: true,
        }
        expect(clearDrag(draggedState).dragged).toBe(false)
    })

    it('keeps dragged while a new press is down', () => {
        const pressState: GestureState = {
            ...stateAfterPress(mouse(500, 0)),
            dragged: true,
        }
        expect(clearDrag(pressState)).toBe(pressState)
    })
})

describe('isGrabbing', () => {
    it('is false while idle or pressing, true while dragging', () => {
        const pressState = stateAfterPress(mouse(500, 0))
        const dragState = pointerMove(pressState, mouse(520, 10)).state
        expect(isGrabbing(initialGestureState)).toBe(false)
        expect(isGrabbing(pressState)).toBe(false)
        expect(isGrabbing(dragState)).toBe(true)
    })
})

describe('wheelIntent', () => {
    const { WHEEL_LINE_PX } = PRIVATE_UNDER_TESTS
    const PAGE_PX = 1000
    const wheel = (extra: Partial<WheelSample>): WheelSample => ({
        deltaX: 0,
        deltaY: 0,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        ...extra,
    })

    it('zooms by the vertical delta', () => {
        const scroll = wheel({ deltaY: 100, deltaX: 20 })
        expect(wheelIntent(scroll, PAGE_PX)).toEqual({
            type: 'zoom',
            deltaPx: 100,
        })
    })

    it.each([
        ['Ctrl', { ctrlKey: true }],
        ['Cmd', { metaKey: true }],
        ['Ctrl + Shift', { ctrlKey: true, shiftKey: true }],
    ])('leaves %s + wheel to the browser', (_, modifiers) => {
        const scroll = wheel({ deltaY: 100, ...modifiers })
        expect(wheelIntent(scroll, PAGE_PX)).toEqual({ type: 'browser' })
    })

    it('pans by deltaY on Shift + wheel reported vertically', () => {
        const scroll = wheel({ deltaY: 100, shiftKey: true })
        expect(wheelIntent(scroll, PAGE_PX)).toEqual({
            type: 'pan',
            deltaPx: 100,
        })
    })

    it('pans by deltaX on Shift + wheel reported horizontally', () => {
        const scroll = wheel({ deltaX: -100, shiftKey: true })
        expect(wheelIntent(scroll, PAGE_PX)).toEqual({
            type: 'pan',
            deltaPx: -100,
        })
    })

    it('pans by deltaX when the horizontal delta dominates', () => {
        const swipe = wheel({ deltaX: 40, deltaY: 10 })
        expect(wheelIntent(swipe, PAGE_PX)).toEqual({
            type: 'pan',
            deltaPx: 40,
        })
    })

    it('zooms on a diagonal delta with equal axes', () => {
        const diagonal = wheel({ deltaX: 30, deltaY: -30 })
        expect(wheelIntent(diagonal, PAGE_PX)).toEqual({
            type: 'zoom',
            deltaPx: -30,
        })
    })

    it('converts line deltas to px', () => {
        const lines = wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE })
        expect(wheelIntent(lines, PAGE_PX)).toEqual({
            type: 'zoom',
            deltaPx: 3 * WHEEL_LINE_PX,
        })
    })

    it('converts page deltas to px of one page', () => {
        const page = wheel({ deltaX: 1, deltaMode: WheelEvent.DOM_DELTA_PAGE })
        expect(wheelIntent(page, PAGE_PX)).toEqual({
            type: 'pan',
            deltaPx: PAGE_PX,
        })
    })

    it('treats non-finite deltas as no movement', () => {
        const broken = wheel({ deltaX: Number.NaN, deltaY: Infinity })
        expect(wheelIntent(broken, PAGE_PX)).toEqual({
            type: 'zoom',
            deltaPx: 0,
        })
    })
})
