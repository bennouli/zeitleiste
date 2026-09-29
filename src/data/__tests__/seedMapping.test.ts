import type { Entry, HDate } from '@/lib/entry'
import { describe, expect, it } from 'vitest'
import { entries } from '../entries'
import {
    seedEntryOf,
    tagKindOf,
    tagNamesOf,
    type EntryFields,
    type SeedEntry,
} from '../seedMapping'

function dateOf(
    year: number | undefined,
    month: number | undefined,
    day: number | undefined
): HDate | undefined {
    if (year === undefined) return undefined
    return {
        year,
        ...(month !== undefined && { month }),
        ...(day !== undefined && { day }),
    }
}

function endOf(fields: EntryFields, ongoing: boolean): Entry['end'] {
    return ongoing
        ? 'ongoing'
        : dateOf(fields.endYear, fields.endMonth, fields.endDay)
}

function entryOf(seedEntry: SeedEntry): Entry {
    const { fields } = seedEntry
    const end = endOf(fields, seedEntry.fields.ongoing)
    return {
        id: fields.slug,
        title: fields.title,
        summary: fields.summary,
        start: dateOf(fields.startYear, fields.startMonth, fields.startDay)!,
        ...(end !== undefined && { end }),
        type: fields.type,
        tags: seedEntry.tagNames,
        ...(seedEntry.subjectSlug !== undefined && {
            subject: seedEntry.subjectSlug,
        }),
        ...(seedEntry.partOfSlug !== undefined && {
            partOf: seedEntry.partOfSlug,
        }),
        ...(seedEntry.postBody !== undefined && {
            post: { body: seedEntry.postBody },
        }),
    }
}

function sampleEntry(id: string): Entry {
    return entries.find((e) => e.id === id)!
}

describe('seedEntryOf', () => {
    it('keeps every field of every sample entry', () => {
        const roundTrips = entries.map((e) => entryOf(seedEntryOf(e)))

        expect(roundTrips).toEqual(entries)
    })

    it('gives a point in time no end and does not mark it ongoing', () => {
        const pointInTime = sampleEntry('dekabristenaufstand')

        expect(seedEntryOf(pointInTime).fields).toMatchObject({
            startYear: 1825,
            startMonth: 12,
            startDay: 26,
            endYear: undefined,
            endMonth: undefined,
            endDay: undefined,
            ongoing: false,
        })
    })

    it('fills only the end parts the sample gives', () => {
        const endingInAMonth = sampleEntry('russlandfeldzug-1812')

        expect(seedEntryOf(endingInAMonth).fields).toMatchObject({
            endYear: 1812,
            endMonth: 12,
            endDay: undefined,
            ongoing: false,
        })
    })

    it('marks an ongoing entry ongoing, without an end', () => {
        const ongoingEntry = sampleEntry(
            'russischer-angriffskrieg-gegen-die-ukraine'
        )

        expect(seedEntryOf(ongoingEntry).fields).toMatchObject({
            endYear: undefined,
            ongoing: true,
        })
    })

    it('uses the sample id as the slug', () => {
        const slugDifferingFromTitle = sampleEntry('katharina-die-grosse')

        expect(seedEntryOf(slugDifferingFromTitle).fields.slug).toBe(
            'katharina-die-grosse'
        )
    })

    it('keeps tag names in the editor’s order', () => {
        const manyTags = sampleEntry('wiener-kongress')

        expect(seedEntryOf(manyTags).tagNames).toEqual([
            'Russland',
            'Österreich',
            'Preußen',
            'Großbritannien',
        ])
    })

    it('carries a post body only for the three entries with a post', () => {
        const withPost = entries
            .map(seedEntryOf)
            .filter((e) => e.postBody !== undefined)
            .map((e) => e.fields.slug)

        expect(withPost).toEqual([
            'oktoberrevolution',
            'kubakrise',
            'fall-der-berliner-mauer',
        ])
    })
})

describe('tagNamesOf', () => {
    it('lists each tag once, in order of first use', () => {
        const seedEntries = [
            { tagNames: ['Russland', 'Schweden'] },
            { tagNames: ['Frankreich', 'Russland'] },
        ].map((e) => ({ ...seedEntryOf(entries[0]!), ...e }))

        expect(tagNamesOf(seedEntries)).toEqual([
            'Russland',
            'Schweden',
            'Frankreich',
        ])
    })
})

describe('tagKindOf', () => {
    it('makes cities and regions places', () => {
        const places = ['Sankt Petersburg', 'Berlin', 'Krim']

        expect(places.map(tagKindOf)).toEqual(['place', 'place', 'place'])
    })

    it('makes states and alliances actors', () => {
        const actors = ['Russland', 'NATO', 'DDR', 'Kuba']

        expect(actors.map(tagKindOf)).toEqual([
            'actor',
            'actor',
            'actor',
            'actor',
        ])
    })
})
