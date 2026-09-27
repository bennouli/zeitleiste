# ISSUES — how an issue is written

## The standard

A hypothetical product owner knows the product and the UX. They know no module name, no file, no history of this repo.

That person must understand **from the title alone** what a ticket is about. The body's first paragraph explains the goal or the problem in
ordinary language. Only after that may it get technical.

A backlog whose titles are legible only to someone who knows the code is no longer a product list — it is a directory tree, and it can no
longer be prioritised, only worked through.

---

## The title

```
<context>: <what should happen>
<context>: <what goes wrong>      # bugs only
```

Around **60 characters**. English. One colon, no other separators.

```
Insights: one metric per graph instead of three lines
Mood: remove affects from capture
Event: add a title field
Today: highlight the row being edited
Today: sleep logged before midnight is missing next morning
Internal: escape LIKE wildcards in catalog search
External: remove foo shim on @external-lib/core update
```

### The context

Before the colon stands **one place in the product** — an object from `docs/design/OBJECTS.md`, or a screen you can tap in the app. Never a
module, never a layer, never a category.

Objects use their **code name** from OBJECTS.md, not their UI name: `Mood`, `Event`, `Person`, `Activity`, `Sleep`, `Thought`, `Affects`,
`Entry`, `Insights`. Screens: `Today`, `Insights`, `Profile`, `Capture`, `Onboarding`, `Auth`.

One exception: the `Check-in` is `WellbeingCheckin` in code and still `Check-in` in a title — the code name would fail the read-aloud test.

`Internal` is the context for work with **no product surface at all** — infrastructure, tooling, cleanup. A legible sentence still follows
it; it is an honesty, so the PO can skip knowingly.

`External` is the context for work waiting on someone else — a bug in a foreign library, a proposal another project has not accepted yet. An
`External` issue cannot be planned, only watched, and that belongs in the title.

`Test` is the context for work whose whole deliverable is evidence — a scenario, a harness, a fixture, a calibration check. It has no
product surface either, but it is separated from `Internal` because the PO reads it differently: nothing gets built, something gets shown.

`Tuning` is the context for choosing the value of a knob the analysis already has — a prior width, a decay half-life, a threshold — where
the mechanism stays and only the number moves. A new predictor, a new model term or a new rule is `Insights`, not `Tuning`; the knobs
themselves are listed in `packages/analysis-engine/README.md` § Settings.

> **A gap, deliberately open.** OBJECTS.md carries no `Symptom`, `Substance`, `Medication` or `Energy`, though the product has all of them.
> Until an entry exists, do not name it yourself — ask. Meanwhile use the existing name from the code and note it in the issue.

### The statement

Imperative — what should happen, not how it is built. **Except for bugs**, which describe what is wrong: a bug is reported before anyone
knows the fix, so a title that names the fix is a guess.

**One outcome in the title.** If the title needs an "and", it names two results — then either two issues, or a parent whose title names the
one result the children serve. This governs the title, not the scope: several acceptance criteria serving the same result are normal.

### Forbidden

- **Identifiers.** They belong in the body — error message, symbol name, path. Full-text search carries findability.
- **Prefixes other than the context.** No `Epic:`, no `[V7]`, no `(BACKLOG)`, no `WIP`. The category travels in the `type:` label, the
  hierarchy is GitHub's sub-issues.
- **Parentheses, slashes, square brackets.** Every extra separator is where a technical aside comes back through the side door.
- **Status.** Priority and urgency belong on the board.

### The read-aloud test

**Anything you would have to spell out to say it does not belong in the title.** `errorHandler`, `tz`, `$onUpdate`, `PascalCase` — each
forces spelling and fails. This replaces every list of forbidden words.

---

## The body

One unheaded opening paragraph, then the sections below in this order. **A section with nothing to say is left out** — no heading, no
placeholder. Most issues carry three or four.

**Opening paragraph** — the user story or the goal, in ordinary language. No identifiers, no paths, no backticks, no stack traces. The title
says what it is about; the paragraph says what is meant.

> **Title:** Today: sleep logged before midnight is missing next morning **Paragraph:** Someone who goes to sleep before midnight and logs
> it will not find that night on Today the next morning. The overview decides which day is meant from the wake time — and someone who has
> not woken up yet does not appear.

| Section                  | Carries                                                                                   | When          |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------- |
| `## Expected`            | what should happen instead                                                                | bugs          |
| `## Current`             | what happens today, and how to reproduce it                                               | bugs          |
| `## Done`                | what exists or holds once this is finished — the scope                                    | always        |
| `## Not done`            | what is expressly left out, where someone would otherwise assume it in                    | where needed  |
| `## Touched`             | the files, modules, screens, contracts and binding ADRs involved — the place, not the fix | always        |
| `## Open decisions`      | what is unclear and has to be answered before the work starts                             | until settled |
| `## Acceptance criteria` | how it is checked as finished — a test, a command, an observable behaviour                | always        |

