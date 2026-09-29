import { DEFAULT_LOCALE } from '@/i18n/locales'
import { slugify } from '@/lib/slug'
import { slugField, type Field } from 'payload'
import type { Slugify } from 'payload/shared'

/**
 * Payload's slug field, generated from `source` with German transliteration
 * until the editor unlocks it. Not `required`: the helper fills the slug in a
 * hook that runs after the required check, so a required slug fails every
 * save that leaves it to the helper.
 */
export function germanSlugField(source: string): Field {
    return slugField({
        useAsSlug: source,
        required: false,
        slugify: slugOnSave,
    })
}

/**
 * The slug a save stores. Only a German save derives it from the source; any
 * other locale keeps the slug the entry already has, and only an entry
 * created in that locale without one takes it from the source.
 */
const slugOnSave: Slugify = ({ data, req, valueToSlugify }) =>
    req.locale === DEFAULT_LOCALE
        ? slugOf(valueToSlugify)
        : (slugOf(data.slug) ?? slugOf(valueToSlugify))

/** The slug of a source value; none for a missing or empty source, so drafts without a title don't all claim ''. */
function slugOf(sourceValue: unknown): string | undefined {
    const slug = typeof sourceValue === 'string' ? slugify(sourceValue) : ''
    return slug || undefined
}

export const PRIVATE_UNDER_TESTS = { slugOf, slugOnSave }
