---
name: pr-self-review
description:
    Use when reviewing a pull request in this repo — a PR you or another agent just wrote, a PR number or link handed over for review, or a
    "look over this branch before I merge" request. Supplies the Zeitleiste review dimensions, their detections and the sign-off rule.
---

# PR self-review

A cold review of a pull request against this project's own rules, performed as if you had no idea why the change was made. If you wrote the
PR, **discard your reasoning before you start** — self-review fails exactly where you still remember why something was fine.

**You review. You do not fix.** The PR's author applies the findings afterwards (`pr` skill § After opening); the reviewer stays cold.

---

## The meta-principle

The project's rules are not style preferences; they are the bar. **The bar for bailing out of one is very high.** A deviation is acceptable
only when all three hold:

1. There is sound, specific reasoning — _not_ "it was simpler", _not_ "the surrounding code already does it this way".
2. That reasoning is **written into the PR description**.
3. **The human owner has confirmed it.** You never grant this yourself.

A deviation that is not justified-in-description _and_ confirmed is a **finding**, however reasonable it looks. Where a rule genuinely seems
to need bending, neither accept it silently nor invent a workaround: flag it and route the decision to a human.

"The existing code does it this way" is the rationalisation this project will produce most often, because several rules are ahead of the
codebase. Standing debt is not a licence to add more.

---

## Running the review

Working only from what the diff actually contains:

1. Read the metadata: `gh pr view <PR> --json title,body,files,commits`.
2. **Get local refs, then set `R`.** Every detection below is a `git diff` with pathspec exclusions, and those exclusions do not exist in a
   saved `gh pr diff` file. Always diff against real refs:

    ```bash
    # a PR
    git fetch origin pull/<PR>/head
    R="$(git merge-base origin/staging FETCH_HEAD)...FETCH_HEAD"

    # a local branch
    R="origin/staging...HEAD"
    ```

    Use `merge-base`, not `staging...`, on a PR whose branch is behind — otherwise unrelated commits land in your diff.

3. **Read the PR description first.** It is the only place a deviation can be justified, so a thin description on a large change is itself a
   smell. `## Verification` is what the author claims to have run (Dimension 6); open questions the author routed to a human go into your ❓
   section verbatim.
4. Read the changed **files**, not just the hunks — a hunk hides that the helper you're about to say is missing already exists twenty lines
   up.
5. Run the detections below, **scoped to the diff**, never the whole tree. Every one judges _added_ lines (`^\+`); the standing debt is not
   this PR's.
6. Emit the severity-grouped report.

---

## Dimension 1 — Design tokens (CRITICAL)

`src/app/(frontend)/globals.css` holds two layers: primitives (`--gray-*`, `--red-*`, `--blue-*`, `--violet-*`, spacing, radii) and semantic
tokens (`surface`, `surface-raised`, `fg`, `fg-muted`, `border`, `accent`, `accent-fg`, `russia`, `west`, `both`, `focus`). Components use
semantic tokens only; Tailwind's default palette is disabled. `pnpm check:tokens` is the gate; this review is the backstop for what it
cannot see.

```bash
git diff $R -- 'src' ':!src/app/(frontend)/globals.css' ':!*.test.*' \
  | grep -nE '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|var\(--(gray|red|blue|violet|space|radius)-)'
git diff $R -- 'src' ':!src/app/(frontend)/globals.css' \
  | grep -nE '^\+.*\b(bg|text|border|ring|from|to)-(red|blue|green|gray|zinc|slate|amber|white|black)-?[0-9]*\b'
```

If no token fits the need, that is a **needs-human-decision**, not a licence to inline a colour. Minting a token is a theme change with its
own review. A change to `globals.css` in a feature PR is a finding unless the PR says why.

## Dimension 2 — Types, names, shape (MAJOR)

AGENTS.md § Code Style, the rules a diff actually breaks:

- **Types, not interfaces.** `interface` only for declaration merging or a class `implements` clause.
- **Names stand without their initialiser.** No bare adjectives (`stored`, `next`), no role nouns (`deps`, `data`, `result`); canonical
  short names (`e`, `i`, `acc`, `t`, `_`) are fine.
- **Declarative where it reads better.** A `let` accumulator with a loop where `map`/`filter`/`flatMap` reads as well is a finding; a
  `for...of` with an early exit is not.
- **Extract a thing, not a sequence.** A helper named for a location (`loadFooInput`, `setUpBar`) hides nothing.
- **DRY at three**, not two.
- **A private helper with its own tests** goes in a `PRIVATE_UNDER_TESTS` object, never a bare `export`.

