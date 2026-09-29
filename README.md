# Zeitleiste

An interactive timeline of Russian, Soviet and Western history from 1700 to today: wars, revolutions and changes of power. Entries are
points in time or spans. Each one has a title and a short summary, and optionally a blog-style post that opens below the timeline. The site
is available in German and English, and editors maintain the content in a small admin area.

Status: in planning. Work is tracked in the [issues](https://github.com/bennouli/zeitleiste/issues), written as described in
[ISSUES.md](ISSUES.md).

## Planned stack

Next.js with Payload CMS, Postgres, Tailwind CSS, hosted on Vercel. Email goes out through Scaleway Transactional Email.

## Development

Requires Node.js 20.9 or newer and pnpm.

```bash
git clone https://github.com/bennouli/zeitleiste.git && cd zeitleiste
pnpm install
cp .env.example .env.local   # DATABASE_URL of the dev branch, a PAYLOAD_SECRET (openssl rand -hex 32)
pnpm dev
```

The timeline runs at http://localhost:3000, the admin at http://localhost:3000/admin. On the first visit the admin asks you to create the
first user.

### Databases

Postgres on Neon, one project with three branches. Branches persist; they are reset, never recreated.

| Branch       | Managed by                 | Used by                                | Connection string lives in     |
| ------------ | -------------------------- | -------------------------------------- | ------------------------------ |
| `production` | migrations (`pnpm run ci`) | the deployed site                      | Vercel, Production environment |
| `preview`    | migrations (`pnpm run ci`) | Vercel preview deployments of every PR | Vercel, Preview environment    |
| `dev`        | push (`pnpm dev`)          | local development                      | `.env.local`                   |

`preview` and `dev` are children of `production`. A branch is either push-managed or migration-managed, never both: `pnpm dev` alters the
`dev` branch directly from the Payload config, the two Vercel branches only ever receive committed migrations. Nothing on a developer
machine points at `production`.

Get a connection string in the [Neon Console](https://console.neon.tech) under **Branches** → the branch → **Connect**, or with the Neon
CLI: `neon connection-string <branch>`. The Vercel branches use the direct host, without `-pooler`, because they run migrations. Vercel's
Build Command is `pnpm run ci`.

### Changing the schema

1. Edit the collection under `src/collections/`.
2. `pnpm dev`. Payload pushes the change into the `dev` branch on boot; iterate until the admin looks right.
3. `pnpm payload migrate:create <name>` writes `src/migrations/<timestamp>_<name>.ts`. It diffs against the last committed migration, not
   against the `dev` branch.
4. `pnpm payload generate:types` refreshes `src/payload-types.ts`.
5. Commit collection, migration and types together, in the PR of the change.

The PR's preview deployment applies the migration to the `preview` branch. Merging to `main` applies it to `production` during the build,
once, recorded in `payload_migrations`.

Never run `pnpm payload migrate` or `next dev` against a migration-managed branch. `pnpm payload migrate` on the `dev` branch stops at a
prompt about push mode; answer no.

When a branch drifts — `preview` after two PRs with different migrations, `dev` after experiments — reset it from its parent in the Neon
Console (**Branches** → the branch → **Reset from parent**). The first `pnpm dev` after resetting `dev` asks once before switching the
branch back to push mode.

Content typed into a local `/admin` lands on the `dev` branch and stays there. Real content is entered on the deployed admin.

## License

The code is licensed under the [MIT License](LICENSE.md).

The texts of the timeline entries and posts (titles, summaries, articles and the sample data in this repository) are © 2026 Benno Selig, all
rights reserved. They are not covered by the MIT License.
