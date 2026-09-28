import { describe, expect, it } from 'vitest'
import { findFocusTarget, PRIVATE_UNDER_TESTS } from '../entryFocus'

const { revealDelta, entryIdsOf } = PRIVATE_UNDER_TESTS

function domOf(html: string): HTMLElement {
    const root = document.createElement('div')
    root.innerHTML = html
    return root
}

function byTestId(root: HTMLElement, testId: string): HTMLElement {
    return root.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
}

describe('revealDelta', () => {
    it.each([
        ['visible', 100, 276, 0],
        ['cut off left', -50, 126, 66],
        ['off to the right', 1200, 1376, 1000 - 16 - 1376],
        ['wide and visible enough', -2000, 100, 0],
        ['wide and just off the left', -2000, 30, 16 + 2000],
        ['wide and off the right', 990, 3000, 16 - 990],
    ])('%s', (_, left, right, expected) => {
        expect(revealDelta(left, right, 1000)).toBe(expected)
    })
})

describe('entryIdsOf', () => {
    it.each([
        [
            'a card',
            '<div data-entry-id="a"><button data-testid="t"></button></div>',
            ['a'],
        ],
        [
            'a span bar',
            '<div data-span-id="s"><button data-testid="t"></button></div>',
            ['s'],
        ],
        [
            'a group',
            '<div data-entry-ids="a  b c"><button data-testid="t"></button></div>',
            ['a', 'b', 'c'],
        ],
        ['nothing outside an entry', '<button data-testid="t"></button>', []],
    ])('reads %s', (_, html, expected) => {
        const root = domOf(html)
        expect(entryIdsOf(byTestId(root, 't'))).toEqual(expected)
    })
})

describe('findFocusTarget', () => {
    it("returns the entry's own focusable card", () => {
        const root = domOf(
            '<div data-entry-id="a"><button data-testid="card"></button></div>'
        )
        expect(findFocusTarget(root, ['a'])).toBe(byTestId(root, 'card'))
    })

    it('returns the stack when the entry is hidden in it', () => {
        const root = domOf(
            '<div role="group" tabindex="0" data-testid="stack">' +
                '<div inert><div data-entry-id="a"><button></button></div></div>' +
                '</div>'
        )
        expect(findFocusTarget(root, ['a'])).toBe(byTestId(root, 'stack'))
    })

    it('returns the group holding the entry', () => {
        const root = domOf(
            '<div data-entry-ids="a b"><button data-testid="marker"></button></div>'
        )
        expect(findFocusTarget(root, ['b'])).toBe(byTestId(root, 'marker'))
    })

    it('tries the ids in order', () => {
        const root = domOf(
            '<div data-entry-id="b"><button data-testid="card"></button></div>'
        )
        expect(findFocusTarget(root, ['a', 'b'])).toBe(byTestId(root, 'card'))
    })

    it('finds nothing for an unknown entry', () => {
        const root = domOf('<div data-entry-id="a"><button></button></div>')
        expect(findFocusTarget(root, ['x'])).toBeNull()
    })
})
