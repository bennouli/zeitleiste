'use client'

import { createContext, useContext } from 'react'

export type PostControls = {
    /** Closes the open post and returns to the full-screen timeline (the start page). */
    close: () => void
}

export const PostContext = createContext<PostControls>({ close: () => {} })

export function usePostControls(): PostControls {
    return useContext(PostContext)
}
