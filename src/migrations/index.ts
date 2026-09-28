import * as migration_20260928_191803_initial from './20260928_191803_initial'

export const migrations = [
    {
        up: migration_20260928_191803_initial.up,
        down: migration_20260928_191803_initial.down,
        name: '20260928_191803_initial',
    },
]
