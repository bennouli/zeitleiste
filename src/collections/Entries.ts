import {
    ENTRY_TYPE_LABEL,
    ENTRY_TYPES,
    PRECISIONS,
    type Precision,
} from '@/lib/entry'
import type {
    CollectionConfig,
    DateField,
    RelationshipFieldValidation,
    SelectField,
} from 'payload'
import { date, relationship, select } from 'payload/shared'
import {
    endPrecisionProblem,
    endProblem,
    entryDatesOf,
    partOfProblem,
    precisionProblem,
    type EntryDates,
} from './entryValidation'
import { slugField } from './slugField'

const PRECISION_LABEL: Record<Precision, string> = {
    year: 'Jahr',
    month: 'Monat',
    day: 'Tag',
}

const PRECISION_OPTIONS = PRECISIONS.map((value) => ({
    label: PRECISION_LABEL[value],
    value,
}))

const DATE_ADMIN: DateField['admin'] = {
    date: { pickerAppearance: 'dayOnly', displayFormat: 'd. MMM yyyy' },
}

const atPrecision: SelectField = {
    name: 'atPrecision',
    type: 'select',
    label: 'Genauigkeit',
    required: true,
    options: PRECISION_OPTIONS,
    validate: (value, args) =>
        precisionProblem(entryDatesOf(args.siblingData).at, value) ??
        select(value, args),
}

const endedAtPrecision: SelectField = {
    name: 'endedAtPrecision',
    type: 'select',
    label: 'Genauigkeit des Endes',
    options: PRECISION_OPTIONS,
    admin: {
        condition: (_, siblingData) => Boolean(siblingData.endedAt),
    },
    validate: (value, args) => {
        const dates: EntryDates = {
            ...entryDatesOf(args.siblingData),
            endedAtPrecision: value,
        }
        return (
            endPrecisionProblem(dates) ??
            precisionProblem(dates.endedAt, dates.endedAtPrecision) ??
            select(value, args)
        )
    },
}

const notPartOfItself: RelationshipFieldValidation = (value, args) =>
    partOfProblem(value, args.id) ?? relationship(value, args)

export const Entries: CollectionConfig = {
    slug: 'entries',
    labels: { singular: 'Eintrag', plural: 'Einträge' },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'at', 'type', '_status'],
    },
    access: {
        read: () => true,
    },
    versions: {
        drafts: true,
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            label: 'Titel',
            required: true,
            localized: true,
        },
        slugField('title'),
        {
            name: 'summary',
            type: 'textarea',
            label: 'Zusammenfassung',
            required: true,
            localized: true,
            admin: {
                description:
                    'Hinweis beim Überfahren und Vorspann des Beitrags.',
            },
        },
        {
            type: 'row',
            fields: [
                {
                    name: 'at',
                    type: 'date',
                    label: 'Beginn',
                    required: true,
                    admin: DATE_ADMIN,
                },
                atPrecision,
            ],
        },
        {
            type: 'row',
            fields: [
                {
                    name: 'endedAt',
                    type: 'date',
                    label: 'Ende',
                    admin: DATE_ADMIN,
                    validate: (value, args) =>
                        endProblem({
                            ...entryDatesOf(args.siblingData),
                            endedAt: value,
                        }) ?? date(value, args),
                },
                endedAtPrecision,
            ],
        },
        {
            name: 'ongoing',
            type: 'checkbox',
            label: 'Dauert an',
            admin: {
                description:
                    'Die Spanne reicht bis heute; schließt ein Ende aus.',
            },
        },
        {
            name: 'type',
            type: 'select',
            label: 'Art',
            required: true,
            options: ENTRY_TYPES.map((value) => ({
                label: ENTRY_TYPE_LABEL[value],
                value,
            })),
        },
        {
            name: 'subject',
            type: 'relationship',
            label: 'Thema',
            relationTo: 'subjects',
        },
        {
            name: 'tags',
            type: 'relationship',
            label: 'Schlagwörter',
            relationTo: 'tags',
            hasMany: true,
        },
        {
            name: 'partOf',
            type: 'relationship',
            label: 'Teil von',
            relationTo: 'entries',
            filterOptions: ({ id }) =>
                id === undefined ? true : { id: { not_equals: id } },
            validate: notPartOfItself,
        },
    ],
}
