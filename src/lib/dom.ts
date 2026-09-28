export function isTypingTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    )
}

export function prefersReducedMotion(): boolean {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    )
        return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
