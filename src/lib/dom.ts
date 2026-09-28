export function isTypingTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    )
}

/** A zero-size rect: the element has no layout (hidden, detached, or jsdom). */
export function hasNoLayout(
    rect: Pick<DOMRectReadOnly, 'width' | 'height'>
): boolean {
    return rect.width === 0 && rect.height === 0
}

export function prefersReducedMotion(): boolean {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    )
        return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
