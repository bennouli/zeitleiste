'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'notes.sidebar'
const COLLAPSED = 'collapsed'

const listeners = new Set<() => void>()

/** Whether the notes sidebar is collapsed, remembered in this browser. */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
    const collapsed = useSyncExternalStore(
        subscribe,
        readCollapsed,
        () => false
    )
    const setCollapsed = useCallback((isCollapsed: boolean) => {
        writeCollapsed(isCollapsed)
        listeners.forEach((listener) => listener())
    }, [])
    return [collapsed, setCollapsed]
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    window.addEventListener('storage', listener)
    return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', listener)
    }
}

function readCollapsed(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === COLLAPSED
    } catch {
        return false
    }
}

function writeCollapsed(collapsed: boolean): void {
    try {
        if (collapsed) window.localStorage.setItem(STORAGE_KEY, COLLAPSED)
        else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
        return
    }
}

export const PRIVATE_UNDER_TESTS = { STORAGE_KEY }
