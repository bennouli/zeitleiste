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
cp .env.example .env.local   # fill in both variables, see below
pnpm dev
```

The timeline runs at http://localhost:3000, the admin at http://localhost:3000/admin. On the first visit the admin asks you to create the
first user.

### Development database

The database is Postgres on Neon. Production has its own branch; local development runs on a personal branch, so production data stays
untouched and no Docker is needed.

1. In the [Neon Console](https://console.neon.tech), open the project and go to **Branches** → **Create branch**. Name it after yourself
   (`dev-<name>`) and pick the production branch as its parent. The new branch starts as a copy of the parent's data; nothing you do on it
   reaches the parent.
2. On the branch, click **Connect** and copy the connection string into `DATABASE_URL` in `.env.local`.

With the Neon CLI instead: `neon branches create --name dev-<name>`, then `neon connection-string dev-<name>`.

In development, Payload pushes the schema straight into this branch whenever the Payload config changes: treat the branch as a sandbox, and
reset or recreate it from its parent when it gets in the way.

### Schema changes and production

Production never receives a pushed schema. Every change to the Payload config that touches the database needs a migration:

```bash
pnpm payload migrate:create <name>   # writes src/migrations/<timestamp>_<name>.ts, commit it
pnpm payload generate:types          # refreshes src/payload-types.ts, commit it
```

Never run `pnpm payload migrate` against your development branch; push and migrations do not mix on one database. The production build runs
`pnpm run ci` (`payload migrate && pnpm build`), which applies pending migrations before building.

## License

The code is licensed under the [MIT License](LICENSE.md).

The texts of the timeline entries and posts (titles, summaries, articles and the sample data in this repository) are © 2026 Benno Selig, all
rights reserved. They are not covered by the MIT License.
