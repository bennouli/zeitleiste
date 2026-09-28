import { vi } from 'vitest'

export function stubReducedMotion(reduce: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn((q: string) => ({
            matches: reduce && q.includes('reduce'),
            media: q,
            addEventListener() {},
            removeEventListener() {},
        }))
    )
}
