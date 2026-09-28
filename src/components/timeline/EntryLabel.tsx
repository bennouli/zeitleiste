import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { POST_SEPARATOR, POST_SUFFIX } from './labelMetrics'

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
                'flex gap-[3px] text-left',
                side === 'above' ? 'flex-col' : 'flex-col-reverse'
            )}
        >
            <span
                className={clsx(
                    // The padding keeps the 4 px underline inside the box that truncation clips; the margin takes it back out of the layout.
                    '-mb-1 block truncate pb-1 font-serif text-[17px] leading-[1.1] text-fg',
                    open
                        ? 'font-medium underline decoration-1 underline-offset-4'
                        : 'font-normal'
                )}
            >
                {entry.title}
            </span>
            <span className="block small-caps leading-3 tracking-[0.1em] whitespace-nowrap text-fg-muted">
                {formatEntryDate(entry, 'short')}
                {entry.post && (
                    <span aria-hidden="true">
                        {POST_SEPARATOR}
                        <span className="font-medium text-fg underline underline-offset-3">
                            {POST_SUFFIX}
                        </span>
                    </span>
                )}
            </span>
        </span>
    )
}
