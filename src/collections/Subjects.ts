import type { CollectionConfig } from 'payload'
import { slugField } from './slugField'

export const Subjects: CollectionConfig = {
    slug: 'subjects',
    labels: { singular: 'Thema', plural: 'Themen' },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'slug'],
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
            localized: true,
        },
        slugField('name'),
        {
            name: 'summary',
            type: 'textarea',
            label: 'Zusammenfassung',
            localized: true,
        },
    ],
}
