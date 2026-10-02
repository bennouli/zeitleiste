import { slugify } from '@/lib/slug'
import { slugField, type Field } from 'payload'

/**
 * Payload's slug field, generated from `source` with German transliteration
 * until the editor unlocks it. Not `required`: the helper fills the slug in a
 * hook that runs after the required check, so a required slug fails every
 * save that leaves it to the helper. Unique per owner through the
 * collection's `uniquePerOwner` index, not globally.
 */
export function germanSlugField(source: string): Field {
    return slugField({
        useAsSlug: source,
        required: false,
        disableUnique: true,
        slugify: ({ valueToSlugify }) => slugOf(valueToSlugify),
    })
}

/** The slug of a source value; none for a missing or empty source, so drafts without a title don't all claim ''. */
function slugOf(sourceValue: unknown): string | undefined {
    const slug = typeof sourceValue === 'string' ? slugify(sourceValue) : ''
    return slug || undefined
}

export const PRIVATE_UNDER_TESTS = { slugOf }
