import type { Locale } from '@/i18n/locales'
import { messages } from '@/i18n/messages'
import type { Entry } from '@/lib/entry'
import { formatEntryDate } from '@/lib/format'

/** The title truncates here; a label is only wider when its date line is. */
export const LABEL_MAX_WIDTH_PX = 200
/** Title (20 px at line height 1.1), 3 px gap, date line (12 px). */
export const LABEL_HEIGHT_PX = 37
/** Between the date and the post label on the date line of an entry with a post. */
export const POST_SEPARATOR = ' · '
/** The chevron icon after the post label, as tall as the date line. */
export const POST_CHEVRON_SIZE_PX = 12
/** The chevron with its 2 px margin. */
const POST_CHEVRON_WIDTH_PX = POST_CHEVRON_SIZE_PX + 2

/** Advance of one title glyph (EB Garamond 20 px): the widest sample title measures 10.5 px per character. */
const TITLE_CHAR_WIDTH_PX = 10.5
/** Advance of one date-line glyph (IBM Plex Sans 12 px, uppercase, 0.1 em tracking): the widest sample date measures 8.4 px per character. */
const DATE_CHAR_WIDTH_PX = 8.4

/** Estimated rendered width of an entry's label: its truncated title or its date line, whichever is wider. */
export function estimateLabelWidthPx(entry: Entry, locale: Locale): number {
    const titleWidth = Math.min(
        entry.title.length * TITLE_CHAR_WIDTH_PX,
        LABEL_MAX_WIDTH_PX
    )
    return Math.max(titleWidth, dateLineWidthPx(entry, locale))
}

function dateLineWidthPx(entry: Entry, locale: Locale): number {
    const date = formatEntryDate(entry, 'short', locale)
    if (!entry.post) return date.length * DATE_CHAR_WIDTH_PX
    const dateLine = `${date}${POST_SEPARATOR}${messages[locale].post.label}`
    return dateLine.length * DATE_CHAR_WIDTH_PX + POST_CHEVRON_WIDTH_PX
}

export const PRIVATE_UNDER_TESTS = {
    TITLE_CHAR_WIDTH_PX,
    DATE_CHAR_WIDTH_PX,
    POST_CHEVRON_WIDTH_PX,
}
