# Design language

Source: the Claude Design prototype
[Zeitleiste Prototyp](https://claude.ai/design/p/c2dd203e-86bf-48da-abda-9d11f8edf01d?file=Zeitleiste+Prototyp.dc.html). The tokens live in
`src/app/(frontend)/globals.css`, the fonts in `src/app/(frontend)/layout.tsx`, the durations in `src/components/timeline/constants.ts`.

The look is a printed history book: warm paper, near-black ink, a serif to read, a small sans for everything that is data, and no colour
beyond ink.

## Fonts

| Font          | Weights / styles     | Variable                                          | Used for                                                                | Why                                                                                          |
| ------------- | -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EB Garamond   | 400, 500, italic 400 | `--font-eb-garamond`, `--font-eb-garamond-italic` | `font-serif`: entry titles, post title, body; `font-serif-italic`: lead | A book face for long reading and for titles that should read as history, not as a dashboard. |
| IBM Plex Sans | 400, 500             | `--font-ibm-plex-sans`                            | `font-sans`: tick labels, dates, meta lines, buttons, wordmark          | Neutral and legible at 12–13 px; separates data from prose.                                  |

- Served from the repository: static woff2 files in `src/fonts/<family>/`, latin and latin-ext subsets, each family with its OFL `LICENSE`.
  Copied from `@fontsource/eb-garamond` 5.3.0 and `@fontsource/ibm-plex-sans` 5.3.0 (`files/<family>-<subset>-<weight>-<style>.woff2`); the
  packages are not dependencies. No request goes to Google Fonts, at build time or at runtime.
    - `eb-garamond/`: `eb-garamond-{latin,latin-ext}-{400-normal,500-normal,400-italic}.woff2`
    - `ibm-plex-sans/`: `ibm-plex-sans-{latin,latin-ext}-{400-normal,500-normal}.woff2`
- Three `next/font/local` calls in `src/app/(frontend)/layout.tsx`, all `display: 'swap'` with a metric-adjusted fallback
  (`adjustFontFallback`), so the page does not shift when the fonts arrive:
    - `ebGaramond`: EB Garamond 400 and 500 upright, fallback Times New Roman, preloaded.
    - `ebGaramondItalic`: EB Garamond 400 italic in a call of its own, so the italic lead gets fallback metrics measured on the italic;
      fallback Times New Roman, not preloaded.
    - `ibmPlexSans`: IBM Plex Sans 400 and 500, fallback Arial, preloaded.
- `next/font/local` has no per-file `unicode-range`: both subsets of a face are declared with the same descriptors and the browser falls
  back from one file to the other per glyph. The fallback metrics come from one file per call; the order of `src` in each call is chosen so
  that file is the latin one (a latin-ext file yields default metrics, `size-adjust: 100%`). Check the `* Fallback` rules in the built CSS
  after reordering.
- Widths of text columns are set in `rem` (`max-w-reading`, 41.25 rem = 660 px): a `ch` width changes when the web font replaces its
  fallback.
- **Small caps** = uppercase, letter-spacing 0.06–0.18 em, 12–13 px, IBM Plex Sans. It is the label style for dates, tick labels and meta
  lines. The `small-caps` utility in `globals.css` sets the font and uppercase; each use adds its size (`text-label`, `text-label-lg`,
  `text-meta`) and its tracking token.

## Type scale

Tokens in the `@theme static` block of `globals.css`. `text-<name>` sets the size and, where a line height is listed, the line height;
`tracking-<name>` sets the letter spacing. Components use these, never `text-[Npx]`, `leading-[…]` or `tracking-[…]`.

Theme lengths are rem, so type follows the browser's font-size setting; the px values below hold at the 16 px default. Line heights are
unitless and letter spacing is in em, so both scale with the size. The timeline's layout constants (row offsets, label height and width cap)
are px measured at the 16 px default.

| Token             | Size / line height       | Role                                                                 |
| ----------------- | ------------------------ | -------------------------------------------------------------------- |
| `text-label`      | 0.75 rem (12 px)         | Small caps: tick labels, "Heute", date lines, counter, position line |
| `text-label-lg`   | 0.8125 rem (13 px)       | Wordmark                                                             |
| `text-meta`       | 0.75 rem (12 px)         | Post meta line                                                       |
| `text-entry`      | 1.25 rem (20 px) / 1.1   | Entry title on the timeline                                          |
| `text-note-title` | 1.1875 rem (19 px) / 1.2 | Hover note title                                                     |
| `text-note`       | 1.0625 rem (17 px) / 1.4 | Hover note text                                                      |
| `text-post-title` | 2.75 rem (44 px) / 1.05  | Post title                                                           |
| `text-lead`       | 1.375 rem (22 px) / 1.35 | Post lead                                                            |
| `text-body`       | 1.125 rem (18 px) / 1.5  | Post body                                                            |

| Token               | Letter spacing | Role                 |
| ------------------- | -------------- | -------------------- |
| `tracking-label`    | 0.06 em        | Tick labels, "Heute" |
| `tracking-date`     | 0.1 em         | Entry date lines     |
| `tracking-meta`     | 0.12 em        | Post meta line       |
| `tracking-wordmark` | 0.18 em        | Wordmark             |

Offsets use the spacing scale in 0.25 steps of `--spacing` (`gap-0.75` = 3 px, `top-5.5` = 22 px). Geometry that feeds layout math (row
offsets, label width cap, dot sizes) lives in the timeline's JS constants and is applied through `style`.

Icons come from `lucide-react` (pinned, `currentColor`), never text glyphs (arrows, chevrons, bullets as characters) and never hand-drawn
SVG.

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

| Step     | Class (example)  | Used for                              |
| -------- | ---------------- | ------------------------------------- |
| ink 55 % | `hover:bg-fg/55` | Span bar on hover and keyboard focus. |
| ink 40 % | `border-fg/40`   | Connectors.                           |
| ink 35 % | `bg-fg/35`       | Span bars.                            |
| ink 30 % | `text-fg/30`     | Disabled arrows.                      |
| ink 10 % | `to-fg/10`       | Fading end of an ongoing span.        |

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

| Motion                          | Duration | Easing                                    | Constant                |
| ------------------------------- | -------- | ----------------------------------------- | ----------------------- |
| Post collapse (timeline height) | 500 ms   | `ease-in-out` = `cubic-bezier(.4,0,.2,1)` | `COLLAPSE_ANIMATION_MS` |
| Zoom and pan                    | 300 ms   | ease-out (cubic)                          | `ZOOM_ANIMATION_MS`     |
| Bar-click ring on a label       | 1000 ms  | none (on at once)                         | `BAR_HIGHLIGHT_MS`      |
| Bar-click ring fade-out         | 300 ms   | `ease-out`                                | `BAR_HIGHLIGHT_FADE_MS` |
| Hover states                    | none     | —                                         | —                       |

Tailwind's defaults nearest the prototype, so the classes stay plain (`duration-500 ease-in-out`). `prefers-reduced-motion` turns all of
them off.

## Unchanged

Spacing and radius scales. Radii are only used for circles (`rounded-full`) in this design.
