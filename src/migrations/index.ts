import * as migration_20260928_191803_initial from './20260928_191803_initial'
import * as migration_20260929_072911_entries from './20260929_072911_entries'
import * as migration_20260929_081446_posts from './20260929_081446_posts'

export const migrations = [
    {
        up: migration_20260928_191803_initial.up,
        down: migration_20260928_191803_initial.down,
        name: '20260928_191803_initial',
    },
    {
        up: migration_20260929_072911_entries.up,
        down: migration_20260929_072911_entries.down,
        name: '20260929_072911_entries',
    },
    {
        up: migration_20260929_081446_posts.up,
        down: migration_20260929_081446_posts.down,
        name: '20260929_081446_posts',
    },
]
