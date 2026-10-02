import { ENTRY_TYPE_LABEL, ENTRY_TYPES } from '@/lib/entry'
import type {
    CheckboxFieldValidation,
    CollectionConfig,
    DateField,
    NumberField,
    NumberFieldValidation,
    RelationshipFieldValidation,
    RowField,
} from 'payload'
import { checkbox, number, relationship } from 'payload/shared'
import {
    datePartsOf,
    datePartsOnSave,
    dayProblem,
    endAtOf,
    endBeforeStartProblem,
    endYearProblem,
    ongoingProblem,
    partOfProblem,
    startAtOf,
    wholeNumberProblem,
    type EntryDateParts,
    type Side,
} from './entryDates'
import { revalidateEntryChange, revalidateEntryDelete } from './revalidate'
import { germanSlugField } from './slugField'

const SIDE_LABEL: Record<Side, string> = { start: 'Beginn', end: 'Ende' }

/** Payload's number check, after the date-part rules that apply to this field. */
function numberAfter(
    ...problems: ((parts: EntryDateParts) => string | undefined)[]
): NumberFieldValidation {
    return (value, args) => {
        const parts = datePartsOf(args.siblingData)
        return (
            wholeNumberProblem(value) ??
            problems.map((problem) => problem(parts)).find(Boolean) ??
            number(value, args)
        )
    }
}

function datePartsRow(side: Side): RowField {
    const year: NumberField = {
        name: `${side}Year`,
        type: 'number',
        label: `${SIDE_LABEL[side]}: Jahr`,
        required: side === 'start',
        min: 1,
        validate:
            side === 'start'
                ? numberAfter()
                : numberAfter(endYearProblem, endBeforeStartProblem),
    }
    const month: NumberField = {
        name: `${side}Month`,
        type: 'number',
        label: `${SIDE_LABEL[side]}: Monat`,
        min: 1,
        max: 12,
        validate: numberAfter(),
    }
    const day: NumberField = {
        name: `${side}Day`,
        type: 'number',
        label: `${SIDE_LABEL[side]}: Tag`,
        min: 1,
        max: 31,
        validate: numberAfter((parts) => dayProblem(parts, side)),
    }
    return { type: 'row', fields: [year, month, day] }
}

/** A stored timestamp derived from the date parts on every save; never edited. */
function derivedTimestamp(
    name: string,
    derive: (parts: EntryDateParts) => string | undefined
): DateField {
    return {
        name,
        type: 'date',
        index: true,
        admin: { hidden: true },
        hooks: {
            beforeChange: [
                ({ previousSiblingDoc, siblingData }) =>
                    derive(datePartsOnSave(previousSiblingDoc, siblingData)) ??
                    null,
            ],
        },
    }
}

const notOngoingWithEnd: CheckboxFieldValidation = (value, args) =>
    ongoingProblem(datePartsOf(args.siblingData)) ?? checkbox(value, args)

const notPartOfItself: RelationshipFieldValidation = (value, args) =>
    partOfProblem(value, args.id) ?? relationship(value, args)

export const Entries: CollectionConfig = {
    slug: 'entries',
    labels: { singular: 'Eintrag', plural: 'Einträge' },
    defaultSort: 'startAt',
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'startYear', 'type', '_status'],
    },
    access: {
        read: ({ req }) =>
            req.user ? true : { _status: { equals: 'published' } },
    },
    versions: {
        drafts: true,
    },
    hooks: {
        afterChange: [revalidateEntryChange],
        afterDelete: [revalidateEntryDelete],
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            label: 'Titel',
            required: true,
        },
        germanSlugField('title'),
        {
            name: 'summary',
            type: 'textarea',
            label: 'Zusammenfassung',
            required: true,
            admin: {
                description:
                    'Hinweis beim Überfahren und Vorspann des Beitrags.',
            },
        },
        datePartsRow('start'),
        datePartsRow('end'),
        {
            name: 'ongoing',
            type: 'checkbox',
            label: 'Dauert an',
            validate: notOngoingWithEnd,
            admin: {
                description:
                    'Die Spanne reicht bis heute; schließt ein Ende aus.',
            },
        },
        derivedTimestamp('startAt', startAtOf),
        derivedTimestamp('endAt', endAtOf),
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
        {
            name: 'post',
            type: 'relationship',
            label: 'Beitrag',
            relationTo: 'posts',
        },
    ],
}
