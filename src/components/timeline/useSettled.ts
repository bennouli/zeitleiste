'use client'

import { useEffect, useState } from 'react'

/**
 * The last value that stayed unchanged for `delayMs`; ignores the frames of a height transition.
 * The first change away from the initial (unmeasured) value applies at once, so the first layout is the final one.
 */
export function useSettled<T>(value: T, delayMs: number): T {
    const [unmeasured] = useState(value)
    const [settled, setSettled] = useState(value)
    if (Object.is(settled, unmeasured) && !Object.is(value, settled))
        setSettled(value)
    useEffect(() => {
        if (Object.is(value, settled)) return
        const id = window.setTimeout(() => setSettled(value), delayMs)
        return () => window.clearTimeout(id)
    }, [value, settled, delayMs])
    return settled
}
