import * as migration_20260928_191803_initial from './20260928_191803_initial'
import * as migration_20260929_072911_entries from './20260929_072911_entries'
import * as migration_20260929_081446_posts from './20260929_081446_posts'
import * as migration_20260929_090007_invite_editors from './20260929_090007_invite_editors'
import * as migration_20260929_095427_entry_languages from './20260929_095427_entry_languages'
import * as migration_20260930_064021_media from './20260930_064021_media'
import * as migration_20261002_032942_single_language from './20261002_032942_single_language'
import * as migration_20261002_044852_notes from './20261002_044852_notes'
import * as migration_20261002_110109_content_owner from './20261002_110109_content_owner'
import * as migration_20261002_154114_entry_owner_required from './20261002_154114_entry_owner_required'
import * as migration_20261002_173309_post_sources from './20261002_173309_post_sources'

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
    {
        up: migration_20260929_090007_invite_editors.up,
        down: migration_20260929_090007_invite_editors.down,
        name: '20260929_090007_invite_editors',
    },
    {
        up: migration_20260929_095427_entry_languages.up,
        down: migration_20260929_095427_entry_languages.down,
        name: '20260929_095427_entry_languages',
    },
    {
        up: migration_20260930_064021_media.up,
        down: migration_20260930_064021_media.down,
        name: '20260930_064021_media',
    },
    {
        up: migration_20261002_032942_single_language.up,
        down: migration_20261002_032942_single_language.down,
        name: '20261002_032942_single_language',
    },
    {
        up: migration_20261002_044852_notes.up,
        down: migration_20261002_044852_notes.down,
        name: '20261002_044852_notes',
    },
    {
        up: migration_20261002_110109_content_owner.up,
        down: migration_20261002_110109_content_owner.down,
        name: '20261002_110109_content_owner',
    },
    {
        up: migration_20261002_154114_entry_owner_required.up,
        down: migration_20261002_154114_entry_owner_required.down,
        name: '20261002_154114_entry_owner_required',
    },
    {
        up: migration_20261002_173309_post_sources.up,
        down: migration_20261002_173309_post_sources.down,
        name: '20261002_173309_post_sources',
    },
]
