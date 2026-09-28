# Design language

Source: the Claude Design prototype
[Zeitleiste Prototyp](https://claude.ai/design/p/c2dd203e-86bf-48da-abda-9d11f8edf01d?file=Zeitleiste+Prototyp.dc.html). The tokens live in
`src/app/globals.css`, the fonts in `src/app/layout.tsx`, the durations in `src/components/timeline/constants.ts`.

The look is a printed history book: warm paper, near-black ink, a serif to read, a small sans for everything that is data, and no colour
beyond ink.

## Fonts

| Font          | Weights / styles     | Variable               | Used for                                                       | Why                                                                                          |
| ------------- | -------------------- | ---------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EB Garamond   | 400, 500, italic 400 | `--font-eb-garamond`   | `font-serif`: entry titles, post title, lead and body          | A book face for long reading and for titles that should read as history, not as a dashboard. |
| IBM Plex Sans | 400, 500             | `--font-ibm-plex-sans` | `font-sans`: tick labels, dates, meta lines, buttons, wordmark | Neutral and legible at 10–11 px; separates data from prose.                                  |

- Loaded with `next/font/google` (self-hosted, `display: 'swap'`, metric-adjusted fallback), so the page does not shift when the fonts
  arrive. `weight` × `style` loads every combination, so EB Garamond also ships a 500 italic; it costs a file, nothing more.
- Widths of text columns are set in `rem` (`max-w-reading`, 40.625 rem): a `ch` width changes when the web font replaces its fallback.
- **Small caps** = uppercase, letter-spacing 0.06–0.18 em, 10–11 px, IBM Plex Sans. It is the label style for dates, tick labels and meta
  lines. The stylesheet has no utility layer yet, so the components that use it (#37 and its sub-issues) set it with Tailwind classes until
  a third use makes a shared utility worthwhile.

## Colours

Monochrome. Hex values are the prototype's; `globals.css` holds them as oklch.

| Primitive      | Light     | Dark       | Semantic tokens                                    | Used for                                                                       |
| -------------- | --------- | ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `--paper`      | `#f3eddf` | `#0f0e0c`  | `--surface`, `--surface-raised`, `--accent-fg`     | Page background, hover note, group counter. No raised surfaces in this design. |
| `--ink`        | `#171411` | `#f3eddf`  | `--fg`, `--accent`, `--russia`, `--west`, `--both` | Text, axis, dots, connectors of the open entry, accent.                        |
| `--ink-muted`  | `#6a6357` | `#a39d90`  | `--fg-muted`                                       | Dates, minor tick labels, span label in the header.                            |
| `--ink-soft`   | `#3d382f` | `#cfc8ba`  | `--fg-soft`                                        | Summary text in the hover note.                                                |
| `--ink-40`     | ink 40 %  | ink 40 %   | —                                                  | Connectors.                                                                    |
| `--ink-30`     | ink 30 %  | ink 30 %   | —                                                  | Disabled arrows.                                                               |
| `--ink-25`     | ink 25 %  | ink 25 %   | `--border`                                         | Rule above the post, borders.                                                  |
| `--ink-12`     | ink 12 %  | ink 12 %   | —                                                  | Span bars.                                                                     |
| `--ink-2`      | ink 2 %   | ink 2 %    | —                                                  | Fading end of an ongoing span.                                                 |
| `--focus-blue` | blue      | light blue | `--focus`                                          | Focus ring: the one colour, because focus must never be missed.                |

- **Why monochrome:** the timeline is read by position and time, not by region; colour-coding Russia and the West would suggest a two-sided
  story the content does not tell. `--russia`, `--west` and `--both` stay as names so a region colour can return in one line.
- **Why warm paper:** pure white under a serif reads as a screen form; the paper tone makes long posts calmer.
- **Dark mode** follows the OS setting and swaps only the primitives: paper becomes near black, ink becomes the light paper tone. The "ink
  at n %" steps are alphas of `--ink` (relative colour syntax), so they follow without being redefined. The dark paper uses the prototype's
  hex `#0f0e0c` (`oklch(0.164 0.004 84.6)`), not the rounder `oklch(0.14 …)` quoted with it.
- The alpha steps without a semantic token get one when the component that uses them is built; components may only use semantic tokens
  (`pnpm check:tokens`).
- **Contrast** (axe, Chromium): ink-muted on paper is 5.08 : 1 light and 7.15 : 1 dark, above the 4.5 : 1 small-text threshold; ink on paper
  is 15.7 : 1 and 16.5 : 1. The focus blue is about 3.2 : 1 against light paper, above the 3 : 1 for non-text.

## Motion

| Motion                          | Duration | Easing                                    | Constant                |
| ------------------------------- | -------- | ----------------------------------------- | ----------------------- |
| Post collapse (timeline height) | 500 ms   | `ease-in-out` = `cubic-bezier(.4,0,.2,1)` | `COLLAPSE_ANIMATION_MS` |
| Zoom and pan                    | 300 ms   | ease-out (cubic)                          | `ZOOM_ANIMATION_MS`     |
| Hover states                    | none     | —                                         | —                       |

Tailwind's defaults nearest the prototype, so the classes stay plain (`duration-500 ease-in-out`). `prefers-reduced-motion` turns all of
them off.

## Unchanged

Spacing and radius scales. Radii are only used for circles (`rounded-full`) in this design.
