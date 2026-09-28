import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'

/** The title truncates here; a label is only wider when its date line is. */
export const LABEL_MAX_WIDTH_PX = 200
/** Title (20 px at line height 1.1), 3 px gap, date line (12 px). */
export const LABEL_HEIGHT_PX = 37
/** Appended to the date line of an entry with a post, after `POST_SEPARATOR` and before the chevron. */
export const POST_SUFFIX = 'Beitrag'
export const POST_SEPARATOR = ' · '
/** The chevron icon after `POST_SUFFIX`, as tall as the date line. */
export const POST_CHEVRON_SIZE_PX = 12
/** The chevron with its 2 px margin. */
const POST_CHEVRON_WIDTH_PX = POST_CHEVRON_SIZE_PX + 2

/** Advance of one title glyph (EB Garamond 20 px): the widest sample title measures 10.5 px per character. */
const TITLE_CHAR_WIDTH_PX = 10.5
/** Advance of one date-line glyph (IBM Plex Sans 12 px, uppercase, 0.1 em tracking): the widest sample date measures 8.4 px per character. */
const DATE_CHAR_WIDTH_PX = 8.4

/** Estimated rendered width of an entry's label: its truncated title or its date line, whichever is wider. */
export function estimateLabelWidthPx(entry: Entry): number {
    const titleWidth = Math.min(
        entry.title.length * TITLE_CHAR_WIDTH_PX,
        LABEL_MAX_WIDTH_PX
    )
    return Math.max(titleWidth, dateLineWidthPx(entry))
}

function dateLineWidthPx(entry: Entry): number {
    const date = formatEntryDate(entry, 'short')
    if (!entry.post) return date.length * DATE_CHAR_WIDTH_PX
    const dateLine = `${date}${POST_SEPARATOR}${POST_SUFFIX}`
    return dateLine.length * DATE_CHAR_WIDTH_PX + POST_CHEVRON_WIDTH_PX
}

export const PRIVATE_UNDER_TESTS = {
    TITLE_CHAR_WIDTH_PX,
    DATE_CHAR_WIDTH_PX,
    POST_CHEVRON_WIDTH_PX,
}
