import { IS_BOLD, IS_ITALIC } from '@payloadcms/richtext-lexical/lexical'

export const LINK_CLASS =
    'underline decoration-fg-muted underline-offset-2 hover:decoration-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const BOLD_CLASS = 'font-medium'

export const ITALIC_CLASS = 'font-serif-italic italic'

/** A text run with the site's bold and italic. */
export function formattedText(text: string, format: number) {
    const slantedText =
        format & IS_ITALIC ? <em className={ITALIC_CLASS}>{text}</em> : text
    return format & IS_BOLD ? (
        <strong className={BOLD_CLASS}>{slantedText}</strong>
    ) : (
        slantedText
    )
}
