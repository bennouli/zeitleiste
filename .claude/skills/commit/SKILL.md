---
name: commit
description:
    Use before writing any git commit in this repo — a code commit on a branch, a docs change onto staging. Supplies the message format, the
    trailer rule, what a single commit may contain, what may never be staged, and which branch each artifact belongs on.
---

# Commit

Every commit in this repo goes through here. The rules below are not style preferences — each one is here because it was got wrong at least
once.

## Only when asked

Never commit unprompted. Finishing a piece of work is not a request to commit it. If it is unclear whether the owner wants a commit, ask.

## The message

**Conventional Commits**: `<type>(<scope>): <description>`.

- Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`, `ci`.
- Scope is optional, used when it clarifies the area — `feat(timeline):`, `fix(post):`, `docs(issues):`, `chore(deps):`.
- Description: lowercase, imperative, no trailing period.

The body says **why**, not what — the diff already says what. A reader six months out needs the constraint, the incident, or the decision
that made this change look like this. Where a subtle behaviour was verified, say how it was verified.

## Trailers — the one that gets added by accident

**Never `Co-Authored-By:`.** Not on any commit, ever. The harness's own attribution guidance says to add it; the owner's instruction
overrides that, and the override is explicit and standing. Watch for it in two places: the trailer block a tool appends for you, and a
`git commit --amend`/rebase that carries one forward from an earlier commit.

`Claude-Session:` is kept — that one is wanted.

If a branch already carries `Co-Authored-By` on earlier commits, leave the history alone unless asked; just do not add more. A squash merge
discards branch commit bodies anyway, and the `merge` skill writes the squash body without the trailer.

## What one commit contains

One logical change, reviewable on its own: a lib module with its test, a component, a route, a test fix. Related edits inside it (the
import, the small refactor the change forced) belong with it. Unrelated fixes do not.

This is development-time shape. At PR time it collapses — the `merge` skill squashes it into one commit whose body documents the whole PR.

## Staging — stage by exact path

`git add <exact/path>` for every file. **Never `git add -A`, never `git add .`, never `git add <dir>`.**

Two reasons, both of which have actually bitten:

- The main checkout regularly carries the owner's own uncommitted work. A broad add sweeps it into your commit.
- Concurrent agents share one index when they share a checkout. A broad add — or even a plain `git commit` while another agent has files
  staged — commits their work under your message.

After staging, `git status` before committing, and read what is actually staged. If a filename looks unrelated to your change, it is.

**Never stage a secret.** `.env`, `.env.local`, credential files, tokens, keys. If the owner asks for one explicitly, say what it exposes
first.

## Before committing

- **Prettier over every file you touched** (`pnpm exec prettier --write <files>`).
- The gates the work called for — `pnpm check` (lint, typecheck, tests, token scan); `pnpm e2e` when the change reaches the browser. A
  commit that does not build is not a checkpoint.

## Which branch

`staging` is the trunk (AGENTS.md § Branches). Beyond that:

| Artifact                                     | Branch                                         |
| -------------------------------------------- | ---------------------------------------------- |
| Code                                         | a branch off `staging`, PR against `staging`   |
| Docs only (`AGENTS.md`, `ISSUES.md`, skills) | directly to `staging`, no PR                   |
| A hotfix                                     | `main`, and only when the owner says it is one |

Committing onto a branch the working tree is not on is legitimate and sometimes necessary. Do it with a temporary index and
`commit-tree`/`update-ref` rather than switching branches — a `git checkout` in a shared checkout yanks files out from under the owner and
any parallel agent.

## Pushing

Push when the work is ready to leave the machine, not after every commit. Never force-push without the owner saying so, and never to `main`
or `staging`. If a push is rejected as non-fast-forward, pull and integrate — never resolve it with force.
