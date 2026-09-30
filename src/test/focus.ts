import { vi } from 'vitest'

/** jsdom's `:focus-visible` does not follow the input modality; this pins the answer for `el`. */
export function stubFocusVisible(el: Element, visible = true) {
    vi.spyOn(el, 'matches').mockImplementation((selector) =>
        selector === ':focus-visible'
            ? visible
            : Element.prototype.matches.call(el, selector)
    )
}
