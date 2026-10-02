import type { CollectionConfig } from 'payload'
import { ownerField, uniquePerOwner } from './ownership'
import { germanSlugField } from './slugField'
import { ownedAccess } from './userAccess'

export const Subjects: CollectionConfig = {
    slug: 'subjects',
    labels: { singular: 'Thema', plural: 'Themen' },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'slug'],
    },
    access: ownedAccess(true),
    indexes: uniquePerOwner('name', 'slug'),
    fields: [
        ownerField,
        {
            name: 'name',
            type: 'text',
            label: 'Name',
            required: true,
        },
        germanSlugField('name'),
        {
            name: 'summary',
            type: 'textarea',
            label: 'Zusammenfassung',
        },
    ],
}
