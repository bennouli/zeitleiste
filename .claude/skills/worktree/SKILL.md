---
name: worktree
description:
    Use before implementing an issue or starting any branch work in this repo — creating the isolated worktree, seeding the env files it
    needs to run, and tearing it down when the branch is finished.
---

# Worktree

## Creating one

Use the harness's `EnterWorktree` tool, not `git worktree add`. It owns placement (`.claude/worktrees/<name>`), branching and cleanup — a
hand-rolled worktree is state the harness cannot see or remove.

Name it after the issue: `16-payload-neon`, `23-invite-editors`.

**Branch off `staging`, and open the PR against `staging`.** Not `main` — `main` is the released branch, `staging` is where work
accumulates. Check what you actually branched from before the first commit (`git merge-base --is-ancestor origin/staging HEAD`); a worktree
cut from the wrong base is cheapest to fix while it is still empty. Two exceptions: a **hotfix** going straight to `main`, and anything the
owner explicitly bases elsewhere. Both are stated, never assumed — if you find yourself inferring that something is a hotfix, ask.

## Seed the env files — always, immediately

`.env*` is gitignored, so a fresh worktree has **none**. Payload will not boot without `DATABASE_URL` and `PAYLOAD_SECRET`:

```bash
MAIN=$(git worktree list --porcelain | head -1 | cut -d' ' -f2)
for f in .env .env.local; do
    [ -f "$MAIN/$f" ] && cp "$MAIN/$f" "$f"
done
```

Then `pnpm install` — the worktree has no `node_modules` either.

Do this at creation, not when something fails. A missing `.env.local` surfaces as a confusing runtime error several steps later, not as "no
env file".

## Running the app from a worktree

The main checkout's dev server owns port 3000. Next refuses a second `next dev` in the same directory tree, so a worktree runs a **built**
server on another port: `pnpm build && pnpm start -p 3100`. `pnpm e2e` does exactly that through its `webServer`; a dev server on 3100 is
not the fallback, because it collides with `pnpm e2e` reusing that port.

The database is shared with the main checkout unless `.env.local` points at another Neon branch. A migration run from a worktree changes the
owner's database too — say so before running one.

## Subagents

A subagent that navigates git needs `isolation: "worktree"` of its own. Without it, it races the controller's git operations in the shared
worktree. A dispatch must verify `git rev-parse --show-toplevel` before it does anything.

## Finishing

When the branch is merged or abandoned: **rescue uncommitted work first**, then remove the worktree and delete the branch (unlock it if git
refuses). A worktree left behind is a stale checkout someone will later mistake for current work.