```bash
git diff $R -- 'src' | grep -nE '^\+\s*(export )?interface '
git diff $R -- 'src' ':!*.test.*' | grep -nE '^\+\s*(export )?(const|let|function) (data|result|deps|opts|info|obj|tmp|next|stored|out)\b'
git diff $R -- 'src' ':!*.test.*' | grep -nE '^\+\s*let '
git diff $R -- 'src' | grep -nE '^\+.*// (Exported|exported) for test'
```

The `let` grep over-matches; read each hit and ask whether an expression reads better.

## Dimension 3 — Logic out of components (MAJOR)

Logic is a plain function with a unit test in the `__tests__/` directory beside it; a component only draws. Shared logic lives in `src/lib`;
logic specific to one component sits beside it as its own module (`bandGeometry.ts` next to `Timeline.tsx`) — placement is not the finding,
burial is. The recurring finding: geometry, date maths or a state machine buried inside a component or hook, untested because it was never
**extracted into an importable module**. `src/lib/placement.ts`, `cluster.ts`, `spans.ts` and `src/components/timeline/bandGeometry.ts` are
the shape to follow.

```bash
# new logic in components without a matching test
git diff $R --name-only --diff-filter=A -- 'src/components' | grep -vE '\.test\.tsx?$'
git diff $R --name-only --diff-filter=A -- 'src/lib' | grep -vE '\.test\.ts$'
```

Every added module in the second list needs its test in the same diff. For the first list, read the file: a `useMemo` with more than three
computations, or a callback that computes before it renders, is the candidate.

**Hooks prepare, screens consume** (AGENTS.md § Heuristics). A component that composes several hooks and converges their results into a
semantic state (a combined `pending`, "which entry is centred") is preparing, not consuming: that composition belongs in a hook named for
the component's intent, and the component renders what it returns. The hook is the unit; a helper it composes once is not an export, and a
part with its own test goes in `PRIVATE_UNDER_TESTS`. Logic moved to a layer because it was easier to test there, rather than because that
layer owns it, is a finding even when the tests are good; a layer that cannot be tested with the current tooling is a ❓, not a licence.

```bash
# components adding hook calls: three or more in one file is the candidate
git diff $R -- 'src/components' 'src/app' ':!*.test.*' ':!**/use*.ts' ':!**/use*.tsx' \
  | awk '/^\+\+\+ /{f=$2} /^\+.*\<use[A-Z][A-Za-z]*\(/{c[f]++} END{for (f in c) if (c[f]>=3) print c[f], f}'
```

## Dimension 4 — Interaction rules (CRITICAL)

Product decisions from the timeline issues, each broken silently by one line:

