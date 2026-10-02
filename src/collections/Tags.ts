import type { CollectionConfig } from 'payload'
import { ownerField, uniquePerOwner } from './ownership'
import { germanSlugField } from './slugField'
import { ownedAccess } from './userAccess'

export const Tags: CollectionConfig = {
    slug: 'tags',
    labels: { singular: 'Schlagwort', plural: 'Schlagwörter' },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'kind', 'slug'],
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
