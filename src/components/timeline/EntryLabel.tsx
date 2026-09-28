import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { LABEL_MAX_WIDTH_PX, POST_SEPARATOR, POST_SUFFIX } from './labelMetrics'

export type EntryLabelProps = {
    entry: Entry
    /** Above the axis the title sits over the date, below it under the date, so the date stays nearest the axis. */
    side: Side
    /** The entry whose post is open. */
    open?: boolean
}

/** An entry set as type: its serif title and a small-caps date line. Presentational; the caller makes it focusable. */
export function EntryLabel({ entry, side, open = false }: EntryLabelProps) {
    return (
        <span
            className={clsx(
                'flex gap-0.75 text-left',
                side === 'above' ? 'flex-col' : 'flex-col-reverse'
            )}
        >
            <span
                className={clsx(
                    // The padding keeps the 4 px underline inside the box that truncation clips; the margin takes it back out of the layout.
                    '-mb-1 block truncate pb-1 font-serif text-entry text-fg',
                    open
                        ? 'font-medium underline decoration-1 underline-offset-4'
                        : 'font-normal'
                )}
                style={{ maxWidth: LABEL_MAX_WIDTH_PX }}
            >
                {entry.title}
            </span>
            <span className="block small-caps leading-3 tracking-date whitespace-nowrap text-fg-muted">
                {formatEntryDate(entry, 'short')}
                {entry.post && (
                    <span aria-hidden="true">
                        {POST_SEPARATOR}
                        <span className="font-medium text-fg">
                            <span className="underline underline-offset-3">
                                {POST_SUFFIX}
                            </span>
                            <Chevron />
                        </span>
                    </span>
                )}
            </span>
        </span>
    )
}

/** Points right; as tall as the date line's capitals. */
function Chevron() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-1 inline-block size-1.75 align-baseline"
        >
            <path d="M2.5 1l3 3-3 3" />
        </svg>
    )
}