- **Ctrl/Cmd + wheel stays with the browser.** The wheel zooms and Shift + wheel pans (#45), but a handler that calls `preventDefault()` on
  a `ctrlKey`/`metaKey` wheel event takes page zoom away.
- **No scroll container inside the timeline** (`overflow-auto`/`overflow-scroll`); the section clips.
- **Layout is recomputed at gesture end, not per frame.** A new dependency on `viewport` in the layout memo is a finding.
- **Reduced motion means no animation** — a new transition or rAF loop needs its `motion-reduce:`/`prefersReducedMotion` path.
- **Dark mode remaps only the semantic layer** — a `dark:` variant in a component is a finding.

```bash
git diff $R -- 'src' | grep -nE '^\+.*(overflow-(auto|scroll)|dark:)'
git diff $R -- 'src' | grep -nE '^\+.*(transition-|requestAnimationFrame|animate)' | grep -vE 'motion-reduce|reducedMotion|ReducedMotion'
```

The second over-matches; each hit needs the reduced-motion path confirmed by eye.

## Dimension 5 — Accessibility and text (MAJOR)

- Every interactive element is a real `<button>` or focusable with a visible `focus-visible` outline and an accessible name in German.
- Tab order through entries stays chronological.
- User-facing strings are German; no text assembled from parts (`title + ', ' + date`) outside `src/lib/format.ts`.
- Icons are drawn or come from an icon set, never a glyph in a text node (`×`, `›`, `→`).

```bash
git diff $R -- 'src' ':!*.test.*' | grep -nE '^\+.*<(div|span)[^>]*onClick'
git diff $R -- 'src' ':!*.test.*' | grep -nE '^\+.*>[^<]*[×✕✓✗›‹»«→←↑↓−•][^<]*<'
git diff $R -- 'src' ':!*.test.*' ':!src/lib/format.ts' | grep -nE "^\+.*(title|label|summary)\s*\+\s*['\`]"
```

## Dimension 6 — Testing at the right altitude (MAJOR)

Vitest runs unit tests (`pnpm test`); Playwright runs the browser checks (`pnpm e2e`: axe on `/` and a post page, the keyboard walk).

| What changed                       | Where it belongs                                        |
| ---------------------------------- | ------------------------------------------------------- |
| Pure logic, geometry, formatting   | `__tests__/x.test.ts` beside it in `src/lib`            |
| A component's behaviour            | `__tests__/X.test.tsx` beside it (Testing Library, axe) |
| Keyboard flow, focus, page routing | `e2e/*.spec.ts`                                         |

Because nothing runs the suite for you, the PR's `## Verification` section is the only evidence there is. A PR that claims a result is
**awaiting confirmation**, not verified — say which commands were claimed and which are missing; never upgrade a claim to a pass.

- Fixtures fed to the call under test get their own named `const` first. Flag a call under test with an object literal or a builder call
  inline.
- A test must be about this repo's code. If only changing the dependency could fail the assertion, flag it.
- A bug-fix PR carries one test that speaks about the bug: red before, green after. No reproducing test is a finding.

```bash
git diff $R -- '*.test.*' | grep -nE '^\+\s*(expect|render|fireEvent)[^;]*\{\s*[a-z]+:'
```

## Dimension 7 — Values that leave TypeScript (MAJOR)

AGENTS.md § Heuristics: a value arriving from a caller this code does not control (a CMS response, a route param, the sample data file, a
stored blob) needs an Effect Schema and a real decode at the crossing (`Schema.decodeUnknown*`, see `agent-patterns/effect-schema.md`). A
value produced and consumed inside this codebase needs none. A type derived by hand next to a schema, or `typeof S.Type` used for what a
caller supplies (that is `typeof S.Encoded`), is a finding.

```bash
git diff $R -- 'src' ':!*.test.*' | grep -nE '^\+.*(JSON\.parse|\.map\(Number\)|params\.|searchParams| as [A-Z][A-Za-z]*(\[\])?\s*$)'
```

On every hit, ask: after this line, does anything check the value is what the type claims?

## Dimension 8 — Effect at the boundaries (MAJOR)

AGENTS.md § Architecture: fallible or async work is an `Effect` with typed errors; pure logic and React stay plain; the server boundary runs
the program once. The diff breaks it in three ways: a thrown or swallowed error where an `Effect` belongs, hand-rolled retry or timeout
code, and Effect leaking into a client component.

```bash
# server-side code handling failure by hand
git diff $R -- 'src' ':!*__tests__*' ':!src/components' \
  | grep -nE '^\+.*(try \{|catch \(|throw new|\.then\(|await fetch|setTimeout\(.*retry|process\.env\.)'
# Effect in the browser bundle
git diff $R -- 'src/components' 'src/app' | grep -lE "^\+.*from 'effect'" | xargs -r grep -l "'use client'"
# errors that are not tagged
git diff $R -- 'src' ':!*__tests__*' | grep -nE '^\+.*(class \w+Error extends Error|new Error\()'
```

Not findings: a `try`/`catch` inside a React event handler; the single `Effect.runPromise` (or `runPromiseExit`) at a route, server
component or action; a schema decode that returns `Result`. Ask of every other hit: what does the caller learn when this fails, and is it a
value it can match on?

## Dimension 9 — Issue fit and comments (MAJOR)

Check these **after** forming your findings:

- The diff against the issue's `## Done`, `## Not done` and `## Acceptance criteria`: a criterion silently dropped, or scope from
  `## Not done` built anyway, is a finding.
- The PR's `## Definition of Done` (see the `pr` skill): a missing section, a bare "ja", or an answer the diff contradicts.
- Comments: none that explain a library idiom, an implementation decision or the project structure (AGENTS.md § Comments). A comment that
  names a footgun stays.
- Prettier ran over every touched file.

```bash
git diff $R -- 'src' ':!*.test.*' | grep -nE '^\+\s*//'
```

Read each added comment and ask whether a name would replace it.

---

## The report

```markdown
## Verdict: <blocks merge | needs owner decisions | ready for owner review>

### 🛑 Blocking

- <dimension> — `file:line` — <what, and the rule>

### ⚠️ Major

- …

### ❓ Needs a human decision

- <every open question the author routed, verbatim, plus every deviation without owner confirmation>

### Verification claimed

- `<command>` — claimed <result> — not confirmed by this review

### Noted, not findings

- <ambient debt the PR touched but did not add to>
```

No praise, no restating the PR. A finding names the rule; the fix is the author's.
