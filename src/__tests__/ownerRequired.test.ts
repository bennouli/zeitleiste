import { integer, pgTable } from '@payloadcms/db-postgres/drizzle/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { requireOwnerOnDraftedTables } from '../ownerRequired'

const ENTRIES = pgTable('entries', { owner: integer('owner_id') })
const ENTRY_VERSIONS = pgTable('_entries_v', {
    version_owner: integer('version_owner_id'),
})

const hookArgs = (tables: object) => {
    const extendTable = vi.fn()
    const schema = { tables }
    return {
        extendTable,
        schema,
        args: { schema, extendTable, adapter: {} } as never,
    }
}

describe('requireOwnerOnDraftedTables', () => {
    it('adds an owner check to entries and their versions', async () => {
        const tables = { entries: ENTRIES, _entries_v: ENTRY_VERSIONS }
        const { args, extendTable, schema } = hookArgs(tables)

        expect(await requireOwnerOnDraftedTables(args)).toBe(schema)

        const constraintsByTable = extendTable.mock.calls.map(
            ([{ table, extraConfig }]) => [
                table,
                Object.keys(extraConfig(table)),
            ]
        )
        expect(constraintsByTable).toEqual([
            [ENTRIES, ['entries_owner_required']],
            [ENTRY_VERSIONS, ['_entries_v_version_owner_required']],
        ])
    })

    it('refuses a schema whose entries have no owner column', () => {
        const ownerless = pgTable('entries', { title: integer('title') })
        const tables = { entries: ownerless, _entries_v: ENTRY_VERSIONS }
        const { args } = hookArgs(tables)

        expect(() => requireOwnerOnDraftedTables(args)).toThrow(
            'entries.owner is missing from the schema'
        )
    })
})
