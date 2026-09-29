import type { EntryType } from '@/lib/entry'
import { de } from './de'
import { en } from './en'
import type { Locale } from './locales'

/** Every interface text of the site in one language; grammar that depends on a number is a function. */
export type Messages = {
    site: {
        /** Wordmark, page title and the timeline's accessible name. */
        name: string
        description: string
        heading: string
        postTitle: (title: string) => string
    }
    notFound: {
        heading: string
        text: string
        back: string
    }
    timeline: {
        help: string
        zoomIn: string
        zoomOut: string
        today: string
        stackUp: string
        stackDown: string
        groupHint: string
    }
    post: {
        /** After an entry's date when the entry has a post. */
        label: string
        close: string
        closeShort: string
    }
    since: string
    entryType: Record<EntryType, string>
    group: string
    groupName: (count: number, years: string) => string
    groupMeta: (count: number, years: string) => string
    /** `ordinal` counts from one. */
    position: (ordinal: number, count: number) => string
    invitation: {
        pageTitle: string
        heading: string
        intro: string
        password: string
        passwordRepeat: string
        submit: string
        submitting: string
        mismatch: string
        missing: string
        unusable: string
        failed: string
        accepted: string
        login: string
    }
}

export const messages: Record<Locale, Messages> = { de, en }

/** The Intl locale each site locale formats dates with; British English writes "7 November 1917". */
export const INTL_LOCALE: Record<Locale, string> = { de: 'de', en: 'en-GB' }
