import { useI18n } from '@/components/I18nContext'
import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import {
    LABEL_MAX_WIDTH_PX,
    POST_CHEVRON_SIZE_PX,
    POST_SEPARATOR,
} from './labelMetrics'

export type EntryLabelProps = {
    entry: Entry
    /** Above the axis the title sits over the date, below it under the date, so the date stays nearest the axis. */
    side: Side
    /** The entry whose post is open. */
    open?: boolean
}

/** An entry set as type: its serif title and a small-caps date line. Presentational; the caller makes it focusable. */
export function EntryLabel({ entry, side, open = false }: EntryLabelProps) {
    const { locale, t } = useI18n()
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
            <span className="block small-caps text-label leading-3 tracking-date whitespace-nowrap text-fg-muted">
                {formatEntryDate(entry, 'short', locale)}
                {entry.post && (
                    <span aria-hidden="true">
                        {POST_SEPARATOR}
                        <span className="font-medium text-fg">
                            <span className="underline underline-offset-3">
                                {t.post.label}
                            </span>
                            <ChevronRight
                                aria-hidden="true"
                                size={POST_CHEVRON_SIZE_PX}
                                strokeWidth={2.5}
                                className="relative top-px ml-0.5 inline-block align-baseline"
                            />
                        </span>
                    </span>
                )}
            </span>
        </span>
    )
}
