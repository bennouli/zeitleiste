---
name: merge
description:
    Use whenever asked to merge a pull request in this repo, or when a PR is confirmed ready to land. Squash-merges against the correct
    base, cleans up the worktree and branch, and reconciles every issue the PR touches — GitHub's own closing keyword silently does nothing
    on a merge into staging, so closing is always a manual step this skill performs.
---

# Merge

Merging is not just `gh pr merge`. A PR that lands without this skill leaves a dead worktree, a stale branch, and issues that still say open
for work that shipped.

## 1. Confirm it's actually mergeable

```bash
gh pr view <n> --json mergeable,mergeStateStatus,baseRefName
```

Anything but `MERGEABLE` / `CLEAN` is a stop-and-report, not a force-through. A `baseRefName` other than `staging` is one too, unless the
owner called the PR a hotfix or a promotion.

## 2. Squash-merge with a clean body

One commit is the only durable record once the branch disappears — it has to stand alone.

```bash
gh pr merge <n> --squash --body "$(cat <<'EOF'
<one bullet per change in the PR, not just the headline ones>

Closes #<issue>
EOF
)"
```

No `Co-Authored-By` trailer. `Closes #<issue>` still belongs in the body — it's the record of intent — but **do not trust it to close
anything** (see § 4).

## 3. Clean up the worktree and branch

Never leave a merged branch's worktree behind.

- If a worktree's uncommitted diff is identical to what just landed, it's safe to discard — verify with `git diff origin/<base> -- <path>`
  before assuming.
- Otherwise rescue anything genuinely uncommitted first.
- Then: `ExitWorktree` (`action: "remove"`, `discard_changes: true` once rescued) or, from outside the harness's worktree tracking,
  `git worktree remove --force` + `git branch -D`.

## 4. Reconcile every issue the PR touches — this is the step that gets skipped

**`Closes #N` in a squash-merge body does nothing here.** GitHub only auto-closes on a merge to the repository's default branch. This repo's
default branch is `main`; the trunk is `staging` (AGENTS.md § Branches). Every PR in the normal flow merges into `staging`, so the keyword
is silently inert every single time. Closing is always an explicit step, with the link that `ISSUES.md` asks for:

```bash
gh issue close <n> --reason completed --comment "Done in <PR link>"
```

**Which issues, and to what — read the PR, don't regex it:**

- An issue the PR's own "what landed" fully satisfies → close it.
- A parent issue this PR is one piece of, still open with sub-issues left → leave it open; it closes when the last sub-issue does. If the PR
  finished the last one, close the parent with a one-line summary of what its sub-issues delivered.
- Anything the PR body itself names as out of scope, deferred, or a known gap → untouched. These numbers appear in the body on purpose;
  closing them is the mistake this section exists to prevent. Work left undone gets the comment `ISSUES.md` asks for: what is done, what is
  missing.
- Ambiguous whether an issue counts as done → ask, don't guess. Same standard as everywhere else in this repo.

## 5. Report what moved

State plainly which issues closed, which parents stayed open and why, and which were deliberately left alone — the reader should not have to
re-derive it from the PR body.
