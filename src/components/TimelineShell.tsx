'use client'

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PostContext } from '@/components/PostContext'
import { findFocusTarget } from '@/components/timeline/focusTarget'
import { Timeline } from '@/components/timeline/Timeline'
import type { Entry } from '@/lib/entry'
import { findEntry, postHref, slugFromPathname } from '@/lib/posts'

// Kept for existing importers; new code imports from PostContext directly.
export { PostContext, usePostControls, type PostControls } from '@/components/PostContext'

/** Where the start of the post should sit, as a fraction of the viewport height from the top. */
const POST_TOP_RATIO = 0.4
const SCROLL_MS = 500
/** Keep following layout changes (the timeline's height transition) at most this long. */
const SCROLL_MAX_MS = 1500

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

/**
 * Scrolls the window so the top of `el` sits at POST_TOP_RATIO of the viewport.
 * The target is re-measured every frame, so the scroll runs together with the
 * timeline's height transition and still lands on the final layout.
 * Stops as soon as the user scrolls or touches. Returns a cancel function.
 */
function scrollToPost(el: HTMLElement, animate: boolean, onlyIfBelowFold = false): () => void {
  const target = () =>
    Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * POST_TOP_RATIO)

  if (!animate || typeof window.requestAnimationFrame !== 'function') {
    // Measure after the layout has settled for this frame.
    const id = window.requestAnimationFrame?.(() => {
      if (onlyIfBelowFold && el.getBoundingClientRect().top <= window.innerHeight * 0.9) return
      window.scrollTo({ top: target(), behavior: 'auto' })
    })
    return () => {
      if (id !== undefined) window.cancelAnimationFrame(id)
    }
  }

  const from = window.scrollY
  let t0: number | null = null
  let last = NaN
  let stable = 0
  let frame = 0
  const stop = () => {
    window.cancelAnimationFrame(frame)
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
      window.removeEventListener(type, stop)
    }
  }
  const step = (now: number) => {
    t0 ??= now
    const elapsed = now - t0
    const to = target()
    const p = Math.min(1, elapsed / SCROLL_MS)
    window.scrollTo({ top: from + (to - from) * easeInOut(p), behavior: 'auto' })
    stable = p === 1 && Math.abs(to - last) < 0.5 ? stable + 1 : 0
    last = to
    if (stable >= 3 || elapsed >= SCROLL_MAX_MS) stop()
    else frame = window.requestAnimationFrame(step)
  }
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
    window.addEventListener(type, stop, { passive: true })
  }
  frame = window.requestAnimationFrame(step)
  return stop
}

/** Focuses the heading of the page below the timeline (the post's title); false if there is none yet. */
function focusPostHeading(container: HTMLElement): boolean {
  const heading = container.querySelector<HTMLElement>('[data-post-heading], h1, h2')
  if (!heading) return false
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
  heading.focus({ preventScroll: true })
  return true
}

/**
 * The persistent app frame: the timeline (kept mounted across post routes, so it
 * keeps its state) followed by the page content, i.e. the open post.
 */
export function TimelineShell({ entries, children }: { entries: Entry[]; children?: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const pathSlug = slugFromPathname(pathname)
  // Unknown slugs don't focus anything; the post page itself renders the 404.
  const openSlug = pathSlug !== null && findEntry(entries, pathSlug) ? pathSlug : null
  // Any page other than the start page (a post, or a 404) sits below the collapsed timeline.
  const pageKey = openSlug ?? (pathname && pathname !== '/' ? pathname : null)

  const postRef = useRef<HTMLDivElement>(null)
  // StrictMode-safe "is this still the initial address" check.
  const initialKey = useRef(pageKey)
  const navigated = useRef(false)
  // The element focused when a post was opened (and its entry), to restore focus on close.
  const opener = useRef<{ el: HTMLElement; id: string } | null>(null)

  const close = useCallback(() => router.push('/', { scroll: false }), [router])

  const openEntry = useCallback(
    (id: string) => {
      if (id === openSlug || !findEntry(entries, id)) return
      // Remember the entry that opened it (also when switching posts), so closing returns there.
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('[role="region"]')) {
        opener.current = { el: active, id }
      }
      router.push(postHref(id), { scroll: false })
    },
    [entries, openSlug, router],
  )

  // One scroll per page change; also runs for back/forward and direct links.
  useEffect(() => {
    if (pageKey !== initialKey.current) navigated.current = true
    const first = !navigated.current
    if (pageKey === null) {
      // The post is gone, so the document is short and the browser clamps anyway.
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' })
      const from = opener.current
      opener.current = null
      if (from && document.activeElement === document.body) {
        // The collapse relayouts the timeline; the opening card may have been replaced meanwhile.
        const region = document.querySelector<HTMLElement>('section[role="region"]')
        const el =
          from.el.isConnected && !from.el.closest('[inert]')
            ? from.el
            : ((region && findFocusTarget(region, [from.id])) ?? region)
        el?.focus({ preventScroll: true })
      }
      return
    }
    const el = postRef.current
    if (!el) return
    // Opened from within the page: move focus to the post so keyboard and screen reader users land in it.
    let focusFrame = 0
    if (!first) {
      if (!focusPostHeading(el)) focusFrame = window.requestAnimationFrame(() => focusPostHeading(el))
    }
    // A direct link keeps the collapsed timeline fully in view and only scrolls if the post starts below the fold.
    const stopScroll = first ? scrollToPost(el, false, true) : scrollToPost(el, !prefersReducedMotion())
    return () => {
      window.cancelAnimationFrame(focusFrame)
      stopScroll()
    }
  }, [pageKey])

  useEffect(() => {
    if (pageKey === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTypingTarget(e.target)) return
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