An issue stands on its own: whoever opens it should not have to read three others first — neither a human nor an agent.

**The issue is the spec.** Work is built straight from it — no spec or plan document sits between them, and tests are written from
`## Acceptance criteria`. So an issue is **ready** when it has `## Done`, `## Touched` and `## Acceptance criteria`, and no
`## Open decisions` left.

What is unclear goes under `## Open decisions` and is asked about. Never guessed, never filled in with a supposition. Once answered, the
answer moves into the section it belongs to and the heading goes.

`## Touched` names the **surface each criterion is observable at** — the route, the exported function, the screen. That is what a test is
written against before the code exists; a criterion whose surface nobody can name yet is an open decision.

`## Acceptance criteria` are checkboxes, one result each. "Works" is not one. Where a failing test is possible, it replaces a prose
reproduction under `## Current` — prose steps and stack traces measurably do not help an agent.

The issue names the goal and the constraints, not the steps. A known pitfall or a decided approach goes under `## Touched`, next to the
place it concerns.

### Brevity

Every sentence carries information that would be missing without it. If it carries none, cut it. That holds for the opening paragraph too —
legible does not mean lengthy.

Forbidden:

- **Saying the same thing twice.** Neither in other words nor as a closing summary. The opening paragraph picking up the title is not a
  repetition in this sense.
- **Justifying what nobody disputes.** Why tests are good, why duplicates are bad, why user data deserves protection. Nor a relationship
  that does not exist: if a ticket does not block another, the missing link already says so.
- **Decorative language.** No imagery, no superlatives, no rhetorical questions, no build-up.

---

## The four openings

The categories differ **only in their opening move**.

| Category     | The title starts from                                   | Opening paragraph                       |
| ------------ | ------------------------------------------------------- | --------------------------------------- |
| **Bug**      | what goes wrong, described                              | what a person experiences instead today |
| **Feature**  | the promise not yet made                                | what becomes possible that is not today |
| **Decision** | the choice: `Decide: X or Y for Z`                      | what hangs on it and who is waiting     |
| **Parent**   | the result the group serves — a noun phrase, not a verb | why these pieces belong together        |

**Chores** run as `Internal` under Feature: the title names the capability that should exist, not the cleanup.

---

## Labels

- Exactly one `type:` label per issue: bug, enhancement, docs, chore.
- `stack:` labels only from: api, python, mobile, contracts, landing, analysis — set every one affected. `analysis` is the engine package;
  `python` is the service it replaces.
- `domain:` labels name product objects from `docs/design/OBJECTS.md`; set where one is affected. New values only when OBJECTS.md gains an
  object.
- `gate:` labels (privacy, security, compliance) mark a raised review duty before shipping — a process signal, not a topic label.
- `ops:` labels (deploy, monitoring) for operations with no user contact.
- Features get no label: mortal work is grouped by its parent issue, and after that full-text search finds it through the identifiers in the
  body.
- Every issue carries at least one `stack:`, `domain:`, `ops:` or `gate:` label.
- Create no new labels. If none fits, note it in the issue text and ask.
- Quarterly cull: a `domain:`/`gate:`/`ops:` label that has not had 3 open issues for 90 days is deleted, and recreated if needed.

## Parent issues

- If an issue belongs to one, attach it as a sub-issue of the open parent.
- A parent whose children all hang elsewhere sorts nothing any more and is closed.

## Status

- New issues start in Backlog.
- Todo is reserved for sub-issues of an open parent, or high-priority issues.
- Status means the field on the board, never a comment.

---

## Workflow

Set the status at the start and at the end of the work. At the start: assign, set status, link the branch or PR once one exists. At the end:
close with a resolution note and a link to the PR or commit — or, if the work ends unfinished, comment on what state it is left in and what
is missing. Never leave a session with a stale status.

The `## Definition of Done` (`docs/design/Definition of Done.md`) is answered in prose in the PR description, and the feature passes it
before the issue is closed.

Before closing, preserve what the issue and PR worked out that has lasting value and is written down nowhere else: binding decisions → an
ADR; reasoning, rejected alternatives, footguns → `docs/wiki/`.

---

## Checking

`pnpm issues:lint` checks the title only: length, forbidden prefixes and separators, identifiers, the context vocabulary. It is not a gate —
it is a worklist. The body is not linted; brevity and the section cut are judgement.

What cannot be checked is the only thing that matters: **whether the title is understood.** For that there is only the cold-read test — read
the ten newest titles in one go, bodies covered, and say out loud what each is about.

A title that stubbornly resists translation into plain language is usually not a title problem. It is an issue without a product
justification — and the question is then not what to call it, but whether it should stay.
