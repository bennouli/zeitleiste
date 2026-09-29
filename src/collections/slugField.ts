import { SLUG_PATTERN, slugify } from '@/lib/slug'
import type { TextField } from 'payload'
import { text } from 'payload/shared'

/** A unique slug, filled from `source` while empty and left alone once set. */
export function slugField(source: string): TextField {
    return {
        name: 'slug',
        type: 'text',
        label: 'Slug',
        required: true,
        unique: true,
        index: true,
        admin: {
            position: 'sidebar',
            description:
                'Wird beim ersten Speichern erzeugt, wenn das Feld leer ist; danach frei änderbar.',
        },
        hooks: {
            beforeValidate: [
                ({ value, data }) =>
                    value || slugify(String(data?.[source] ?? '')) || value,
            ],
        },
        validate: (value, args) =>
            value && !SLUG_PATTERN.test(value)
                ? 'Nur Kleinbuchstaben a–z und Ziffern, getrennt durch einzelne Bindestriche.'
                : text(value, args),
    }
}
