import { revalidatePath } from 'next/cache.js'
import type {
    CollectionAfterChangeHook,
    CollectionAfterDeleteHook,
    PayloadRequest,
} from 'payload'

type Versioned = { _status?: 'draft' | 'published' | null }

/**
 * Every page renders the whole timeline in the shared layout, so any change
 * visitors can see refreshes every page.
 */
function revalidateSite({ context }: PayloadRequest): void {
    if (context.disableRevalidate) return
    revalidatePath('/', 'layout')
}

/** True if visitors saw the entry before the change or see it after. */
function isVisibleChange(
    doc: Versioned | null | undefined,
    previousDoc: Versioned | null | undefined
): boolean {
    return [doc, previousDoc].some((d) => d?._status === 'published')
}

export const revalidateEntryChange: CollectionAfterChangeHook = ({
    doc,
    previousDoc,
    req,
}) => {
    if (isVisibleChange(doc, previousDoc)) revalidateSite(req)
    return doc
}

export const revalidateEntryDelete: CollectionAfterDeleteHook = ({
    doc,
    req,
}) => {
    if (isVisibleChange(doc, undefined)) revalidateSite(req)
    return doc
}

export const revalidatePostChange: CollectionAfterChangeHook = ({
    doc,
    req,
}) => {
    revalidateSite(req)
    return doc
}

export const revalidatePostDelete: CollectionAfterDeleteHook = ({
    doc,
    req,
}) => {
    revalidateSite(req)
    return doc
}
