# Communication style

- Fewest words possible. Bullets over prose, code over description. Reader has a short attention span.
- No preamble, postamble, restating the request, narrating work, hedging, politeness padding or apologies.
- Never use negative parallelism, contrastive phrasing, stylistic negation, or self-correction for emphasis.
- If something failed, state what failed. Don't propose a fix without being asked.

# Repository

One Next.js app (App Router) with Payload CMS inside it, `src/lib` for pure logic, `src/components` for React, `e2e/` for Playwright.
`repos/` holds read-only vendored upstream sources; see § Libraries.

## Branches

`staging` is the trunk: **branch off `staging`, open pull requests against `staging`.** `main` holds released code; only a promotion PR from
`staging` or a hotfix the owner has called one goes there. `main` remains the repo's default branch, so a PR opened without a base lands on
the wrong one — set it.

For implementation, the issue is the spec (`ISSUES.md`).

Every commit invokes the `commit` skill; every merge invokes the `merge` skill. `main` being the default branch means GitHub's `Closes #N`
does nothing on a merge into `staging` — the skill closes issues, updates parent issues and removes the worktree and branch; `gh pr merge`
alone leaves all three undone.

# Libraries

- **Docs are the contract; internals are not.** Implement against what a library officially documents. Never read a dependency's source to
  decide _how_ to implement something — an undocumented behaviour may be incidental or one path of several, and changes without notice.
- **Reading source to diagnose a concrete failure is fine.** The fix still goes back through the docs.
- **No documented way to do it is a finding, not an obstacle.** Surface it and ask — don't subclass, monkey-patch, or override something
  that isn't an extension point.
- **Never invent an alternative to the documented path unprompted**, however big that path's impact looks. Present the tradeoff and let the
  user decide.

## Vendored sources (`repos/`)

`repos/` holds upstream trees vendored with `git subtree`. Currently `repos/effect` — Effect at the version this app depends on.

- **Never import from `repos/`, never edit it.** Effect is imported from the npm dependency; a local change is lost on the next
  `git subtree pull`.
- **`repos/effect/LLMS.md` and `repos/effect/ai-docs/` are documentation** in the sense § Libraries means. Effect work starts there.
- **The rest is examples and diagnosis.** Tests and `ai-docs` fixtures may be copied from; the package sources are read only to diagnose a
  concrete failure.
- **The vendored commit and the installed version move together**, in one change.

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
```

# Architecture

- **Fallible or async work is an `Effect`.** Loading from Payload, revalidating, sending mail, reading env, anything that touches the
  network, the filesystem or a process boundary. Errors are typed values in the error channel (`Data.TaggedError`), never thrown past the
  boundary and never caught and dropped. Retries, timeouts and resource cleanup come from Effect, not from hand-rolled loops or
  `try`/`catch`.
- **Pure logic stays plain.** Geometry, dates, formatting, layout, React hooks and rendering: a function that cannot fail takes no `Effect`.
  Wrapping it is ceremony.
- **The seam is the server boundary.** A route, server component or server action runs the program once at the edge (`Effect.runPromise`),
  the client receives plain data. Effect never reaches the browser bundle.
- **Schemas at every crossing** — § Heuristics.

# Code Style

`@/` aliases `src/`. `src/lib` holds logic shared by more than one module; components live in `src/components`. Tests sit in a `__tests__/`
directory next to the module they test (`src/lib/__tests__/x.test.ts`, `src/components/timeline/__tests__/X.test.tsx`).

- Declarative style generally preferred.
- Run prettier after any coding task (the `commit` skill covers the pre-commit run).
- DRY: extract when a pattern appears (or is planned to appear) three times.
- SOLID: single responsibility strictly; open/closed for anything likely to be extended.
- Types, not interfaces. `interface` only for declaration merging or a class `implements` clause (lint-enforced).
- Colocate what only one module uses. Logic specific to one component, pure or not, sits beside that component as its own tested module
  (`bandGeometry.ts` next to `Timeline.tsx`); `src/lib` is reserved for what more than one module shares and never imports from components
  or routes (lint-enforced).
- Declarative where it reads better: expressions over mutable accumulators, `map`/`filter`/`flatMap` over index loops, a named predicate
  over an inline boolean chain. A `for...of` with an early exit beats a contorted `reduce`.
- Name the steps: a function past ~40 lines or with more than three distinct steps is a candidate for extraction. Length prompts a look,
  never an automatic split; straight-line code that reads top to bottom is fine.
- Extract a thing, not a sequence. A helper's name should be a concept the reader can skip past (a query, a predicate, a lookup). A wrapper
  named for a location (`loadFooInput`, `setUpBar`) adds a hop and hides nothing.
- Names stand without their initialiser. Variables are noun phrases (`storedKey`), never a bare adjective (`stored`, `next`) or role noun
  (`deps`, `data`, `result`). A function's verb names what it does for the caller (`unlockAndMigrate`, `beginReopen`). A type is named for
  what it is to its consumer (`DeviceKeyStore`, not `Deps`/`Options`). Canonical conventions win (`e`, `i`, `acc`, `props`, `req`/`res`,
  `t`, `db`, `_`). A brief that describes steps yields step-shaped names, so name the things in the brief too.
- Deleting a helper deletes its type contract. When inlining, keep the annotation at the binding
  (`const input: OverviewInput = await udb.tx(…)`) — generic callers infer whatever they're handed.
- Loose guideline: exported before private, then in order of first use (counting uses nested in earlier helpers).
- A private helper that earns a direct unit test goes in a `PRIVATE_UNDER_TESTS` object at the bottom of the file, never a bare `export`
  (lint-enforced: `local/no-test-only-exports` reports an export nothing outside the tests imports, and production code may not import
  `PRIVATE_UNDER_TESTS`). It holds computation with edge cases of its own (`datesBetween`, `variance`) and the constants its tests are
  written in terms of, never a "part of X" step — test X instead.

## Tests

- Test your code against the library, never the library itself. Assert on what your code hands over and decides; if only changing the
  dependency can fail the test, it tests them. Library health diagnostics (`divergences`, `R-hat`, `ESS`) are recorded and acted on, never
  asserted.
- A test that can never become red, is useless
- Every fixture, config, stub and builder call fed to the call under test gets its own named `const` first; the call under test reads as the
  call and its arguments. Data changes and interface changes then land in separate diff hunks.

## Comments

Default to none; wanting a comment usually means the code should change. Never comment library idioms, implementation or architecture
decisions, or project structure. A footgun may warrant a comment — flag that code for a closer look in review.

## Heuristics

Rules of thumb, none binding.

**Schematize where a value leaves TypeScript's reach.** A value needs an Effect Schema and a real decode at the crossing
(`Schema.decodeUnknownSync` where invalid input is a bug, `decodeUnknownResult` where the code branches on failure, `decodeUnknownEffect`
inside Effect code) when it arrives from a caller this code does not control, crosses an injection seam, leaves the language (argv,
filesystem, wire, WebAssembly, native), or comes back from a parse that cannot fail loudly (`Number('')` is `0`). String interpolation is
the usual tell: `` `seed=${value}` `` turns `undefined` into `seed=undefined`. A value produced and consumed inside this codebase needs no
schema; the sample entries, a CMS response and a route param do. The idioms are in `agent-patterns/effect-schema.md`.

Derive the type from the schema; `typeof S.Encoded` is what a caller supplies, `typeof S.Type` is what the code holds after decoding — the
decoded side has already applied every default and transformation.
