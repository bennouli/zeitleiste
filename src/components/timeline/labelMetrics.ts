import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'

/** The title truncates here; a label is only wider when its date line is. */
export const LABEL_MAX_WIDTH_PX = 170
/** Title (17 px × 1.1), 3 px gap, date line (12 px). */
export const LABEL_HEIGHT_PX = 34
/** Appended to the date line of an entry with a post, after `POST_SEPARATOR`. */
export const POST_SUFFIX = 'Beitrag ›'
export const POST_SEPARATOR = ' · '

/** Advance of one title glyph (EB Garamond 17 px): the widest sample title measures 9.0 px per character. */
const TITLE_CHAR_WIDTH_PX = 9
/** Advance of one date-line glyph (IBM Plex Sans 10 px, uppercase, 0.1 em tracking): the widest sample date measures 7.0 px per character. */
const DATE_CHAR_WIDTH_PX = 7

/** Estimated rendered width of an entry's label: its truncated title or its date line, whichever is wider. */
export function estimateLabelWidthPx(entry: Entry): number {
    const titleWidth = Math.min(
        entry.title.length * TITLE_CHAR_WIDTH_PX,
        LABEL_MAX_WIDTH_PX
    )
    return Math.max(titleWidth, dateLine(entry).length * DATE_CHAR_WIDTH_PX)
}

function dateLine(entry: Entry): string {
    const date = formatEntryDate(entry, 'short')
    return entry.post ? `${date}${POST_SEPARATOR}${POST_SUFFIX}` : date
}

export const PRIVATE_UNDER_TESTS = { TITLE_CHAR_WIDTH_PX, DATE_CHAR_WIDTH_PX }
