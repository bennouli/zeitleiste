'use client'

import { usePostControls } from '@/components/PostContext'
import { CATEGORY_LABEL, REGION_LABEL, type Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import { X } from 'lucide-react'

/** Splits a plain-text post body into paragraphs at blank lines. */
function paragraphs(body: string): string[] {
    return body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
}

/** The post of an entry, shown below the collapsed timeline. */
export function Post({ entry }: { entry: Entry }) {
    const { close } = usePostControls()
    const titleId = `post-title-${entry.id}`

    return (
        <article
            aria-labelledby={titleId}
            className="relative mx-8 border-t border-border bg-surface text-fg"
        >
            <div className="mx-auto flex max-w-reading flex-col gap-4.5 pt-9 pb-16 font-serif">
                <p className="pr-8 small-caps text-meta font-medium tracking-meta text-fg-muted">
                    <span>{formatEntryDate(entry, 'long')}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, </span>
                    {CATEGORY_LABEL[entry.category]}
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, </span>
                    {REGION_LABEL[entry.region]}
                </p>
                {/* Focused by the shell when the post opens. */}
                <h2
                    id={titleId}
                    tabIndex={-1}
                    data-post-heading
                    className="text-post-title font-normal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                >
                    {entry.title}
                </h2>
                <p className="font-serif-italic text-lead italic">
                    {entry.summary}
                </p>
                {entry.post &&
                    paragraphs(entry.post.body).map((p, i) => (
                        <p key={i} className="text-body text-pretty">
                            {p}
                        </p>
                    ))}
            </div>
            <button
                type="button"
                onClick={close}
                aria-label="Beitrag schließen"
                title="Schließen"
                className="absolute top-5.5 right-0 size-7 text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
                <X
                    aria-hidden="true"
                    className="size-full"
                    strokeWidth={1.25}
                />
            </button>
        </article>
    )
}
