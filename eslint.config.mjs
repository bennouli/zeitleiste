import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'
import noTestOnlyExports from './eslint/no-test-only-exports.mjs'

const TESTS = ['src/**/__tests__/**', 'e2e/**']
const TEXT_ALLOWED = ['src/i18n/**', 'src/collections/**']

const PRIVATE_UNDER_TESTS_SELECTORS = [
    {
        selector: 'ImportSpecifier[imported.name="PRIVATE_UNDER_TESTS"]',
        message: 'PRIVATE_UNDER_TESTS is read by the tests only.',
    },
    {
        selector: 'MemberExpression[property.name="PRIVATE_UNDER_TESTS"]',
        message: 'PRIVATE_UNDER_TESTS is read by the tests only.',
    },
    {
        selector: 'ExportSpecifier[local.name="PRIVATE_UNDER_TESTS"]',
        message: 'PRIVATE_UNDER_TESTS is read by the tests only.',
    },
]

const TEXT_ATTRIBUTE =
    'JSXAttribute[name.name=/^(aria-label|title|alt|placeholder|label)$/]'
const INTERFACE_TEXT_MESSAGE =
    'Interface text lives in src/i18n (de.ts, en.ts); read it with useI18n() or messages[locale].'

const INTERFACE_TEXT_SELECTORS = [
    'JSXText[value=/\\p{L}/u]',
    `${TEXT_ATTRIBUTE} > Literal[value=/\\p{L}/u]`,
    `${TEXT_ATTRIBUTE} > JSXExpressionContainer > Literal[value=/\\p{L}/u]`,
    `${TEXT_ATTRIBUTE} > JSXExpressionContainer > TemplateLiteral`,
    `${TEXT_ATTRIBUTE} > JSXExpressionContainer > ConditionalExpression > Literal[value=/\\p{L}/u]`,
].map((selector) => ({ selector, message: INTERFACE_TEXT_MESSAGE }))

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
        'repos/**',
        'src/payload-types.ts',
        'src/app/(payload)/admin/importMap.js',
    ]),
    {
        files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts'],
        rules: {
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: TESTS,
        plugins: {
            local: { rules: { 'no-test-only-exports': noTestOnlyExports } },
        },
        rules: {
            'local/no-test-only-exports': [
                'error',
                {
                    root: import.meta.dirname,
                    entryPoints: [
                        'src/app',
                        'src/payload.config.ts',
                        'src/proxy.ts',
                        'src/migrations',
                    ],
                    testSupport: ['src/test'],
                },
            ],
            'no-restricted-syntax': ['error', ...PRIVATE_UNDER_TESTS_SELECTORS],
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: [...TESTS, ...TEXT_ALLOWED],
        rules: {
            'no-restricted-syntax': [
                'error',
                ...PRIVATE_UNDER_TESTS_SELECTORS,
                ...INTERFACE_TEXT_SELECTORS,
            ],
        },
    },
    {
        files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
        ignores: TESTS,
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@/data/entries', '**/data/entries'],
                            message:
                                'The site reads entries from the content management (@/lib/entries); the sample file only feeds the seed and the tests.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/lib/**/*.ts'],
        ignores: TESTS,
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@/components/**',
                                '@/app/**',
                                '**/components/**',
                                '**/app/**',
                            ],
                            message:
                                'src/lib holds shared logic; it does not import from components or routes.',
                        },
                    ],
                },
            ],
        },
    },
])

export default eslintConfig
