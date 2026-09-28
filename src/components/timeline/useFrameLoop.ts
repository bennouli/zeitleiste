'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

export type FrameStatus = 'continue' | 'done'

export type FrameLoop = {
    /** Stops any running loop, then calls `frame` once per animation frame until it returns 'done'. */
    run: (frame: (now: number) => FrameStatus, onDone?: () => void) => void
    stop: () => void
    isRunning: () => boolean
}

export function useFrameLoop(): FrameLoop {
    const handleRef = useRef<number | null>(null)

    const stop = useCallback(() => {
        if (handleRef.current === null) return
        cancelAnimationFrame(handleRef.current)
        handleRef.current = null
    }, [])

    const run = useCallback(
        (frame: (now: number) => FrameStatus, onDone?: () => void) => {
            stop()
            const tick = (now: number) => {
                if (frame(now) === 'continue') {
                    handleRef.current = requestAnimationFrame(tick)
                    return
                }
                handleRef.current = null
                onDone?.()
            }
            handleRef.current = requestAnimationFrame(tick)
        },
        [stop]
    )

    const isRunning = useCallback(() => handleRef.current !== null, [])

    useEffect(() => stop, [stop])

    return useMemo(() => ({ run, stop, isRunning }), [run, stop, isRunning])
}
