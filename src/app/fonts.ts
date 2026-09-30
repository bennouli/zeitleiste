import localFont from 'next/font/local'

// Footgun: the order of `src` decides which file the fallback metrics are measured on (DESIGN.md § Fonts).
const ebGaramond = localFont({
    src: [
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-ext-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-ext-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Times New Roman',
    variable: '--font-eb-garamond',
})

const ebGaramondItalic = localFont({
    src: [
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-400-italic.woff2',
            weight: '400',
            style: 'italic',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-ext-400-italic.woff2',
            weight: '400',
            style: 'italic',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Times New Roman',
    preload: false,
    variable: '--font-eb-garamond-italic',
})

const googleSans = localFont({
    src: [
        {
            path: '../fonts/google-sans/google-sans-latin-ext-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/google-sans/google-sans-latin-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/google-sans/google-sans-latin-ext-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: '../fonts/google-sans/google-sans-latin-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Arial',
    variable: '--font-google-sans',
})

// Footgun: this family goes before `--font-google-sans` in a stack, and has no fallback of its own (DESIGN.md § Fonts).
const googleSansCyrillic = localFont({
    src: [
        {
            path: '../fonts/google-sans/google-sans-cyrillic-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/google-sans/google-sans-cyrillic-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: false,
    preload: false,
    declarations: [
        {
            prop: 'unicode-range',
            value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
        },
    ],
    variable: '--font-google-sans-cyrillic',
})

export const fontVariables = `${ebGaramond.variable} ${ebGaramondItalic.variable} ${googleSans.variable} ${googleSansCyrillic.variable}`
