import type { EntryType } from '@/lib/entry'
import { de } from './de'
import { en } from './en'
import type { Locale } from './locales'

export type Messages = {
    site: {
        /** Wordmark and page title. */
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
        /** The timeline region's accessible name: what it is, not the brand. */
        regionLabel: string
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
    login: {
        pageTitle: string
        heading: string
        intro: string
        email: string
        password: string
        submit: string
        submitting: string
        invalid: string
        failed: string
    }
    notes: {
        heading: string
        editorLabel: string
        textLabel: string
        placeholder: string
        save: string
        saving: string
        saveHint: string
        cancel: string
        edit: string
        editLabel: (title: string) => string
        delete: string
        deleteLabel: (title: string) => string
        link: string
        linkLabel: (title: string) => string
        linkedEntry: string
        unlinkLabel: (entryTitle: string) => string
        entrySearch: string
        entrySearchHint: string
        entrySearching: string
        entriesFound: (count: number) => string
        noEntryFound: string
        entrySearchFailed: string
        confirmDelete: string
        showAll: string
        showLess: string
        untitled: string
        collapse: string
        expand: string
        open: string
        close: string
        failed: Record<
            'save' | 'link' | 'delete' | 'load' | 'signedOut',
            string
        >
    }
}

export const messages: Record<Locale, Messages> = { de, en }

export const INTL_LOCALE: Record<Locale, string> = { de: 'de', en: 'en-GB' }
