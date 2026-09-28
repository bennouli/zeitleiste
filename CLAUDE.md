@AGENTS.md

## Skills

Invoke a skill **before** the work, not partway through — one read halfway in has already been overtaken by the decisions it would have
changed.

### Project skills

**Branch work happens in a worktree, never in the main checkout** — see the `worktree` skill for creation, the env files it must be seeded
with, and teardown.

- **`worktree`** — creating, seeding or tearing down an isolated worktree. Required before implementing an issue; a fresh worktree has no
  `.env` and no `node_modules`, and both must be provided before anything is run.
- **`issues`** — writing, retitling, grouping, triaging or judging a GitHub issue. Rules live in `./ISSUES.md`. `## Touched` and
  `## Acceptance criteria` are what gets built and tested.
- **`pr`** — opening a pull request or rewriting its description: the checks before it, the description's shape, and the Definition of Done.
  Ends by running `pr-self-review`; the owner's review follows.
- **`pr-self-review`** — reviewing a pull request or a branch before merge, including one you just wrote yourself. The standard: a deviation
  from a project rule is a finding unless it is argued in the PR description _and_ confirmed by the owner — the reviewer never grants
  sign-off.
- **`commit`** — invoked before every git commit, in every workspace. Message format, the `Co-Authored-By` prohibition, what one commit may
  contain, exact-path staging (a broad `git add` sweeps up the owner's work and any parallel agent's), and which branch each artifact
  belongs on.
- **`merge`** — invoked whenever prompted to merge a PR. Squash-merges, cleans up the worktree and branch, and reconciles every issue the PR
  touches — status and open/closed. The issue-closing step is never optional (AGENTS.md § Branches).
