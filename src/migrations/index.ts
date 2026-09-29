import * as migration_20260928_191803_initial from './20260928_191803_initial'
import * as migration_20260929_064237_entries from './20260929_064237_entries'

export const migrations = [
    {
        up: migration_20260928_191803_initial.up,
        down: migration_20260928_191803_initial.down,
        name: '20260928_191803_initial',
    },
    {
        up: migration_20260929_064237_entries.up,
        down: migration_20260929_064237_entries.down,
        name: '20260929_064237_entries',
    },
]
