'use client'

import { usePostControls } from '@/components/PostContext'
import { CATEGORY_LABEL, REGION_LABEL, type Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'

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
            className="mx-auto max-w-prose bg-surface px-4 pt-8 pb-[60vh] text-fg sm:px-6"
        >
            <header className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    {/* Focused by the shell when the post opens. */}
                    <h2
                        id={titleId}
                        tabIndex={-1}
                        data-post-heading
                        className="rounded-sm font-serif text-3xl leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                    >
                        {entry.title}
                    </h2>
                    <p className="mt-2 text-sm text-fg-muted">
                        <span>{formatEntryDate(entry, 'long')}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                        {CATEGORY_LABEL[entry.category]}
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                        {REGION_LABEL[entry.region]}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={close}
                    aria-label="Beitrag schließen"
                    title="Schließen"
                    className="-mt-1 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-fg-muted hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
                >
                    <span aria-hidden="true">×</span>
                </button>
            </header>
            <p className="mt-6 text-lg leading-relaxed">{entry.summary}</p>
            {entry.post && (
                <div className="mt-6 space-y-4 font-serif text-base leading-relaxed">
                    {paragraphs(entry.post.body).map((p, i) => (
                        <p key={i}>{p}</p>
                    ))}
                </div>
            )}
        </article>
    )
}
