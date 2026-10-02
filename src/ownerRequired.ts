import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { check } from '@payloadcms/db-postgres/drizzle/pg-core'

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number]

const DRAFTED_OWNER_COLUMNS = [
    { table: 'entries', column: 'owner', constraint: 'entries_owner_required' },
    {
        table: '_entries_v',
        column: 'version_owner',
        constraint: '_entries_v_version_owner_required',
    },
] as const

export const requireOwnerOnDraftedTables: SchemaHook = ({
    schema,
    extendTable,
}) => {
    for (const { table, column, constraint } of DRAFTED_OWNER_COLUMNS) {
        const draftedTable = schema.tables[table]
        const ownerColumn = draftedTable?.[column]
        if (draftedTable === undefined || ownerColumn === undefined)
            throw new Error(`${table}.${column} is missing from the schema`)
        extendTable({
            table: draftedTable,
            extraConfig: () => ({
                [constraint]: check(
                    constraint,
                    sql`${ownerColumn} IS NOT NULL`
                ),
            }),
        })
    }
    return schema
}
