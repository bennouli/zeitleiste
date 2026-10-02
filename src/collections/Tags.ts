import type { CollectionConfig } from 'payload'
import { germanSlugField } from './slugField'

export const Tags: CollectionConfig = {
    slug: 'tags',
    labels: { singular: 'Schlagwort', plural: 'Schlagwörter' },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'kind', 'slug'],
    },
    access: {
        read: () => true,
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            label: 'Name',
            required: true,
            unique: true,
        },
        germanSlugField('name'),
        {
            name: 'kind',
            type: 'select',
            label: 'Art',
            required: true,
            options: [
                { label: 'Akteur', value: 'actor' },
                { label: 'Ort', value: 'place' },
            ],
        },
    ],
}
