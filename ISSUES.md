# How to write an issue

Someone who knows the product but not the code should understand what an issue is about from its title alone. The body starts in plain
language, and only then gets technical.

## Title

```
<Area>: <what should happen>
<Area>: <what goes wrong>        # bugs
```

- English, about 60 characters, a plain sentence you can read aloud.
- The area is the part of the product it concerns, e.g. `Timeline`, `Entry`, `Post`, `Admin`, `Auth`, `Site`. Use `Internal` for work
  without anything visible to users, and `Decide` for an open choice (`Decide: X or Y for Z`).
- One outcome per title. If it needs an "and", split it into two issues or group them under a parent issue.
- No code names, file paths or status in the title. They go in the body.

## Body

A short opening paragraph without a heading: what should become possible, or what goes wrong today. No code and no paths here.

Then these sections, in this order. Leave out any section that has nothing to say.

| Section                  | Content                                                        | When         |
| ------------------------ | -------------------------------------------------------------- | ------------ |
| `## Expected`            | what should happen instead                                     | bugs         |
| `## Current`             | what happens today, and how to reproduce it                    | bugs         |
| `## Done`                | what exists once this is finished: the scope                   | always       |
| `## Not done`            | what is deliberately left out                                  | where needed |
| `## Touched`             | the screens, routes, files or modules involved, known pitfalls | always       |
| `## Open decisions`      | what has to be answered before work can start                  | until answered |
| `## Acceptance criteria` | checkboxes, one checkable result each ("works" isn't one)      | always       |

- **An issue stands on its own.** Nobody should have to read other issues to understand it.
- **The issue is the spec.** Work is built directly from it. It is ready when it has `Done`, `Touched` and `Acceptance criteria`, and no
  `Open decisions` left.
- **Don't guess.** Anything unclear goes under `Open decisions` and gets asked. Once answered, move the answer into the right section and
  remove the question.
- **Keep it short.** Every sentence should carry information the issue would otherwise lack. No repetition, no justifying the obvious.

## Parent issues

Related issues are grouped as sub-issues under a parent issue. The parent's title names the result they serve together, e.g.
`Timeline: interactive prototype with sample data`.

## Labels

GitHub's default labels are enough: `bug`, `enhancement`, `documentation`, `question`.

## Closing

Close an issue with a short note and a link to the commit or PR. If the work stops unfinished, comment on what is done and what is missing.
