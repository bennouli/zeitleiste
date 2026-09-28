'use client'

import { createContext, useContext } from 'react'

export interface PostControls {
    /** Closes the open post and returns to the full-screen timeline (`/`). */
    close: () => void
}

export const PostContext = createContext<PostControls>({ close: () => {} })

export function usePostControls(): PostControls {
    return useContext(PostContext)
}
