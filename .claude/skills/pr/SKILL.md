---
name: pr
description:
    Use when opening a pull request in this repo, or rewriting its description — the checks before it, the description's shape, and the
    Definition of Done every PR closing an issue answers in prose.
---

# Pull request

## Before opening

- The branch is off `staging` (`worktree` skill), every commit went through `commit`, prettier ran over every touched file.
- Gates green: `pnpm check` (lint, typecheck, unit tests, token scan) and `pnpm e2e` (axe, keyboard walk). Record the commands and their
  results — they go into the description.
- Anything with visual impact was looked at in a real browser: headless Chromium (`~/.cache/ms-playwright`) at 1920 px and a phone width,
  screenshots kept. A green suite is never evidence for layout, colour, motion or gesture.
- Each of the issue's `## Acceptance criteria` holds, or the description says why not.
- Nothing in the diff uses a raw colour, a primitive token or Tailwind's default palette — `pnpm check:tokens` is the gate, the review is the
  backstop.

## Open it

Push, then:

```bash
gh pr create --draft --base staging --title "<conventional commit subject>" --body-file <file>
```

`--base staging` is not optional — `main` is the default branch.

## The description

```markdown
<one paragraph: what changed and why, in product terms>

Closes #<N>

## Changes

- <per area, what a reviewer needs to know — not a file list>

## Verification

- `<command>` — <result>
- <browser check: what was walked, at which widths, screenshots>

## Deviations

- <a project rule this bends, and the reasoning — or leave the section out>

## Definition of Done

- <check> — **<answer>** — <why, for this change>
```

**Deviations** is where a bent rule gets argued. `pr-self-review` treats every deviation not argued here _and_ confirmed by the owner as a
finding — an unlisted one is just a finding it will catch.

## Definition of Done

Every PR that closes an issue answers these, each **in prose**, one line, for what this change actually built:

- Every `## Acceptance criteria` of the issue — met, or the line says which one is not and why.
- Nothing from the issue's `## Not done` was built.
- Works with the keyboard alone and axe reports no violations (`pnpm e2e`).
- Components use semantic tokens only; dark mode still remaps only the semantic layer.
- German UI strings; no user-facing text assembled from parts.
- Pure logic sits in `src/lib` with a unit test; the component only draws.

> Works with the keyboard alone? **Ja** — the new filter is a `<select>` inside the region; the timeline's key handler ignores it.

> Pure logic in `src/lib`? **Unberührt** — copy change only.

- `Ja` alone is not an answer. `Unberührt` / `N/A` are, with the clause saying why.
- A "no" is allowed only as a documented decision, reasoning in the same line.
- A check the issue should have settled — an open decision, a copy question — is not answered by a guess. It goes to the owner.

## After opening

Run `pr-self-review` through a fresh subagent with `isolation: "worktree"`, given only the PR number. Post the report as a PR comment, then
hand the PR link and the verdict to the owner. The owner's review is the next step; merging is the `merge` skill's, on the owner's word.
