export function easeOutCubic(p: number): number {
    return 1 - Math.pow(1 - p, 3)
}

export function easeInOut(p: number): number {
    return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
}
