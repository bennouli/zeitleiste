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
- Widths of text columns are set in `rem` (`max-w-reading`, 41.25 rem = 660 px): a `ch` width changes when the web font replaces its
  fallback.
- **Post type roles** (theme tokens in `globals.css`): `text-meta` 10.5 px with `tracking-meta` 0.12 em (meta line), `text-post-title` 44 px
  / 1.05, `text-lead` 20 px / 1.35 (italic), `text-body` 16.5 px / 1.5.
- **Small caps** = uppercase, letter-spacing 0.06–0.18 em, 10–11 px, IBM Plex Sans. It is the label style for dates, tick labels and meta
  lines. The `small-caps` utility in `globals.css` sets the font, `text-label` and uppercase; each use adds its tracking token.

## Type scale

Tokens in the `@theme static` block of `globals.css`. `text-<name>` sets the size and, where a line height is listed, the line height;
`tracking-<name>` sets the letter spacing. Components use these, never `text-[Npx]`, `leading-[…]` or `tracking-[…]`.

Theme lengths are rem, so type follows the browser's font-size setting; the px values below hold at the 16 px default. Line heights are
unitless and letter spacing is in em, so both scale with the size. The timeline's layout constants (row offsets, label height and width cap)
are px measured at the 16 px default.

| Token             | Size / line height          | Role                                                                 |
| ----------------- | --------------------------- | -------------------------------------------------------------------- |
| `text-label`      | 0.625 rem (10 px)           | Small caps: tick labels, "Heute", date lines, counter, position line |
| `text-label-lg`   | 0.6875 rem (11 px)          | Wordmark                                                             |
| `text-meta`       | 0.65625 rem (10.5 px)       | Post meta line                                                       |
| `text-entry`      | 1.0625 rem (17 px) / 1.1    | Entry title on the timeline                                          |
| `text-note-title` | 0.9375 rem (15 px) / 1.2    | Hover note title                                                     |
| `text-note`       | 0.8125 rem (13 px) / 1.4    | Hover note text                                                      |
| `text-post-title` | 2.75 rem (44 px) / 1.05     | Post title                                                           |
| `text-lead`       | 1.25 rem (20 px) / 1.35     | Post lead                                                            |
| `text-body`       | 1.03125 rem (16.5 px) / 1.5 | Post body                                                            |

| Token               | Letter spacing | Role                 |
| ------------------- | -------------- | -------------------- |
| `tracking-label`    | 0.06 em        | Tick labels, "Heute" |
| `tracking-date`     | 0.1 em         | Entry date lines     |
| `tracking-meta`     | 0.12 em        | Post meta line       |
| `tracking-wordmark` | 0.18 em        | Wordmark             |

Offsets use the spacing scale in 0.25 steps of `--spacing` (`gap-0.75` = 3 px, `top-5.5` = 22 px). Geometry that feeds layout math (row
offsets, label width cap, dot sizes) lives in the timeline's JS constants and is applied through `style`.

Icons come from `lucide-react` (pinned, `currentColor`), never text glyphs (arrows, chevrons, bullets as characters) and never hand-drawn
SVG. `GroupStack`'s hand-drawn arrows move to it in #40.

## Colours

Monochrome. Hex values are the prototype's; `globals.css` holds them as oklch. Primitives are fixed values, one set per theme; the semantic
tokens pick the light or the dark primitive.

| Semantic token                                     | Light primitive         | Dark primitive                | Used for                                                                       |
| -------------------------------------------------- | ----------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `--surface`, `--surface-raised`, `--accent-fg`     | `--paper` `#f3eddf`     | `--paper-dark` `#0f0e0c`      | Page background, hover note, group counter. No raised surfaces in this design. |
| `--fg`, `--accent`, `--russia`, `--west`, `--both` | `--ink` `#171411`       | `--ink-dark` `#f3eddf`        | Text, axis, dots, connectors of the open entry, accent.                        |
| `--fg-muted`                                       | `--ink-muted` `#6a6357` | `--ink-muted-dark` `#a39d90`  | Dates, minor tick labels.                                                      |
| `--fg-soft`                                        | `--ink-soft` `#3d382f`  | `--ink-soft-dark` `#cfc8ba`   | Summary text in the hover note.                                                |
| `--border`                                         | `--fg` at 25 %          | `--fg` at 25 %                | Rule above the post, borders.                                                  |
| `--focus`                                          | `--focus-blue`          | `--focus-blue-dark` (lighter) | Focus ring: the one colour, because focus must never be missed.                |

The other ink steps are Tailwind opacity modifiers on `fg`, so they follow the theme with `--fg`:

| Step     | Class (example) | Used for                       |
| -------- | --------------- | ------------------------------ |
| ink 40 % | `border-fg/40`  | Connectors.                    |
| ink 30 % | `text-fg/30`    | Disabled arrows.               |
| ink 12 % | `bg-fg/12`      | Span bars.                     |
| ink 2 %  | `to-fg/2`       | Fading end of an ongoing span. |

- **Why monochrome:** the timeline is read by position and time, not by region; colour-coding Russia and the West would suggest a two-sided
  story the content does not tell. `--russia`, `--west` and `--both` stay as names so a region colour can return in one line.
- **Why warm paper:** pure white under a serif reads as a screen form; the paper tone makes long posts calmer.
- **Dark mode** follows the OS setting; the semantic layer switches to the `-dark` primitives: paper becomes near black, ink becomes the
  light paper tone. `--border` is a relative colour of `--fg` and follows without being redefined. The dark paper uses the prototype's hex
  `#0f0e0c` (`oklch(0.164 0.004 84.6)`), not the rounder `oklch(0.14 …)` quoted with it.
- Components use semantic tokens only (`pnpm check:tokens`).
- **Contrast** (axe, Chromium): ink-muted on paper is 5.08 : 1 light and 7.15 : 1 dark, above the 4.5 : 1 small-text threshold; ink on paper
  is 15.7 : 1 and 16.5 : 1. The focus blue is about 3.2 : 1 against light paper, above the 3 : 1 for non-text.

## Motion

| Motion                          | Duration                                                               | Easing                                    | Constant                |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | ----------------------- |
| Post collapse (timeline height) | 500 ms                                                                 | `ease-in-out` = `cubic-bezier(.4,0,.2,1)` | `COLLAPSE_ANIMATION_MS` |
| Zoom and pan                    | 300 ms                                                                 | ease-out (cubic)                          | `ZOOM_ANIMATION_MS`     |
| Hover states                    | none (target; the hover note's 150 ms fade-in is still there, for #37) | —                                         | —                       |

Tailwind's defaults nearest the prototype, so the classes stay plain (`duration-500 ease-in-out`). `prefers-reduced-motion` turns all of
them off.

## Unchanged

Spacing and radius scales. Radii are only used for circles (`rounded-full`) in this design.
