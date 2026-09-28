import { act, renderHook } from '@testing-library/react'
import type { FocusEvent, PointerEvent } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useTooltipTrigger } from './useTooltipTrigger'

const TOOLTIP_ID = 'tip'
const KEYBOARD_FOCUS_AT_MS = 5000

function renderTrigger(touchToggle = false) {
    const anchor = document.createElement('div')
    document.body.append(anchor)
    const anchorRef = { current: anchor }
    const options = { tooltipId: TOOLTIP_ID, anchorRef, touchToggle }
    const hook = renderHook(() => useTooltipTrigger(options))
    return { ...hook, anchor }
}

function pointerAt(timeStamp: number, pointerType = 'mouse') {
    return { timeStamp, pointerType } as PointerEvent
}

function focusAt(timeStamp: number) {
    return { timeStamp } as FocusEvent
}

function pressEscape(
    target: EventTarget = document.body,
    escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
    })
): boolean {
    act(() => {
        target.dispatchEvent(escape)
    })
    return escape.defaultPrevented
}

function tap(target: EventTarget) {
    act(() => {
        target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
}

afterEach(() => {
    document.body.replaceChildren()
})

describe('useTooltipTrigger', () => {
    it('opens on a focus without a press before it', () => {
        const { result } = renderTrigger()
        const keyboardFocus = focusAt(KEYBOARD_FOCUS_AT_MS)
        act(() => result.current.triggerProps.onFocus(keyboardFocus))
        expect(result.current.open).toBe(true)
    })

    it('ignores a focus caused by a press', () => {
        const { result } = renderTrigger()
        const press = pointerAt(1000)
        act(() => result.current.triggerProps.onPointerDown(press))
        const pressFocus = focusAt(1010)
        act(() => result.current.triggerProps.onFocus(pressFocus))
        expect(result.current.open).toBe(false)
    })

    it('opens on a focus long after a press', () => {
        const { result } = renderTrigger()
        const press = pointerAt(1000)
        act(() => result.current.triggerProps.onPointerDown(press))
        const lateFocus = focusAt(2000)
        act(() => result.current.triggerProps.onFocus(lateFocus))
        expect(result.current.open).toBe(true)
    })

    it('forgets a press once its click happened', () => {
        const { result } = renderTrigger()
        const press = pointerAt(1000)
        act(() => result.current.triggerProps.onPointerDown(press))
        act(() => result.current.triggerProps.onClickCapture())
        const pressFocus = focusAt(1010)
        act(() => result.current.triggerProps.onFocus(pressFocus))
        expect(result.current.open).toBe(true)
    })

    it('consumes Escape only while open', () => {
        const { result } = renderTrigger()
        expect(pressEscape()).toBe(false)
        const keyboardFocus = focusAt(KEYBOARD_FOCUS_AT_MS)
        act(() => result.current.triggerProps.onFocus(keyboardFocus))
        expect(pressEscape()).toBe(true)
        expect(result.current.open).toBe(false)
        expect(pressEscape()).toBe(false)
    })

    it('leaves Escape in a text field alone', () => {
        const { result } = renderTrigger()
        const input = document.createElement('input')
        document.body.append(input)
        const keyboardFocus = focusAt(KEYBOARD_FOCUS_AT_MS)
        act(() => result.current.triggerProps.onFocus(keyboardFocus))
        expect(pressEscape(input)).toBe(false)
        expect(result.current.open).toBe(true)
    })

    it('toggles on a touch click and ignores a mouse click', () => {
        const { result } = renderTrigger(true)
        const mousePress = pointerAt(1000, 'mouse')
        const touchPress = pointerAt(2000, 'touch')
        const click = () => {
            act(() => result.current.triggerProps.onClickCapture())
            act(() => result.current.toggleTouch())
        }
        act(() => result.current.triggerProps.onPointerDown(mousePress))
        click()
        expect(result.current.open).toBe(false)
        act(() => result.current.triggerProps.onPointerDown(touchPress))
        click()
        expect(result.current.open).toBe(true)
        act(() => result.current.triggerProps.onPointerDown(touchPress))
        click()
        expect(result.current.open).toBe(false)
    })

    it('does not toggle without touchToggle', () => {
        const { result } = renderTrigger(false)
        const touchPress = pointerAt(1000, 'touch')
        act(() => result.current.triggerProps.onPointerDown(touchPress))
        act(() => result.current.triggerProps.onClickCapture())
        act(() => result.current.toggleTouch())
        expect(result.current.open).toBe(false)
    })

    it('closes a tapped-open tooltip on a tap outside the anchor and the bubble', () => {
        const { result, anchor } = renderTrigger(true)
        const bubble = document.createElement('div')
        bubble.id = TOOLTIP_ID
        document.body.append(bubble)
        const touchPress = pointerAt(1000, 'touch')
        act(() => result.current.triggerProps.onPointerDown(touchPress))
        act(() => result.current.triggerProps.onClickCapture())
        act(() => result.current.toggleTouch())
        tap(anchor)
        tap(bubble)
        expect(result.current.open).toBe(true)
        tap(document.body)
        expect(result.current.open).toBe(false)
    })

    it('dismisses until the next hover', () => {
        const { result } = renderTrigger()
        const mouse = pointerAt(1000, 'mouse')
        act(() => result.current.hoverProps.onPointerEnter(mouse))
        act(() => result.current.dismiss())
        expect(result.current.open).toBe(false)
        act(() => result.current.hoverProps.onPointerLeave(mouse))
        act(() => result.current.hoverProps.onPointerEnter(mouse))
        expect(result.current.open).toBe(true)
    })

    it('closes a focus-opened tooltip on blur', () => {
        const { result } = renderTrigger()
        const keyboardFocus = focusAt(KEYBOARD_FOCUS_AT_MS)
        act(() => result.current.triggerProps.onFocus(keyboardFocus))
        act(() => result.current.triggerProps.onBlur())
        expect(result.current.open).toBe(false)
    })

    it('forgets a cancelled press', () => {
        const { result } = renderTrigger()
        const press = pointerAt(1000)
        const pressFocus = focusAt(1010)
        act(() => result.current.triggerProps.onPointerDown(press))
        act(() => result.current.triggerProps.onPointerCancel())
        act(() => result.current.triggerProps.onFocus(pressFocus))
        expect(result.current.open).toBe(true)
    })

    it('ignores touch hover', () => {
        const { result } = renderTrigger()
        const touch = pointerAt(1000, 'touch')
        act(() => result.current.hoverProps.onPointerEnter(touch))
        expect(result.current.open).toBe(false)
    })

    it('leaves an Escape another handler consumed alone', () => {
        const { result } = renderTrigger()
        const keyboardFocus = focusAt(KEYBOARD_FOCUS_AT_MS)
        const consumedEscape = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        })
        consumedEscape.preventDefault()
        act(() => result.current.triggerProps.onFocus(keyboardFocus))
        pressEscape(document.body, consumedEscape)
        expect(result.current.open).toBe(true)
    })
})
