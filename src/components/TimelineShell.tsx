'use client'

import { PostContext } from '@/components/PostContext'
import { findFocusTarget } from '@/components/timeline/entryFocus'
import { Timeline } from '@/components/timeline/Timeline'
import { isTypingTarget, prefersReducedMotion } from '@/lib/dom'
import type { Entry } from '@/lib/entry'
import { findEntry, postHref, slugFromPathname } from '@/lib/posts'
import { animateScroll } from '@/lib/scroll'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'

const POST_TOP_VIEWPORT_FRACTION = 0.4
const FOLD_VIEWPORT_FRACTION = 0.9
const SCROLL_MS = 500
const FOLLOW_LAYOUT_MAX_MS = 1500

type Opener = { el: HTMLElement; id: string }

function scrollToPost(
    post: HTMLElement,
    animate: boolean,
    onlyIfBelowFold = false
): () => void {
    const postScrollTop = () =>
        Math.max(
            0,
            post.getBoundingClientRect().top +
                window.scrollY -
                window.innerHeight * POST_TOP_VIEWPORT_FRACTION
        )
    if (animate && typeof window.requestAnimationFrame === 'function')
        return animateScroll(postScrollTop, {
            durationMs: SCROLL_MS,
            maxMs: FOLLOW_LAYOUT_MAX_MS,
        })
    return jumpAfterLayout(() =>
        onlyIfBelowFold && !startsBelowFold(post) ? null : postScrollTop()
    )
}

function jumpAfterLayout(scrollTop: () => number | null): () => void {
    const frame = window.requestAnimationFrame?.(() => {
        const top = scrollTop()
        if (top !== null) window.scrollTo({ top, behavior: 'auto' })
    })
    return () => {
        if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
}

function startsBelowFold(el: HTMLElement): boolean {
    return (
        el.getBoundingClientRect().top >
        window.innerHeight * FOLD_VIEWPORT_FRACTION
    )
}

function focusPostHeading(post: HTMLElement): boolean {
    const heading = post.querySelector<HTMLElement>(
        '[data-post-heading], h1, h2'
    )
    if (!heading) return false
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
    heading.focus({ preventScroll: true })
    return true
}

function focusPost(post: HTMLElement): () => void {
    if (focusPostHeading(post)) return () => {}
    const frame = window.requestAnimationFrame(() => focusPostHeading(post))
    return () => window.cancelAnimationFrame(frame)
}

function focusedTimelineElement(): HTMLElement | null {
    const active = document.activeElement
    return active instanceof HTMLElement && active.closest('[role="region"]')
        ? active
        : null
}

function isStillFocusable(el: HTMLElement): boolean {
    return el.isConnected && !el.closest('[inert]')
}

function entryCardOrRegion(id: string): HTMLElement | null {
    const region = document.querySelector<HTMLElement>('section[role="region"]')
    return region && (findFocusTarget(region, [id]) ?? region)
}

function restoreOpenerFocus(opener: Opener): void {
    const target = isStillFocusable(opener.el)
        ? opener.el
        : entryCardOrRegion(opener.id)
    target?.focus({ preventScroll: true })
}

export function TimelineShell({
    entries,
    children,
}: {
    entries: Entry[]
    children?: ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const pathSlug = slugFromPathname(pathname)
    const openSlug =
        pathSlug !== null && findEntry(entries, pathSlug) ? pathSlug : null
    const isStartPage = !pathname || pathname === '/'
    const pageKey = openSlug ?? (isStartPage ? null : pathname)

    const postRef = useRef<HTMLDivElement>(null)
    // A ref, not a mount flag: StrictMode re-runs the effect on the initial page.
    const initialPageKey = useRef(pageKey)
    const navigated = useRef(false)
    const openerRef = useRef<Opener | null>(null)

    const close = useCallback(
        () => router.push('/', { scroll: false }),
        [router]
    )

    const openEntry = useCallback(
        (id: string) => {
            if (id === openSlug || !findEntry(entries, id)) return
            const focusedEl = focusedTimelineElement()
            if (focusedEl) openerRef.current = { el: focusedEl, id }
            router.push(postHref(id), { scroll: false })
        },
        [entries, openSlug, router]
    )

    useEffect(() => {
        if (pageKey !== initialPageKey.current) navigated.current = true
        const isInitialPage = !navigated.current
        if (pageKey === null) {
            if (window.scrollY > 0)
                window.scrollTo({ top: 0, behavior: 'auto' })
            const opener = openerRef.current
            openerRef.current = null
            if (opener && document.activeElement === document.body)
                restoreOpenerFocus(opener)
            return
        }
        const post = postRef.current
        if (!post) return
        const cancelFocus = isInitialPage ? () => {} : focusPost(post)
        const stopScroll = isInitialPage
            ? scrollToPost(post, false, true)
            : scrollToPost(post, !prefersReducedMotion())
        return () => {
            cancelFocus()
            stopScroll()
        }
    }, [pageKey])

    useEffect(() => {
        if (pageKey === null) return
        const onKey = (e: KeyboardEvent) => {
            if (
                e.key !== 'Escape' ||
                e.defaultPrevented ||
                isTypingTarget(e.target)
            )
                return
            close()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [pageKey, close])

    const controls = useMemo(() => ({ close }), [close])

    return (
        <PostContext value={controls}>
            <main>
                <h1 className="sr-only">Zeitleiste: Russland und der Westen</h1>
                <Timeline
                    entries={entries}
                    collapsed={pageKey !== null}
                    focusEntryId={openSlug}
                    onOpenEntry={openEntry}
                />
                <div id="post" ref={postRef}>
                    {children}
                </div>
            </main>
        </PostContext>
    )
}
